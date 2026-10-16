"use server";

import { queueClientEvent } from "@/lib/client-events";

// 상담 채팅 액션 — 대화(conversations) 기준. 두 갈래가 같은 함수를 쓴다.
//  · direct: 상담 프로필에서 회원이 바로 여는 대화 (테스트 운영 — 결제 없이 열린다, 회원만)
//  · reservation: 예약·상담 요청에 딸린 대화 (결제 확인 뒤 열린다)
// 권한 판단은 lib/queries/conversations.ts 가 하고, 여기서는 쓰기와 제한만 본다.
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getCurrentMember } from "@/lib/member";
import { findDirectConversation, getChatFor } from "@/lib/queries/conversations";
import { getExpertById } from "@/lib/queries/experts";
import { listMessages, type MessageRow } from "@/lib/queries/reservations";
import { EXPERT_KIND_LABEL, RESERVATION_LIMITS, validateMessageBody } from "@/lib/reservations";
import { sendSlackMessage } from "@/lib/slack";

const { conversations, messages, reservations } = schema;

export interface ChatState {
  error?: string;
}

/** 현재 행위자 — 관리자 세션이면 admin, 아니면 회원 */
async function actor(): Promise<{ userId: string | null; admin: boolean; name: string }> {
  const admin = await getSession();
  if (admin) return { userId: null, admin: true, name: "운영자" };
  const member = await getCurrentMember();
  return { userId: member?.id ?? null, admin: false, name: member?.displayName ?? "" };
}

function num(v: unknown): number | null {
  const n = Number(typeof v === "string" ? v.trim() : v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * 상담 프로필에서 바로 채팅 열기 — 회원 전용.
 * 이미 열린 대화가 있으면 그 대화로 간다. 예약·결제 흐름과는 별개(테스트 운영).
 */
export async function startConsultChatAction(formData: FormData): Promise<void> {
  const expertId = num(formData.get("expertId"));
  const back = String(formData.get("nextPath") ?? "/consult");
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(back.startsWith("/") ? back : "/consult")}`);
  if (!expertId || !isDbConfigured()) redirect(back.startsWith("/") ? back : "/consult");
  const expert = await getExpertById(expertId);
  if (!expert || expert.status !== "published") redirect("/consult");
  if (expert.userId === member.id) redirect(`/consult/${encodeURIComponent(expert.slug)}`);

  const db = getDb();
  const existing = await findDirectConversation(expert.id, member.id);
  if (existing) redirect(`/chat/${existing}`);

  const opened = (
    await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(conversations)
      .where(and(eq(conversations.userId, member.id), gt(conversations.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
  )[0]?.n;
  if ((opened ?? 0) >= RESERVATION_LIMITS.chatsPerDay) redirect(`/consult/${encodeURIComponent(expert.slug)}?limit=1`);

  await db.insert(conversations).values({ kind: "direct", expertId: expert.id, userId: member.id, lastMessageAt: new Date() }).onConflictDoNothing();
  const convId = await findDirectConversation(expert.id, member.id);
  if (!convId) redirect(`/consult/${encodeURIComponent(expert.slug)}`);
  await db.insert(messages).values({
    conversationId: convId,
    senderUserId: null,
    senderRole: "system",
    body: "대화가 열렸습니다. 생활 상담이라 진단·처방·치료는 다루지 않아요. 아픈 곳이 있으면 진료를 먼저 받아 주세요.",
  });
  await sendSlackMessage(
    [`💬 상담 채팅 시작 — ${EXPERT_KIND_LABEL[expert.kind]} ${expert.displayName}`, `• 회원: ${member.displayName}`, `→ ${siteUrl()}/chat/${convId}`].join("\n"),
    slackRequestsWebhookUrl(),
  );
  revalidatePath("/me/chats");
  await queueClientEvent("direct_chat_start", { entity_type: "expert", entity_id: String(expert.id) });
  redirect(`/chat/${convId}?started=1`);
}

/** 메시지 보내기 — direct 는 바로, 예약 대화는 결제 확인 뒤 */
export async function sendChatMessageAction(_prev: ChatState, formData: FormData): Promise<ChatState> {
  const convId = num(formData.get("conversationId"));
  if (!convId || !isDbConfigured()) return { error: "잘못된 요청" };
  const who = await actor();
  const chat = await getChatFor(convId, who);
  if (!chat) return { error: "권한이 없습니다." };
  if (!chat.open) return { error: "결제 확인 뒤에 채팅이 열립니다." };
  const body = validateMessageBody(formData.get("body"));
  if (!body.ok) return { error: body.error };
  const db = getDb();
  if (who.userId) {
    const recent = (
      await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(messages)
        .where(and(eq(messages.senderUserId, who.userId), gt(messages.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
    )[0]?.n;
    if ((recent ?? 0) >= RESERVATION_LIMITS.messagesPerHour) return { error: "메시지를 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요." };
  }
  await db.insert(messages).values({ conversationId: convId, senderUserId: who.userId, senderRole: chat.role, body: body.value });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, convId));
  if (chat.reservationId) await db.update(reservations).set({ updatedAt: new Date() }).where(eq(reservations.id, chat.reservationId));
  return {};
}

/** 폴링 — afterId 뒤의 메시지. 권한이 없으면 빈 배열 */
export async function fetchChatMessagesAction(conversationId: number, afterId: number): Promise<MessageRow[]> {
  if (!isDbConfigured()) return [];
  const who = await actor();
  const chat = await getChatFor(conversationId, who);
  if (!chat) return [];
  return listMessages(conversationId, afterId);
}
