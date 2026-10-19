"use server";

// 요청함 서버 액션 — 업체 등록·정보 관리·지역 상단 노출·돌봄 파트너 등록 (로그인 없음).
// 흐름은 하나뿐이다: 저장(service_requests) → 슬랙 알림 → 운영자가 /admin/requests 에서 처리.
// 신청자 이름·연락처·사업자번호는 관리자 화면·슬랙에만 간다 (claude.md 5-6). 원 IP 는 저장하지 않고
// 해시로 시간당 제한만 건다. 결제는 수동 — 운영자가 안내하고 입금을 확인한 뒤 노출을 켠다.
import { and, eq, gt, sql } from "drizzle-orm";
import { CARE_TYPE_SLUGS, carePersonLabel } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { idSlugPath } from "@/lib/format";
import { requesterHash } from "@/lib/requester-hash";
import { getCurrentMember } from "@/lib/member";
import {
  PROMO_PLAN_LABEL,
  REQUEST_KINDS,
  REQUEST_LIMITS,
  slackRequestText,
  validateCarePartner,
  validatePromoSlot,
  validateRequester,
  validateSpotRegister,
  type RequestKind,
  type RequestPayload,
} from "@/lib/requests";
import { listRegistrableSpotTypes, regionLabels } from "@/lib/queries/requests";
import { sendSlackMessage } from "@/lib/slack";
import { findDuplicateSpots, type OwnerSearchHit } from "@/lib/queries/spot-register";

const { serviceRequests, spots, spotTypes, makers } = schema;

export interface RequestActionState {
  error?: string;
  /** 접수된 요청 번호 — 안내 문구에 쓴다 */
  savedId?: number;
  /** 에러 시 되돌려 주는 입력값 — React 19 가 액션 뒤 폼을 초기화하므로 */
  values?: Record<string, string>;
  /** 업체 등록 직전 — 이미 있는 것 같은 업체 ("혹시 이 업체인가요?"). confirmNew=1 로 다시 보내면 그대로 등록 */
  duplicates?: OwnerSearchHit[];
}


function echo(raw: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "website") values[k] = v;
  return values;
}

function positiveInt(v: unknown): number | null {
  const n = Number(typeof v === "string" ? v.trim() : v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

interface Prepared {
  spotId: number | null;
  makerId: number | null;
  payload: RequestPayload;
  /** 슬랙 요약 줄 */
  summary: string[];
}

async function prepare(db: ReturnType<typeof getDb>, kind: RequestKind, raw: Record<string, unknown>): Promise<Prepared | { error: string }> {
  if (kind === "spot_register") {
    const types = await listRegistrableSpotTypes();
    const v = validateSpotRegister(raw, types.map((t) => t.slug));
    if (!v.ok) return { error: v.error };
    let region: string | null = null;
    if (v.value.regionId) {
      region = (await regionLabels([v.value.regionId]))[v.value.regionId] ?? null;
      if (!region) return { error: "지역(시군구)을 다시 골라 주세요." };
    }
    const typeName = v.value.typeSlug ? (types.find((t) => t.slug === v.value.typeSlug)?.name ?? v.value.typeSlug) : "업종 미입력";
    const summary = [
      `업체: ${v.value.businessName ?? "(업체명 미입력)"} (${typeName})`,
      `지역: ${region ?? "미입력"}${v.value.addressRoad ? ` · ${v.value.addressRoad}` : ""}`,
    ];
    return { spotId: null, makerId: null, payload: v.value, summary };
  }

  if (kind === "care_partner") {
    const v = validateCarePartner(raw, [...CARE_TYPE_SLUGS]);
    if (!v.ok) return { error: v.error };
    const labels = await regionLabels(v.value.regionIds);
    const names = v.value.regionIds.map((id) => labels[id]).filter((s): s is string => Boolean(s));
    if (names.length !== v.value.regionIds.length) return { error: "활동 지역을 다시 골라 주세요." };
    const summary = [`${carePersonLabel(v.value.typeSlug)}: ${v.value.displayName}`, `활동 지역: ${names.join(", ")}`];
    return { spotId: null, makerId: null, payload: v.value, summary };
  }

  if (kind === "promo_slot") {
    const spotId = positiveInt(raw.spotId);
    let spot: { id: number; name: string; slug: string; regionId: number; monetizable: boolean } | undefined;
    if (spotId) {
      spot = (
        await db
          .select({ id: spots.id, name: spots.name, slug: spots.slug, regionId: spots.regionId, monetizable: spotTypes.monetizable })
          .from(spots)
          .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
          .where(eq(spots.id, spotId))
          .limit(1)
      )[0];
      if (!spot) return { error: "업체를 찾을 수 없습니다." };
      // 장묘 등 비수익화 유형에는 광고를 붙이지 않는다 (기획서 4-1)
      if (!spot.monetizable) return { error: "이 유형의 업체에는 상단 노출을 제공하지 않습니다." };
    }
    const v = validatePromoSlot(raw, Boolean(spot));
    if (!v.ok) return { error: v.error };
    const regionId = v.value.regionId ?? spot?.regionId ?? null;
    if (!regionId) return { error: "노출할 지역(시군구)을 골라 주세요." };
    const labels = await regionLabels([regionId]);
    if (!labels[regionId]) return { error: "노출할 지역(시군구)을 골라 주세요." };
    const payload = { ...v.value, regionId, businessName: spot ? spot.name : v.value.businessName };
    const summary = [
      `형: ${PROMO_PLAN_LABEL[v.value.plan]} · 지역: ${labels[regionId]}`,
      spot ? `업체: ${spot.name} (${siteUrl()}${idSlugPath("place", spot.id, spot.slug)})` : `업체: ${payload.businessName} (미등록)`,
    ];
    return { spotId: spot?.id ?? null, makerId: null, payload, summary };
  }

  // spot_claim / maker_claim — 기존 페이지의 정보 관리 요청
  const targetId = positiveInt(raw.targetId);
  if (!targetId) return { error: "잘못된 요청입니다." };
  if (kind === "spot_claim") {
    const spot = (await db.select({ id: spots.id, name: spots.name, slug: spots.slug }).from(spots).where(eq(spots.id, targetId)).limit(1))[0];
    if (!spot) return { error: "대상을 찾을 수 없습니다." };
    return { spotId: spot.id, makerId: null, payload: {}, summary: [`업체: ${spot.name} (${siteUrl()}${idSlugPath("place", spot.id, spot.slug)})`] };
  }
  const maker = (await db.select({ id: makers.id, name: makers.name, slug: makers.slug }).from(makers).where(eq(makers.id, targetId)).limit(1))[0];
  if (!maker) return { error: "대상을 찾을 수 없습니다." };
  return { spotId: null, makerId: maker.id, payload: {}, summary: [`메이커: ${maker.name} (${siteUrl()}${idSlugPath("maker", maker.id, maker.slug)})`] };
}

export async function createServiceRequestAction(_prev: RequestActionState, formData: FormData): Promise<RequestActionState> {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const values = echo(raw);

  const kind = typeof raw.kind === "string" ? raw.kind : "";
  if (!(REQUEST_KINDS as readonly string[]).includes(kind)) return { error: "잘못된 요청입니다.", values };

  const requester = validateRequester(raw);
  if (!requester.ok) return { error: requester.error, values };
  if (!isDbConfigured()) return { error: "지금은 요청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.", values };
  const db = getDb();

  const prepared = await prepare(db, kind as RequestKind, raw);
  if ("error" in prepared) return { error: prepared.error, values };

  // 로그인한 회원이면 요청에 연결한다 — 소유 확인·등록이 끝나면 claimed_by 로 이어져 /me 에서 직접 관리한다
  const member = await getCurrentMember();

  // 새 업체 등록인데 같은 지역에 비슷한 이름·같은 전화번호가 있으면 먼저 물어본다 (중복 등록 대신 정보 관리 요청으로)
  if (kind === "spot_register" && raw.confirmNew !== "1") {
    const p = prepared.payload as { businessName?: string | null; phone?: string | null; regionId?: number | null };
    const duplicates = await findDuplicateSpots({ name: p.businessName ?? null, phone: p.phone ?? null, regionId: p.regionId ?? null }, member?.id ?? null);
    if (duplicates.length > 0) return { duplicates, values };
  }
  const ipHash = await requesterHash();
  const recent = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.ipHash, ipHash), gt(serviceRequests.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if ((recent[0]?.count ?? 0) >= REQUEST_LIMITS.perHour) return { error: "요청이 많아 잠시 후 다시 시도해 주세요.", values };

  const inserted = await db
    .insert(serviceRequests)
    .values({
      kind: kind as RequestKind,
      userId: member?.id ?? null,
      spotId: prepared.spotId,
      makerId: prepared.makerId,
      requesterName: requester.value.requesterName,
      contact: requester.value.contact,
      bizRegistrationNo: requester.value.bizRegistrationNo,
      message: requester.value.message,
      payload: prepared.payload,
      ipHash,
    })
    .returning({ id: serviceRequests.id });
  const id = inserted[0]!.id;

  const sent = await sendSlackMessage(
    slackRequestText({
      id,
      kind: kind as RequestKind,
      requesterName: requester.value.requesterName,
      contact: requester.value.contact,
      summary: member ? [...prepared.summary, `회원: ${member.displayName}`] : prepared.summary,
      message: requester.value.message,
      adminUrl: `${siteUrl()}/admin/requests?status=new#request-${id}`,
    }),
    slackRequestsWebhookUrl(),
  );
  if (sent) await db.update(serviceRequests).set({ slackSentAt: new Date() }).where(eq(serviceRequests.id, id));

  return { savedId: id };
}
