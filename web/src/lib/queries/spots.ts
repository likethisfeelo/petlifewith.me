import { and, asc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { CARE_TYPE_SLUGS } from "@app/data";
import { getDb, isDbConfigured, schema } from "../db";
import type { RegionTile } from "../regions";
import { tierOf, todayKst, type SpotPageLike, type SpotTier } from "../spot-pages";

const { spots, spotTypes, regions, promotions, regionDogStats, spotLinks, spotPages, spotMedia, mediaAssets } = schema;

export type SpotRow = typeof spots.$inferSelect;
export type SpotLinkRow = typeof spotLinks.$inferSelect;
export type SpotTypeRow = typeof spotTypes.$inferSelect;
export type RegionRow = typeof regions.$inferSelect;

export interface SpotWithMeta {
  spot: SpotRow;
  typeName: string;
  typeSlug: string;
  typeMonetizable: boolean;
  typeListed: boolean;
  region: RegionRow;
  promoted: boolean;
  /** 링크 페이지 (없으면 미등록) */
  page: SpotPageLike | null;
  /** 노출 등급 — 상단 노출 → 유료 → 무료(등록) → 미등록 (lib/spot-pages.ts) */
  tier: SpotTier;
  /** 링크 페이지 첫 사진 (목록 대표 사진은 프리미엄·상단 노출만 — lib/spot-browser-server.ts) */
  photoKey?: string | null;
}

const pageCols = {
  pagePublished: spotPages.published,
  pagePaidFrom: spotPages.paidFrom,
  pagePaidUntil: spotPages.paidUntil,
  pageHandle: spotPages.handle,
};

function pageOf(r: { pagePublished: boolean | null; pagePaidFrom: string | null; pagePaidUntil: string | null; pageHandle: string | null }): SpotPageLike | null {
  return r.pagePublished === null ? null : { published: r.pagePublished, paidFrom: r.pagePaidFrom, paidUntil: r.pagePaidUntil, handle: r.pageHandle };
}

/** 공개 노출 유형만 (listed). 관리자 화면은 includeUnlisted 로 B2B 유형까지 본다. */
export async function listSpotTypes(opts?: { includeUnlisted?: boolean }): Promise<SpotTypeRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  if (opts?.includeUnlisted) return db.select().from(spotTypes).orderBy(spotTypes.sortOrder);
  return db.select().from(spotTypes).where(eq(spotTypes.listed, true)).orderBy(spotTypes.sortOrder);
}

/** 슬러그 목록 순서를 유지해 유형을 돌려준다 (글 상단 배너용, 공개 유형만) */
export async function listSpotTypesBySlugs(slugs: string[]): Promise<SpotTypeRow[]> {
  if (!isDbConfigured() || slugs.length === 0) return [];
  const rows = await getDb().select().from(spotTypes).where(and(inArray(spotTypes.slug, slugs), eq(spotTypes.listed, true)));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return slugs.map((s) => bySlug.get(s)).filter((r): r is SpotTypeRow => Boolean(r));
}

export async function getSpotTypeBySlug(slug: string): Promise<SpotTypeRow | null> {
  if (!isDbConfigured()) return null;
  const rows = await getDb().select().from(spotTypes).where(eq(spotTypes.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getRegionBySlugs(sidoSlug: string, sigunguSlug: string): Promise<RegionRow | null> {
  if (!isDbConfigured()) return null;
  const rows = await getDb()
    .select()
    .from(regions)
    .where(and(eq(regions.sidoSlug, sidoSlug), eq(regions.sigunguSlug, sigunguSlug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPlace(id: number): Promise<SpotWithMeta | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({
      spot: spots,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      typeMonetizable: spotTypes.monetizable,
      typeListed: spotTypes.listed,
      region: regions,
      ...pageCols,
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .leftJoin(spotPages, eq(spotPages.spotId, spots.id))
    .where(eq(spots.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { pagePublished, pagePaidFrom, pagePaidUntil, pageHandle, ...rest } = row;
  const page = pageOf({ pagePublished, pagePaidFrom, pagePaidUntil, pageHandle });
  return { ...rest, promoted: false, page, tier: tierOf({ promoted: false, page }) };
}

/** 스팟의 외부 링크 (홈페이지·카카오톡·예약 등 — 등록된 것만) */
export async function getSpotLinks(spotId: number): Promise<SpotLinkRow[]> {
  if (!isDbConfigured()) return [];
  return getDb().select().from(spotLinks).where(eq(spotLinks.spotId, spotId)).orderBy(asc(spotLinks.sortOrder));
}

/** 여러 스팟의 링크 개수 — 관리자 목록·사이트맵의 noindex 판정에 쓴다. */
export async function countLinksBySpot(spotIds: number[]): Promise<Map<number, number>> {
  if (!isDbConfigured() || spotIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ spotId: spotLinks.spotId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spotLinks)
    .where(inArray(spotLinks.spotId, spotIds))
    .groupBy(spotLinks.spotId);
  return new Map(rows.map((r) => [r.spotId, r.count]));
}

/**
 * 지역(x유형) 스팟 목록 — 영업 중만.
 * 프로모션(region_top) 활성 스팟이 앞으로 오되 반드시 "광고" 라벨과 함께 렌더된다.
 * 광고 없이 순수 목록만 원하는 곳(장묘)은 monetizable=false 유형이라 프로모션이 생성될 수 없다.
 */
/** plainOrder: 장묘·약국 등 광고 없는 유형 — 등급 순서 없이 가나다순만 (기획서 4-1·6-2) */
/** where: 시군구 id, 또는 { sidoSlug } (시도 x 유형 페이지 — 그 시도 전체) */
export async function listSpotsInRegion(where: number | { sidoSlug: string }, typeId?: number, limit?: number, opts?: { plainOrder?: boolean }): Promise<SpotWithMeta[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  // 지역 혼합 목록(유형 미지정)은 소비자 유형(listed)만 섞는다.
  // 유형을 명시하면 — B2B 참고 유형 포함 — 그 유형의 목록을 그대로 보여준다.
  const conds = [typeof where === "number" ? eq(spots.regionId, where) : eq(regions.sidoSlug, where.sidoSlug), eq(spots.status, "operating")];
  if (typeId) conds.push(eq(spots.typeId, typeId));
  // 섞인 목록은 소비자 유형만 — 돌봄 파트너(개인)는 주소로 싣지 않는다 (서비스 지역 페이지로만)
  else conds.push(eq(spotTypes.listed, true), notInArray(spotTypes.slug, [...CARE_TYPE_SLUGS]));
  const today = todayKst();
  const promotedSql = sql<boolean>`exists (
        select 1 from ${promotions} p
        where p.spot_id = ${spots.id} and p.active = true and p.kind = 'region_top'
      )`;
  // 노출 순서: 상단 노출(광고) → 유료 링크 페이지 → 무료(등록) → 미등록, 같은 등급 안은 가나다순
  // 광고 없는 유형(장묘·약국)은 섞인 목록에서 등급으로 앞세우지 않는다 — 미등록과 같은 자리에서 가나다순
  const tierSql = sql`case
      when not ${spotTypes.monetizable} then 3
      when ${promotedSql} then 0
      when ${spotPages.published} and ${spotPages.paidFrom} <= ${today} and ${spotPages.paidUntil} >= ${today} then 1
      when ${spotPages.published} then 2
      else 3 end`;
  const rows = await db
    .select({
      spot: spots,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      typeMonetizable: spotTypes.monetizable,
      typeListed: spotTypes.listed,
      region: regions,
      promoted: promotedSql,
      photoKey: sql<string | null>`(select a.object_key from ${spotMedia} m join ${mediaAssets} a on a.id = m.asset_id where m.spot_id = ${spots.id} and a.kind = 'image' order by m.sort_order, m.id limit 1)`,
      ...pageCols,
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .leftJoin(spotPages, eq(spotPages.spotId, spots.id))
    .where(and(...conds))
    .orderBy(...(opts?.plainOrder ? [asc(spots.name)] : [tierSql, asc(spots.name)]))
    .limit(limit ?? 100_000);
  return rows.map(({ pagePublished, pagePaidFrom, pagePaidUntil, pageHandle, ...rest }) => {
    const page = pageOf({ pagePublished, pagePaidFrom, pagePaidUntil, pageHandle });
    return { ...rest, page, tier: tierOf({ promoted: rest.promoted, page }, today) };
  });
}

export interface RegionTypeCount {
  typeId: number;
  typeName: string;
  typeSlug: string;
  listed: boolean;
  count: number;
}

/** 지역 페이지 고유 데이터 블록 — 유형 분포. 비공개 유형도 집계로는 포함한다 (페이지에서 분리 렌더). */
export async function countSpotsByTypeInRegion(regionId: number): Promise<RegionTypeCount[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({
      typeId: spotTypes.id,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      listed: spotTypes.listed,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    // 돌봄 유형은 서비스 지역 기준으로 따로 센다 (queries/care.ts listCareCountsByRegion)
    .where(and(eq(spots.regionId, regionId), eq(spots.status, "operating"), notInArray(spotTypes.slug, [...CARE_TYPE_SLUGS])))
    .groupBy(spotTypes.id, spotTypes.name, spotTypes.slug, spotTypes.listed)
    .orderBy(sql`count(*) desc`);
}

/**
 * noindex 게이트용 카운트 — 샘플 픽스처 제외.
 * 지역 허브(유형 미지정)는 소비자 유형만 세고, 유형 명시 시(B2B 참고 포함) 그 유형을 센다.
 * 사이트맵 쿼리와 반드시 같은 기준을 유지한다.
 */
export async function countIndexableSpotsInRegion(regionId: number, typeId?: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const conds = [
    eq(spots.regionId, regionId),
    eq(spots.status, "operating"),
    ne(spots.source, "sample"),
  ];
  if (typeId) conds.push(eq(spots.typeId, typeId));
  else conds.push(eq(spotTypes.listed, true));
  const rows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(...conds));
  return rows[0]?.count ?? 0;
}

export interface TypeRegionCount {
  region: RegionRow;
  count: number;
}

/** 유형 허브(/spot/type/[slug]) — 전국 시군구별 분포. 영업 중만. */
export async function listRegionCountsForType(typeId: number): Promise<TypeRegionCount[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({ region: regions, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(eq(spots.typeId, typeId), eq(spots.status, "operating")))
    .groupBy(regions.id)
    .orderBy(regions.sidoName, sql`count(*) desc`, regions.sigunguName);
}

/** 지도용 지역 타일 전체 (id·이름·슬러그만, regions.id 순) */
export async function listRegionTiles(): Promise<RegionTile[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      id: regions.id,
      sidoName: regions.sidoName,
      sidoSlug: regions.sidoSlug,
      sigunguName: regions.sigunguName,
      sigunguSlug: regions.sigunguSlug,
    })
    .from(regions)
    .orderBy(asc(regions.id));
}

/** 지역 허브 지도 배지 — 시군구별 영업 중 스팟 수 (소비자 유형만) */
export async function listRegionTotals(): Promise<Record<number, number>> {
  if (!isDbConfigured()) return {};
  const rows = await getDb()
    .select({ regionId: spots.regionId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(eq(spots.status, "operating"), eq(spotTypes.listed, true)))
    .groupBy(spots.regionId);
  return Object.fromEntries(rows.map((r) => [r.regionId, r.count]));
}

export interface SigunguTypeCount {
  regionId: number;
  typeSlug: string;
  typeName: string;
  sortOrder: number;
  count: number;
}

/** 시도 페이지 유형 필터용 — 그 시도의 시군구 x 유형별 영업 중 스팟 수 (소비자 유형만, 돌봄 유형은 서비스 지역 기준으로 따로) */
export async function listSigunguTypeCounts(sidoSlug: string): Promise<SigunguTypeCount[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      regionId: spots.regionId,
      typeSlug: spotTypes.slug,
      typeName: spotTypes.name,
      sortOrder: spotTypes.sortOrder,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(
      and(
        eq(regions.sidoSlug, sidoSlug),
        eq(spots.status, "operating"),
        eq(spotTypes.listed, true),
        notInArray(spotTypes.slug, [...CARE_TYPE_SLUGS]),
      ),
    )
    .groupBy(spots.regionId, spotTypes.slug, spotTypes.name, spotTypes.sortOrder)
    .orderBy(asc(spotTypes.sortOrder));
}

/** 유형 허브 색인 게이트용 — 샘플 제외 전국 카운트 */
export async function countIndexableSpotsForType(typeId: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .where(and(eq(spots.typeId, typeId), eq(spots.status, "operating"), ne(spots.source, "sample")));
  return rows[0]?.count ?? 0;
}

/** 스팟의 유형이 공개(listed) 유형인지 — 집계 조인 조건용 EXISTS */
function listedTypeExists() {
  return sql`exists (select 1 from ${spotTypes} where ${spotTypes.id} = ${spots.typeId} and ${spotTypes.listed} = true)`;
}

export interface SidoSummary {
  sidoName: string;
  sidoSlug: string;
  sigunguCount: number;
  spotCount: number;
}

export async function listSidoSummaries(): Promise<SidoSummary[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({
      sidoName: regions.sidoName,
      sidoSlug: regions.sidoSlug,
      sigunguCount: sql<number>`count(distinct ${regions.id})`.mapWith(Number),
      spotCount: sql<number>`count(${spots.id})`.mapWith(Number),
    })
    .from(regions)
    .leftJoin(spots, and(eq(spots.regionId, regions.id), eq(spots.status, "operating"), listedTypeExists()))
    .groupBy(regions.sidoName, regions.sidoSlug)
    .orderBy(sql`count(${spots.id}) desc`, regions.sidoName);
}

export interface SigunguSummary {
  region: RegionRow;
  spotCount: number;
}

export async function listSigunguSummaries(sidoSlug: string): Promise<SigunguSummary[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      region: regions,
      spotCount: sql<number>`count(${spots.id})`.mapWith(Number),
    })
    .from(regions)
    .leftJoin(spots, and(eq(spots.regionId, regions.id), eq(spots.status, "operating"), listedTypeExists()))
    .where(eq(regions.sidoSlug, sidoSlug))
    .groupBy(regions.id)
    .orderBy(sql`count(${spots.id}) desc`, regions.sigunguName);
  return rows;
}

/** 지역 노령견 통계 — 최신 기준일 데이터만 */
export async function getRegionDogStats(regionId: number): Promise<{
  rows: Array<{ birthYear: number; registeredCount: number }>;
  referenceDate: string | null;
}> {
  if (!isDbConfigured()) return { rows: [], referenceDate: null };
  const db = getDb();
  const latest = await db
    .select({ referenceDate: sql<string>`max(${regionDogStats.referenceDate})` })
    .from(regionDogStats)
    .where(eq(regionDogStats.regionId, regionId));
  const referenceDate = latest[0]?.referenceDate ?? null;
  if (!referenceDate) return { rows: [], referenceDate: null };
  const rows = await db
    .select({ birthYear: regionDogStats.birthYear, registeredCount: regionDogStats.registeredCount })
    .from(regionDogStats)
    .where(and(eq(regionDogStats.regionId, regionId), eq(regionDogStats.referenceDate, referenceDate)));
  return { rows, referenceDate };
}

/** 여러 스팟의 링크 종류 — 목록 필터(예약 가능)와 카드 표시용 */
export async function listLinkKindsBySpot(spotIds: number[]): Promise<Map<number, string[]>> {
  if (!isDbConfigured() || spotIds.length === 0) return new Map();
  const out = new Map<number, string[]>();
  for (let i = 0; i < spotIds.length; i += 5000) {
    const rows = await getDb()
      .selectDistinct({ spotId: spotLinks.spotId, kind: spotLinks.kind })
      .from(spotLinks)
      .where(inArray(spotLinks.spotId, spotIds.slice(i, i + 5000)));
    for (const r of rows) out.set(r.spotId, [...(out.get(r.spotId) ?? []), r.kind]);
  }
  return out;
}

/** 유형별 영업 중 스팟 수 (전국 또는 한 시도) — 스팟 첫 화면·시도 페이지의 유형 묶음 카드 */
export async function countSpotsByType(sidoSlug?: string): Promise<Map<string, number>> {
  if (!isDbConfigured()) return new Map();
  const conds = [eq(spots.status, "operating")];
  if (sidoSlug) conds.push(eq(regions.sidoSlug, sidoSlug));
  const rows = await getDb()
    .select({ slug: spotTypes.slug, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(...conds))
    .groupBy(spotTypes.slug);
  return new Map(rows.map((r) => [r.slug, r.count]));
}

/** 시도 x 유형 — 색인 게이트용 (샘플 제외, 영업 중) */
export async function countIndexableSpotsInSido(sidoSlug: string, typeId: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(eq(regions.sidoSlug, sidoSlug), eq(spots.typeId, typeId), eq(spots.status, "operating"), ne(spots.source, "sample")));
  return rows[0]?.count ?? 0;
}

/** 시도 x 유형별 영업 중 수 — 전국 유형 페이지의 시도 카드 (돌봄 유형 제외) */
export async function countTypeBySido(typeId: number): Promise<Array<{ sidoSlug: string; sidoName: string; count: number }>> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ sidoSlug: regions.sidoSlug, sidoName: regions.sidoName, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(eq(spots.typeId, typeId), eq(spots.status, "operating")))
    .groupBy(regions.sidoSlug, regions.sidoName)
    .orderBy(sql`count(*) desc`);
}
