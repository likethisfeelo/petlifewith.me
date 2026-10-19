// 업체 링크 페이지 조회·통계 — 순수 규칙은 lib/spot-pages.ts
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { isPaidActive, todayKst, type SpotTier } from "../spot-pages";
import { getSpotLinks, type RegionRow, type SpotLinkRow, type SpotRow } from "./spots";

const { spots, spotTypes, regions, spotPages, spotMedia, mediaAssets, promotions, spotPageStats } = schema;

export type SpotPageRow = typeof spotPages.$inferSelect;

export interface SpotMediaItem {
  id: number;
  assetId: number;
  kind: "image" | "video";
  objectKey: string;
  posterKey: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface LinkPageData {
  spot: SpotRow;
  typeName: string;
  typeSlug: string;
  typeMonetizable: boolean;
  region: RegionRow;
  page: SpotPageRow;
  paid: boolean;
  tier: SpotTier;
  links: SpotLinkRow[];
  media: SpotMediaItem[];
}

export async function getSpotPage(spotId: number): Promise<SpotPageRow | null> {
  if (!isDbConfigured()) return null;
  return (await getDb().select().from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0] ?? null;
}

export async function listSpotMedia(spotId: number): Promise<SpotMediaItem[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      id: spotMedia.id,
      assetId: spotMedia.assetId,
      kind: mediaAssets.kind,
      objectKey: mediaAssets.objectKey,
      posterKey: mediaAssets.posterKey,
      width: mediaAssets.width,
      height: mediaAssets.height,
      sortOrder: spotMedia.sortOrder,
    })
    .from(spotMedia)
    .innerJoin(mediaAssets, eq(spotMedia.assetId, mediaAssets.id))
    .where(eq(spotMedia.spotId, spotId))
    .orderBy(asc(spotMedia.sortOrder), asc(spotMedia.id));
}

/** 링크 페이지 — 번호 또는 짧은 주소. 공개된 페이지만 */
export async function getLinkPage(key: { kind: "id"; id: number } | { kind: "handle"; handle: string }): Promise<LinkPageData | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const row = (
    await db
      .select({
        spot: spots,
        typeName: spotTypes.name,
        typeSlug: spotTypes.slug,
        typeMonetizable: spotTypes.monetizable,
        region: regions,
        page: spotPages,
        promoted: sql<boolean>`exists (select 1 from ${promotions} p where p.spot_id = ${spots.id} and p.active = true and p.kind = 'region_top')`,
      })
      .from(spotPages)
      .innerJoin(spots, eq(spotPages.spotId, spots.id))
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(and(key.kind === "id" ? eq(spotPages.spotId, key.id) : eq(spotPages.handle, key.handle), eq(spotPages.published, true)))
      .limit(1)
  )[0];
  if (!row) return null;
  const paid = row.typeMonetizable && isPaidActive(row.page);
  const [links, media] = await Promise.all([getSpotLinks(row.spot.id), paid ? listSpotMedia(row.spot.id) : Promise.resolve([])]);
  const { promoted, ...rest } = row;
  return { ...rest, paid, tier: promoted && row.typeMonetizable ? "promoted" : paid ? "paid" : "free", links, media };
}

// ---------- 통계 ----------

/** 조회·클릭 하나 더 (한국 날짜). 링크 페이지가 있는 업체만 */
export async function recordSpotPageStat(spotId: number, kind: "view" | "click"): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const exists = (await db.select({ id: spotPages.spotId }).from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0];
  if (!exists) return false;
  const day = todayKst();
  await db
    .insert(spotPageStats)
    .values({ spotId, day, views: kind === "view" ? 1 : 0, clicks: kind === "click" ? 1 : 0 })
    .onConflictDoUpdate({
      target: [spotPageStats.spotId, spotPageStats.day],
      set: kind === "view" ? { views: sql`${spotPageStats.views} + 1` } : { clicks: sql`${spotPageStats.clicks} + 1` },
    });
  return true;
}

export interface SpotPageStatsSummary {
  days: Array<{ day: string; views: number; clicks: number }>;
  monthViews: number;
  monthClicks: number;
  totalViews: number;
  totalClicks: number;
}

/** 최근 30일 + 이번 달 + 전체 */
export async function getSpotPageStats(spotId: number): Promise<SpotPageStatsSummary> {
  const empty = { days: [], monthViews: 0, monthClicks: 0, totalViews: 0, totalClicks: 0 };
  if (!isDbConfigured()) return empty;
  const db = getDb();
  const today = todayKst();
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 29);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [days, totals] = await Promise.all([
    db
      .select({ day: spotPageStats.day, views: spotPageStats.views, clicks: spotPageStats.clicks })
      .from(spotPageStats)
      .where(and(eq(spotPageStats.spotId, spotId), gte(spotPageStats.day, since.toISOString().slice(0, 10))))
      .orderBy(desc(spotPageStats.day)),
    db
      .select({
        totalViews: sql<number>`coalesce(sum(${spotPageStats.views}), 0)`.mapWith(Number),
        totalClicks: sql<number>`coalesce(sum(${spotPageStats.clicks}), 0)`.mapWith(Number),
        monthViews: sql<number>`coalesce(sum(${spotPageStats.views}) filter (where ${spotPageStats.day} >= ${monthStart}), 0)`.mapWith(Number),
        monthClicks: sql<number>`coalesce(sum(${spotPageStats.clicks}) filter (where ${spotPageStats.day} >= ${monthStart}), 0)`.mapWith(Number),
      })
      .from(spotPageStats)
      .where(eq(spotPageStats.spotId, spotId)),
  ]);
  return { days, ...(totals[0] ?? empty) };
}
