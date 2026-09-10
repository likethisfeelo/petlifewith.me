"use server";

// 예약·상담 액션 — 회원이 업체·돌봄 파트너·전문가에게 요청하고, 제공자(소유자·전문가 계정)나 관리자가 확인·결제 확인·완료·취소한다.
// 결제 확인은 수동(PG 는 뒤에): 확인되면 대화가 열린다. 채팅은 요청 회원·제공자 계정·관리자만.
// 신청자 이름·연락처는 관리자·슬랙에만 — 제공자에게는 닉네임과 요청 내용만 보인다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { isCareType } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { getCurrentMember } from "@/lib/member";
import { getReservationFor, getConversationId, listMessages, slotTaken, type MessageRow } from "@/lib/queries/reservations";
import { bookedSlotStarts, getExpertById } from "@/lib/queries/experts";
import {
  CONSULT_MODE_LABEL,
  EXPERT_KIND_LABEL,
  RESERVATION_KIND_LABEL,
  RESERVATION_LIMITS,
  RESERVATION_STATUS_LABEL,
  chatOpen,
  slotLabel,
  slotWindows,
  validateMessageBody,
  validateReservationInput,
  type ReservationStatus,
} from "@/lib/reservations";
import { sendSlackMessage } from "@/lib/slack";

const { reservations, conversations, messages, spots, spotTypes, regions } = schema;

export interface ReservationActionState {
  error?: string;
  values?: Record<string, string>;
}

function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k !== "website") values[k] = v;
  return values;
}
function num(v: unknown): number | null {
  const n = Number(typeof v === "string" ? v.trim() : v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function createReservationAction(_prev: ReservationActionState, formData: FormData): Promise<ReservationActionState> {
  const values = echo(formData);
  const member = await getCurrentMember();
  const back = String(formData.get("nextPath") ?? "/");
  if (!member) redirect(`/login?next=${encodeURIComponent(back.startsWith("/") ? back : "/")}`);
  const v = validateReservationInput(Object.fromEntries(formData.entries()));
  if (!v.ok) return { error: v.error, values };
  if (!isDbConfigured()) return { error: "지금은 요청을 받을 수 없습니다.", values };
  const db = getDb();

  const recent = (
    await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reservations)
      .where(and(eq(reservations.userId, member.id), gt(reservations.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
  )[0]?.n;
  if ((recent ?? 0) >= RESERVATION_LIMITS.perDay) return { error: `요청은 하루에 ${RESERVATION_LIMITS.perDay}건까지입니다.`, values };

  const spotId = num(formData.get("spotId"));
  const expertId = num(formData.get("expertId"));
  let insert: typeof reservations.$inferInsert;
  let summary: string[];

  if (spotId) {
    const spot = (
      await db
        .select({ id: spots.id, name: spots.name, status: spots.status, claimedBy: spots.claimedBy, typeSlug: spotTypes.slug, regionId: spots.regionId, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
        .from(spots)
        .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
        .innerJoin(regions, eq(spots.regionId, regions.id))
        .where(eq(spots.id, spotId))
        .limit(1)
    )[0];
    if (!spot || spot.status !== "operating") return { error: "지금은 요청을 받지 않는 곳입니다.", values };
    if (spot.claimedBy === member.id) return { error: "내 업체에는 요청할 수 없어요.", values };
    const care = isCareType(spot.typeSlug);
    insert = {
      kind: care ? "care" : "spot",
      spotId: spot.id,
      targetName: spot.name,
      serviceKind: spot.typeSlug,
      regionId: spot.regionId,
      areaLabel: `${spot.sidoName} ${spot.sigunguName}`,
      userId: member.id,
      providerUserId: spot.claimedBy,
      requesterName: v.value.requesterName,
      contact: v.value.contact,
      petNote: v.value.petNote,
      preferredText: v.value.preferredText,
      message: v.value.message,
    };
    summary = [`${care ? "돌봄 파트너" : "업체"}: ${spot.name} (${spot.sidoName} ${spot.sigunguName})`, v.value.preferredText ? `희망 일정: ${v.value.preferredText}` : ""];
  } else if (expertId) {
    const expert = await getExpertById(expertId);
    if (!expert || expert.status !== "published") return { error: "지금은 상담을 받지 않는 전문가입니다.", values };
    if (expert.userId === member.id) return { error: "내 프로필에는 신청할 수 없어요.", values };
    const mode = String(formData.get("mode") ?? "");
    if (mode !== "slot" && mode !== "callback") return { error: "시간 예약 또는 연락받기를 골라 주세요.", values };
    let slotStart: Date | null = null;
    let slotEnd: Date | null = null;
    if (mode === "slot") {
      const ms = Number(formData.get("slotStart"));
      const now = new Date();
      const booked = await bookedSlotStarts(expert.id, now);
      const windows = slotWindows(expert.slots, booked, now);
      const w = windows.find((x) => x.start.getTime() === ms);
      if (!w) return { error: "그 시간은 이제 고를 수 없어요. 다른 시간을 골라 주세요.", values };
      if (await slotTaken(expert.id, w.start)) return { error: "방금 다른 분이 잡은 시간입니다. 다른 시간을 골라 주세요.", values };
      slotStart = w.start;
      slotEnd = w.end;
    } else if (!v.value.preferredText) {
      return { error: "연락받기를 고르면 희망 시간대를 적어 주세요.", values };
    }
    insert = {
      kind: "consult",
      expertId: expert.id,
      targetName: expert.displayName,
      serviceKind: expert.kind,
      userId: member.id,
      providerUserId: expert.userId,
      requesterName: v.value.requesterName,
      contact: v.value.contact,
      petNote: v.value.petNote,
      mode,
      slotStart,
      slotEnd,
      preferredText: v.value.preferredText,
      topic: v.value.topic,
      message: v.value.message,
    };
    summary = [
      `${EXPERT_KIND_LABEL[expert.kind]}: ${expert.displayName}`,
      slotStart && slotEnd ? `시간 예약: ${slotLabel({ start: slotStart, end: slotEnd })}` : `연락받기: ${v.value.preferredText}`,
      v.value.topic ? `주제: ${v.value.topic}` : "",
      expert.modes.length ? `방식: ${expert.modes.map((m) => CONSULT_MODE_LABEL[m as keyof typeof CONSULT_MODE_LABEL] ?? m).join("·")}` : "",
    ];
  } else {
    return { error: "잘못된 요청입니다.", values };
  }

  const inserted = await db.insert(reservations).values(insert).returning({ id: reservations.id });
  const id = inserted[0]!.id;
  const sent = await sendSlackMessage(
    [`🗓 ${RESERVATION_KIND_LABEL[insert.kind]} 요청 #${id}`, ...summary.filter(Boolean).map((s) => `• ${s}`), `• 신청: ${member.displayName} (${v.value.requesterName} / ${v.value.contact})`, v.value.message ? `• 내용: ${v.value.message.replace(/\s+/g, " ").slice(0, 300)}` : "", `→ ${siteUrl()}/admin/reservations`]
      .filter(Boolean)
      .join("\n"),
    slackRequestsWebhookUrl(),
  );
  if (sent) await db.update(reservations).set({ slackSentAt: new Date() }).where(eq(reservations.id, id));
  revalidatePath("/me/requests");
  revalidatePath("/me/received");
  redirect(`/reservations/${id}?created=1`);
}

/** 현재 행위자 — 관리자 세션이면 admin, 아니면 회원 */
async function actor(): Promise<{ userId: string | null; admin: boolean; name: string }> {
  const admin = await getSession();
  if (admin) return { userId: null, admin: true, name: "운영자" };
  const member = await getCurrentMember();
  return { userId: member?.id ?? null, admin: false, name: member?.displayName ?? "" };
}

const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  new: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

/** 상태 바꾸기 — 역할에 따라 허용 범위가 다르다. 결제 확인(paid) 은 제공자·관리자만, 신청자는 취소만 */
export async function setReservationStatusAction(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  const next = String(formData.get("status") ?? "") as ReservationStatus;
  if (!id || !(next in TRANSITIONS) || !isDbConfigured()) return;
  const who = await actor();
  const found = await getReservationFor(id, who);
  if (!found) return;
  const cur = found.r.status;
  if (!TRANSITIONS[cur].includes(next)) return;
  if (found.role === "requester" && next !== "cancelled") return;
  const db = getDb();
  const patch: Partial<typeof reservations.$inferInsert> = { status: next, updatedAt: new Date() };
  if (next === "paid") {
    patch.paidAt = new Date();
    patch.paidBy = found.role === "admin" ? "admin" : "provider";
    await db.insert(conversations).values({ reservationId: id }).onConflictDoNothing();
  }
  if (next === "done" || next === "cancelled") patch.handledAt = new Date();
  await db.update(reservations).set(patch).where(eq(reservations.id, id));
  // 상태 안내를 대화에 남긴다 (대화가 있을 때)
  const convId = await getConversationId(id);
  if (convId) await db.insert(messages).values({ conversationId: convId, senderUserId: null, senderRole: "system", body: `${who.name}이(가) 상태를 "${RESERVATION_STATUS_LABEL[next]}"(으)로 바꿨습니다.` });
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/me/requests");
  revalidatePath("/me/received");
  revalidatePath("/admin/reservations");
}

export async function saveReservationNoteAction(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (!id || !isDbConfigured()) return;
  const who = await actor();
  if (!who.admin) return;
  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 2000);
  await getDb().update(reservations).set({ adminNote: note || null, updatedAt: new Date() }).where(eq(reservations.id, id));
  revalidatePath("/admin/reservations");
}

// ---------- 채팅 ----------

export interface ChatState {
  error?: string;
}

export async function sendMessageAction(_prev: ChatState, formData: FormData): Promise<ChatState> {
  const id = num(formData.get("reservationId"));
  if (!id || !isDbConfigured()) return { error: "잘못된 요청" };
  const who = await actor();
  const found = await getReservationFor(id, who);
  if (!found) return { error: "권한이 없습니다." };
  if (!chatOpen(found.r.status)) return { error: "결제 확인 뒤에 채팅이 열립니다." };
  const body = validateMessageBody(formData.get("body"));
  if (!body.ok) return { error: body.error };
  const db = getDb();
  const convId = await getConversationId(id);
  if (!convId) return { error: "대화가 아직 열리지 않았습니다." };
  if (who.userId) {
    const recent = (
      await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(messages)
        .where(and(eq(messages.senderUserId, who.userId), gt(messages.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
    )[0]?.n;
    if ((recent ?? 0) >= RESERVATION_LIMITS.messagesPerHour) return { error: "메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요." };
  }
  await db.insert(messages).values({ conversationId: convId, senderUserId: who.userId, senderRole: found.role, body: body.value });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, convId));
  await db.update(reservations).set({ updatedAt: new Date() }).where(eq(reservations.id, id));
  return {};
}

/** 폴링 — afterId 뒤의 메시지. 권한 없으면 빈 배열 */
export async function fetchMessagesAction(reservationId: number, afterId: number): Promise<MessageRow[]> {
  if (!isDbConfigured()) return [];
  const who = await actor();
  const found = await getReservationFor(reservationId, who);
  if (!found) return [];
  const convId = await getConversationId(reservationId);
  if (!convId) return [];
  return listMessages(convId, afterId);
}
