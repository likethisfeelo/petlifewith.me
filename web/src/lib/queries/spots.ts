import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { spots, spotTypes, regions, promotions, regionDogStats, spotLinks } = schema;

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
}

/** 공개 노출 유형만 (listed). 관리자 화면은 includeUnlisted 로 B2B 유형까지 본다. */
export async function listSpotTypes(opts?: { includeUnlisted?: boolean }): Promise<SpotTypeRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  if (opts?.includeUnlisted) return db.select().from(spotTypes).orderBy(spotTypes.sortOrder);
  return db.select().from(spotTypes).where(eq(spotTypes.listed, true)).orderBy(spotTypes.sortOrder);
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
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(eq(spots.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, promoted: false };
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
export async function listSpotsInRegion(regionId: number, typeId?: number, limit?: number): Promise<SpotWithMeta[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  // 공개 목록 — 비공개 유형(B2B 인허가)은 제외한다
  const conds = [eq(spots.regionId, regionId), eq(spots.status, "operating"), eq(spotTypes.listed, true)];
  if (typeId) conds.push(eq(spots.typeId, typeId));
  const rows = await db
    .select({
      spot: spots,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      typeMonetizable: spotTypes.monetizable,
      typeListed: spotTypes.listed,
      region: regions,
      promoted: sql<boolean>`exists (
        select 1 from ${promotions} p
        where p.spot_id = ${spots.id} and p.active = true and p.kind = 'region_top'
      )`,
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(...conds))
    .orderBy(sql`case when exists (
        select 1 from ${promotions} p
        where p.spot_id = ${spots.id} and p.active = true and p.kind = 'region_top'
      ) then 0 else 1 end`, asc(spots.name))
    .limit(limit ?? 100_000);
  return rows;
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
    .where(and(eq(spots.regionId, regionId), eq(spots.status, "operating")))
    .groupBy(spotTypes.id, spotTypes.name, spotTypes.slug, spotTypes.listed)
    .orderBy(sql`count(*) desc`);
}

/** noindex 게이트용 카운트 — 샘플 픽스처·비공개 유형 제외 (색인 판단은 공개 실데이터만) */
export async function countIndexableSpotsInRegion(regionId: number, typeId?: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const conds = [
    eq(spots.regionId, regionId),
    eq(spots.status, "operating"),
    ne(spots.source, "sample"),
    eq(spotTypes.listed, true),
  ];
  if (typeId) conds.push(eq(spots.typeId, typeId));
  const rows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(...conds));
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
