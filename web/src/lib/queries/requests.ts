// 요청함 조회 — service_requests. 관리자 화면·대시보드용.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { isCareType } from "@app/data";
import { getDb, isDbConfigured, schema } from "../db";
import type { RequestKind, RequestStatus } from "../requests";

const { serviceRequests, spots, makers, regions, promotions, users } = schema;

export type ServiceRequestRow = typeof serviceRequests.$inferSelect;

export interface RequestListItem {
  request: ServiceRequestRow;
  spotName: string | null;
  spotSlug: string | null;
  makerName: string | null;
  makerSlug: string | null;
  /** 연결된 스팟이 지역 상단 노출 중인지 (유료 노출 요청 처리 상태 표시용) */
  promoted: boolean;
  /** 로그인 회원이 보낸 요청이면 닉네임 — 소유자 연결용 */
  memberName: string | null;
}

export async function listServiceRequests(filter: { kind?: RequestKind | null; status?: RequestStatus | null; limit?: number } = {}): Promise<RequestListItem[]> {
  if (!isDbConfigured()) return [];
  const conds = [];
  if (filter.kind) conds.push(eq(serviceRequests.kind, filter.kind));
  if (filter.status) conds.push(eq(serviceRequests.status, filter.status));
  const rows = await getDb()
    .select({
      request: serviceRequests,
      spotName: spots.name,
      spotSlug: spots.slug,
      makerName: makers.name,
      makerSlug: makers.slug,
      promoted: sql<boolean>`exists (select 1 from ${promotions} p where p.spot_id = ${serviceRequests.spotId} and p.active = true)`,
      memberName: users.displayName,
    })
    .from(serviceRequests)
    .leftJoin(spots, eq(serviceRequests.spotId, spots.id))
    .leftJoin(makers, eq(serviceRequests.makerId, makers.id))
    .leftJoin(users, eq(serviceRequests.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(serviceRequests.createdAt))
    .limit(filter.limit ?? 200);
  return rows;
}

export async function getServiceRequest(id: number): Promise<ServiceRequestRow | null> {
  if (!isDbConfigured()) return null;
  const row = (await getDb().select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1))[0];
  return row ?? null;
}

export async function countNewRequests(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (await getDb().select({ count: sql<number>`count(*)`.mapWith(Number) }).from(serviceRequests).where(eq(serviceRequests.status, "new")))[0];
  return row?.count ?? 0;
}

/** 지역 id → "시도 시군구" — 요청 내용 표시용 */
export async function regionLabels(ids: number[]): Promise<Record<number, string>> {
  const uniq = [...new Set(ids.filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (uniq.length === 0 || !isDbConfigured()) return {};
  const rows = await getDb()
    .select({ id: regions.id, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
    .from(regions)
    .where(sql`${regions.id} in (${sql.join(uniq.map((n) => sql`${n}`), sql`, `)})`);
  return Object.fromEntries(rows.map((r) => [r.id, `${r.sidoName} ${r.sigunguName}`]));
}

/** 공개 폼의 지역 고르기(시도 → 시군구) 옵션 */
export interface RegionOption {
  id: number;
  sidoName: string;
  sidoSlug: string;
  sigunguName: string;
}

export async function listRegionOptions(): Promise<RegionOption[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ id: regions.id, sidoName: regions.sidoName, sidoSlug: regions.sidoSlug, sigunguName: regions.sigunguName })
    .from(regions)
    .orderBy(regions.id);
}

/** 업체 등록 요청에서 고를 수 있는 업종 — 공개 노출(listed)·수익화 가능(장묘 제외)·돌봄 파트너 제외 */
export interface SpotTypeOption {
  id: number;
  slug: string;
  name: string;
}

export async function listRegistrableSpotTypes(): Promise<SpotTypeOption[]> {
  if (!isDbConfigured()) return [];
  const { spotTypes } = schema;
  const rows = await getDb()
    .select({ id: spotTypes.id, slug: spotTypes.slug, name: spotTypes.name })
    .from(spotTypes)
    .where(and(eq(spotTypes.listed, true), eq(spotTypes.monetizable, true)))
    .orderBy(spotTypes.sortOrder);
  return rows.filter((r) => !isCareType(r.slug));
}

// ---------- 회원 본인 화면 (/me) ----------

export interface MyRequestItem {
  id: number;
  kind: RequestKind;
  status: RequestStatus;
  /** 한 줄 요약 — 업체명·활동명·대상 이름 */
  summary: string;
  targetPath: string | null;
  createdAt: Date;
}

export async function listMyServiceRequests(userId: string): Promise<MyRequestItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ request: serviceRequests, spotName: spots.name, spotSlug: spots.slug, makerName: makers.name, makerSlug: makers.slug })
    .from(serviceRequests)
    .leftJoin(spots, eq(serviceRequests.spotId, spots.id))
    .leftJoin(makers, eq(serviceRequests.makerId, makers.id))
    .where(eq(serviceRequests.userId, userId))
    .orderBy(desc(serviceRequests.createdAt))
    .limit(100);
  const { idSlugPath } = await import("../format");
  return rows.map(({ request: r, spotName, spotSlug, makerName, makerSlug }) => {
    const p = r.payload as Record<string, unknown>;
    const name = (typeof p.businessName === "string" && p.businessName) || (typeof p.displayName === "string" && p.displayName) || spotName || makerName || "";
    const targetPath = r.spotId && spotSlug ? idSlugPath("place", r.spotId, spotSlug) : r.makerId && makerSlug ? idSlugPath("maker", r.makerId, makerSlug) : null;
    return { id: r.id, kind: r.kind, status: r.status, summary: name, targetPath, createdAt: r.createdAt };
  });
}

/** 접수·처리 중인 내 요청 수 — /me 탭 배지 */
export async function countNewForMember(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (
    await getDb()
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.userId, userId), inArray(serviceRequests.status, ["new", "in_progress"])))
  )[0];
  return row?.count ?? 0;
}
