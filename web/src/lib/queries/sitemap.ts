// 사이트맵 전용 쿼리 — 색인 가능한 URL 만 내보낸다.
// noindex 게이트(lib/seo.ts)와 반드시 같은 기준을 쓴다: 게이트에 걸리는 페이지는
// 사이트맵에도 넣지 않는다.
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { MIN_PLACE_INFO_ITEMS, MIN_SPOTS_FOR_INDEX, placeInfoItemCount } from "../seo";

const { guides, topics, spots, spotTypes, regions, makers, items, guideItemTags, curations, curationEntries, spotLinks } =
  schema;

export interface SitemapEntry {
  path: string;
  lastModified?: Date;
}

export async function sitemapGuides(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ slug: guides.slug, updatedAt: guides.updatedAt })
    .from(guides)
    .where(eq(guides.status, "published"));
  return rows.map((r) => ({ path: `/guide/${r.slug}`, lastModified: r.updatedAt }));
}

export async function sitemapTopics(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ slug: topics.slug, count: sql<number>`count(${guides.id})`.mapWith(Number) })
    .from(topics)
    .leftJoin(guides, and(eq(guides.topicId, topics.id), eq(guides.status, "published")))
    .groupBy(topics.slug);
  return rows.filter((r) => r.count > 0).map((r) => ({ path: `/topic/${r.slug}` }));
}

/** 지역 허브 + 지역x유형 — 색인 가능 스팟 3곳 이상인 조합만 */
export async function sitemapRegions(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const indexableSpot = and(eq(spots.status, "operating"), ne(spots.source, "sample"));

  const regionCounts = await db
    .select({
      sidoSlug: regions.sidoSlug,
      sigunguSlug: regions.sigunguSlug,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(indexableSpot, eq(spotTypes.listed, true)))
    .groupBy(regions.sidoSlug, regions.sigunguSlug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  const regionTypeCounts = await db
    .select({
      sidoSlug: regions.sidoSlug,
      sigunguSlug: regions.sigunguSlug,
      typeSlug: spotTypes.slug,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(indexableSpot, eq(spotTypes.listed, true)))
    .groupBy(regions.sidoSlug, regions.sigunguSlug, spotTypes.slug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  // 유형 허브(/spot/type/[slug]) — 색인 가능 스팟 3곳 이상인 공개 유형만
  const typeTotals = await db
    .select({ typeSlug: spotTypes.slug, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(indexableSpot, eq(spotTypes.listed, true)))
    .groupBy(spotTypes.slug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  const sidoWithAny = new Set(regionCounts.map((r) => r.sidoSlug));

  return [
    { path: "/spot" },
    ...typeTotals.map((t) => ({ path: `/spot/type/${t.typeSlug}` })),
    ...[...sidoWithAny].map((s) => ({ path: `/spot/${s}` })),
    ...regionCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.sigunguSlug}` })),
    ...regionTypeCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.sigunguSlug}/${r.typeSlug}` })),
  ];
}

/** 개별 장소 — 영업 중 + 비샘플 + 공개 유형 + 정보 3항목 이상만 (링크도 정보 항목으로 센다) */
export async function sitemapPlaces(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ spot: spots })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(eq(spots.status, "operating"), ne(spots.source, "sample"), eq(spotTypes.listed, true)));
  if (rows.length === 0) return [];

  const linkCounts = await db
    .select({ spotId: spotLinks.spotId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spotLinks)
    .groupBy(spotLinks.spotId);
  const byId = new Map(linkCounts.map((r) => [r.spotId, r.count]));

  return rows
    .map((r) => r.spot)
    .filter((s) => placeInfoItemCount(s, byId.get(s.id) ?? 0) >= MIN_PLACE_INFO_ITEMS)
    .map((s) => ({ path: `/place/${s.id}-${encodeURIComponent(s.slug)}`, lastModified: s.updatedAt }));
}

export async function sitemapMakers(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ id: makers.id, slug: makers.slug, storyMd: makers.storyMd, updatedAt: makers.updatedAt })
    .from(makers)
    .where(eq(makers.status, "published"));
  return rows
    .filter((m) => m.storyMd && m.storyMd.trim().length > 0)
    .map((m) => ({ path: `/maker/${m.id}-${encodeURIComponent(m.slug)}`, lastModified: m.updatedAt }));
}

/** 상품 — 발행 글에서 한 번이라도 언급된 것만 (역참조가 본질) */
export async function sitemapItems(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .selectDistinct({ id: items.id, slug: items.slug, updatedAt: items.updatedAt })
    .from(items)
    .innerJoin(guideItemTags, eq(guideItemTags.itemId, items.id))
    .innerJoin(guides, eq(guideItemTags.guideId, guides.id))
    .where(eq(guides.status, "published"));
  return rows.map((i) => ({ path: `/item/${i.id}-${encodeURIComponent(i.slug)}`, lastModified: i.updatedAt }));
}

export async function sitemapCurations(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      themeSlug: curations.themeSlug,
      updatedAt: curations.updatedAt,
      entryCount: sql<number>`count(${curationEntries.id})`.mapWith(Number),
    })
    .from(curations)
    .leftJoin(curationEntries, eq(curationEntries.curationId, curations.id))
    .where(eq(curations.status, "published"))
    .groupBy(curations.id);
  return rows
    .filter((c) => c.entryCount > 0)
    .map((c) => ({ path: `/curation/${c.themeSlug}`, lastModified: c.updatedAt }));
}
