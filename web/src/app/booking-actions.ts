"use server";

// 예약 신청 서버 액션 — 돌봄 파트너 카드의 "예약 신청" 폼.
// 저장(booking_requests) → 슬랙 알림 → 운영자가 파트너에게 연결. 그 이상의 상태 흐름은 두지 않는다.
// 신청자 개인정보는 관리자 화면·슬랙에만 간다. 원 IP 는 저장하지 않고 해시로 시간당 제한만 건다.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { carePersonLabel, isCareType } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { authSecret, siteUrl } from "@/lib/config";
import { BOOKING_LIMITS, slackBookingText, validateBookingInput } from "@/lib/booking";
import { sendSlackMessage } from "@/lib/slack";

const { spots, spotTypes, regions, bookingRequests } = schema;

export interface BookingActionState {
  error?: string;
  saved?: boolean;
  /** 에러 시 되돌려 주는 입력값 — React 19 가 액션 뒤 폼을 초기화하므로 */
  values?: Record<string, string>;
}

const ECHO_FIELDS = ["requesterName", "contact", "petNote", "preferredDate", "message"] as const;

async function requesterHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${ip}|${authSecret() ?? ""}`).digest("hex").slice(0, 32);
}

export async function createBookingRequestAction(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const values: Record<string, string> = {};
  for (const k of ECHO_FIELDS) {
    const v = raw[k];
    if (typeof v === "string") values[k] = v;
  }
  const v = validateBookingInput(raw);
  if (!v.ok) return { error: v.error, values };

  const spotId = Number(raw.spotId);
  const regionId = Number(raw.regionId);
  if (!Number.isSafeInteger(spotId) || spotId <= 0) return { error: "잘못된 요청입니다.", values };
  if (!isDbConfigured()) return { error: "지금은 신청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.", values };
  const db = getDb();

  const spot = (
    await db
      .select({ id: spots.id, name: spots.name, status: spots.status, typeSlug: spotTypes.slug })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!spot || !isCareType(spot.typeSlug) || spot.status !== "operating") {
    return { error: "지금은 신청을 받지 않는 파트너입니다.", values };
  }
  const region =
    Number.isSafeInteger(regionId) && regionId > 0
      ? (await db.select({ id: regions.id, sidoName: regions.sidoName, sigunguName: regions.sigunguName }).from(regions).where(eq(regions.id, regionId)).limit(1))[0]
      : undefined;

  const ipHash = await requesterHash();
  const recent = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.ipHash, ipHash), gt(bookingRequests.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if ((recent[0]?.count ?? 0) >= BOOKING_LIMITS.perHour) {
    return { error: "신청이 많아 잠시 후 다시 시도해 주세요.", values };
  }

  const areaLabel = region ? `${region.sidoName} ${region.sigunguName}` : null;
  const inserted = await db
    .insert(bookingRequests)
    .values({
      spotId: spot.id,
      spotName: spot.name,
      serviceKind: spot.typeSlug,
      regionId: region?.id ?? null,
      areaLabel,
      requesterName: v.value.requesterName,
      contact: v.value.contact,
      petNote: v.value.petNote,
      preferredDate: v.value.preferredDate,
      message: v.value.message,
      ipHash,
    })
    .returning({ id: bookingRequests.id });
  const id = inserted[0]!.id;

  const sent = await sendSlackMessage(
    slackBookingText({
      id,
      personLabel: carePersonLabel(spot.typeSlug),
      spotName: spot.name,
      areaLabel,
      adminUrl: `${siteUrl()}/admin/bookings`,
      ...v.value,
    }),
  );
  if (sent) await db.update(bookingRequests).set({ slackSentAt: new Date() }).where(eq(bookingRequests.id, id));

  return { saved: true };
}
