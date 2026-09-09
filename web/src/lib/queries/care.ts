// ============================================================
// 돌봄 파트너(펫시터·펫산책) 조회 — 서비스 지역(spot_service_areas) 기준
//
// 시설 디렉토리는 spots.region_id(주소)로 묶지만, 돌봄 파트너는 사람이 움직이므로
// 서비스 지역 목록으로 노출된다. 공개 조회는 exposed=true 지역만, 영업 중만.
// 지역 x 유형당 자리는 MAX_EXPOSED_PER_AREA(5) — 관리자 액션이 강제한다.
// ============================================================
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { plainExcerpt, providersInArea, type CareArea, type CareProvider, type CareRegion } from "../care";
import { listRegionTiles } from "./spots";

const { spots, spotTypes, regions, spotLinks, spotServiceAreas } = schema;

export type { CareArea, CareProvider, CareRegion } from "../care";
export { plainExcerpt, providersInArea } from "../care";

export async function listCareRegions(): Promise<CareRegion[]> {
  return listRegionTiles();
}

/**
 * 유형의 파트너 전체. 공개(기본)는 영업 중 + 노출 지역이 하나 이상인 파트너만, 지역도 노출된 것만 담는다.
 * includeHidden 은 관리자용 — 상태·노출과 무관하게 전부.
 */
export async function listCareProviders(typeId: number, opts?: { includeHidden?: boolean }): Promise<CareProvider[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const includeHidden = opts?.includeHidden ?? false;
  const conds = [eq(spots.typeId, typeId)];
  if (!includeHidden) conds.push(eq(spots.status, "operating"));
  const rows = await db
    .select({ spot: spots, typeSlug: spotTypes.slug, typeName: spotTypes.name })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(...conds))
    .orderBy(asc(spots.name));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.spot.id);

  const [areaRows, linkRows] = await Promise.all([
    db
      .select()
      .from(spotServiceAreas)
      .where(inArray(spotServiceAreas.spotId, ids))
      .orderBy(asc(spotServiceAreas.sortOrder), asc(spotServiceAreas.id)),
    db
      .select()
      .from(spotLinks)
      .where(and(inArray(spotLinks.spotId, ids), inArray(spotLinks.kind, ["kakao", "reservation"])))
      .orderBy(asc(spotLinks.sortOrder)),
  ]);
  const areasBySpot = new Map<number, CareArea[]>();
  for (const a of areaRows) {
    if (!includeHidden && !a.exposed) continue;
    const list = areasBySpot.get(a.spotId) ?? [];
    list.push({ regionId: a.regionId, exposed: a.exposed, sortOrder: a.sortOrder });
    areasBySpot.set(a.spotId, list);
  }
  const linkBySpot = new Map<number, { kakao?: string; reservation?: string }>();
  for (const l of linkRows) {
    const cur = linkBySpot.get(l.spotId) ?? {};
    if (l.kind === "kakao" && !cur.kakao) cur.kakao = l.url;
    if (l.kind === "reservation" && !cur.reservation) cur.reservation = l.url;
    linkBySpot.set(l.spotId, cur);
  }

  const out: CareProvider[] = [];
  for (const r of rows) {
    const areas = areasBySpot.get(r.spot.id) ?? [];
    if (!includeHidden && areas.length === 0) continue;
    const links = linkBySpot.get(r.spot.id) ?? {};
    out.push({
      id: r.spot.id,
      slug: r.spot.slug,
      name: r.spot.name,
      typeSlug: r.typeSlug,
      typeName: r.typeName,
      source: r.spot.source,
      status: r.spot.status,
      intro: plainExcerpt(r.spot.descriptionMd),
      priceText: r.spot.priceText,
      hoursText: r.spot.hoursText,
      dataReferenceDate: r.spot.dataReferenceDate,
      homeRegionId: r.spot.regionId,
      areas,
      kakaoUrl: links.kakao ?? null,
      reservationUrl: links.reservation ?? null,
    });
  }
  return out;
}

export async function listCareProvidersInArea(typeId: number, regionId: number): Promise<CareProvider[]> {
  return providersInArea(await listCareProviders(typeId), regionId);
}

/** 지역 x 유형의 노출 중인 파트너 수 (관리자 자리 검사 — excludeSpotId 로 자기 자신은 뺀다) */
export async function countExposedInArea(typeId: number, regionId: number, excludeSpotId?: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const conds = [eq(spotServiceAreas.regionId, regionId), eq(spotServiceAreas.exposed, true), eq(spots.typeId, typeId)];
  if (excludeSpotId) conds.push(ne(spots.id, excludeSpotId));
  const rows = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(spotServiceAreas)
    .innerJoin(spots, eq(spotServiceAreas.spotId, spots.id))
    .where(and(...conds));
  return rows[0]?.count ?? 0;
}

/** 색인 게이트용 — 영업 중·샘플 아님·노출 지역 하나 이상인 파트너 수 */
export async function countIndexableCareProviders(typeId: number, regionId?: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const conds = [eq(spots.typeId, typeId), eq(spots.status, "operating"), ne(spots.source, "sample"), eq(spotServiceAreas.exposed, true)];
  if (regionId) conds.push(eq(spotServiceAreas.regionId, regionId));
  const rows = await getDb()
    .select({ count: sql<number>`count(distinct ${spots.id})`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotServiceAreas, eq(spotServiceAreas.spotId, spots.id))
    .where(and(...conds));
  return rows[0]?.count ?? 0;
}

export interface SpotServiceArea {
  id: number;
  regionId: number;
  exposed: boolean;
  sortOrder: number;
  sidoName: string;
  sigunguName: string;
  sidoSlug: string;
  sigunguSlug: string;
}

/** 한 파트너의 서비스 지역 (관리자·개별 페이지용 — 노출 여부 포함) */
export async function listServiceAreasForSpot(spotId: number): Promise<SpotServiceArea[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      id: spotServiceAreas.id,
      regionId: spotServiceAreas.regionId,
      exposed: spotServiceAreas.exposed,
      sortOrder: spotServiceAreas.sortOrder,
      sidoName: regions.sidoName,
      sigunguName: regions.sigunguName,
      sidoSlug: regions.sidoSlug,
      sigunguSlug: regions.sigunguSlug,
    })
    .from(spotServiceAreas)
    .innerJoin(regions, eq(spotServiceAreas.regionId, regions.id))
    .where(eq(spotServiceAreas.spotId, spotId))
    .orderBy(asc(spotServiceAreas.sortOrder), asc(spotServiceAreas.id));
}
