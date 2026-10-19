// 사이트맵 전용 쿼리 — 색인 가능한 URL 만 내보낸다.
// noindex 게이트(lib/seo.ts)와 반드시 같은 기준을 쓴다: 게이트에 걸리는 페이지는
// 사이트맵에도 넣지 않는다.
import { and, eq, gte, inArray, ne, notInArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { MIN_PLACE_INFO_ITEMS, MIN_SPOTS_FOR_INDEX, placeInfoItemCount, shouldIndexBoard, shouldIndexGuide } from "../seo";
import { CARE_TYPE_SLUGS, categoriesForTopic } from "@app/data";
import { countRehabSites, countRehabSitesByModality } from "./rehab";
import { resultRows } from "./tags";
import { listIndexableDevices } from "./devices";

const {
  guides,
  topics,
  spots,
  spotTypes,
  regions,
  makers,
  items,
  guideItemTags,
  curations,
  curationEntries,
  newsPosts,
  spotLinks,
  spotServiceAreas,
} = schema;

export interface SitemapEntry {
  path: string;
  lastModified?: Date;
}

export async function sitemapGuides(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ slug: guides.slug, updatedAt: guides.updatedAt, bodyMd: guides.bodyMd })
    .from(guides)
    .where(eq(guides.status, "published"));
  // 본문이 짧은 글은 페이지도 noindex 라 사이트맵에서도 뺀다 (같은 게이트)
  return rows.filter((r) => shouldIndexGuide(r.bodyMd)).map((r) => ({ path: `/guide/${r.slug}`, lastModified: r.updatedAt }));
}

/** 카테고리 게시판 (/topic/[토픽]/[카테고리]) — 발행 글 3편 이상인 조합만 */
export async function sitemapCategoryBoards(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ topicSlug: topics.slug, category: guides.category, count: sql<number>`count(*)`.mapWith(Number) })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .where(eq(guides.status, "published"))
    .groupBy(topics.slug, guides.category);
  return rows
    .filter((r) => r.category && shouldIndexBoard(r.count) && categoriesForTopic(r.topicSlug).some((c) => c.slug === r.category))
    .map((r) => ({ path: `/topic/${r.topicSlug}/${r.category}` }));
}

/** 토픽 게시판 — 큐레이션(/curated)·일반 게시판(/challenge, 회원 글). 각각 발행 글 3편 이상인 토픽만 */
export async function sitemapTopicBoards(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({
      topicSlug: topics.slug,
      curated: sql<number>`count(*) filter (where ${guides.curated} = true)`.mapWith(Number),
      challenge: sql<number>`count(*) filter (where ${guides.authorUserId} is not null)`.mapWith(Number),
    })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .where(eq(guides.status, "published"))
    .groupBy(topics.slug);
  const out: SitemapEntry[] = [];
  for (const r of rows) {
    if (shouldIndexBoard(r.curated)) out.push({ path: `/topic/${r.topicSlug}/curated` });
    if (shouldIndexBoard(r.challenge)) out.push({ path: `/topic/${r.topicSlug}/challenge` });
  }
  return out;
}

/** 태그 페이지 — 발행 글 3편 이상인 태그만 */
export async function sitemapTags(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const rows = resultRows<{ tag: string; count: number }>(
    await getDb().execute(sql`
      select t as tag, count(*)::int as count
      from ${guides}, unnest(${guides.tags}) as t
      where ${guides.status} = 'published'
      group by t
    `),
  );
  return rows.filter((r) => shouldIndexBoard(Number(r.count))).map((r) => ({ path: `/tag/${encodeURIComponent(r.tag)}` }));
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

  // 주소 기준 유형 집계는 돌봄 유형을 뺀다 — 돌봄은 아래에서 서비스 지역 기준으로 센다 (페이지 게이트와 같은 기준)
  const notCare = notInArray(spotTypes.slug, [...CARE_TYPE_SLUGS]);
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
    // 지역x유형 페이지는 B2B 참고 유형도 게시된다 — 게이트(3곳)만 동일 적용
    .where(and(indexableSpot, notCare))
    .groupBy(regions.sidoSlug, regions.sigunguSlug, spotTypes.slug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  // 시도 x 유형(/spot/[시도]/[유형]) — 같은 게이트
  const sidoTypeCounts = await db
    .select({ sidoSlug: regions.sidoSlug, typeSlug: spotTypes.slug, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(indexableSpot, notCare))
    .groupBy(regions.sidoSlug, spotTypes.slug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  // 유형 허브(/spot/type/[slug]) — B2B 참고 유형 포함, 색인 가능 스팟 3곳 이상만
  const typeTotals = await db
    .select({ typeSlug: spotTypes.slug, count: sql<number>`count(*)`.mapWith(Number) })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(and(indexableSpot, notCare))
    .groupBy(spotTypes.slug)
    .having(gte(sql`count(*)`, MIN_SPOTS_FOR_INDEX));

  // 돌봄 파트너 — 서비스 지역(노출 ON) 기준, 예시 제외 (countIndexableCareProviders 와 같은 기준)
  const indexableCare = and(indexableSpot, eq(spotServiceAreas.exposed, true), inArray(spotTypes.slug, [...CARE_TYPE_SLUGS]));
  const careRegionCounts = await db
    .select({
      sidoSlug: regions.sidoSlug,
      sigunguSlug: regions.sigunguSlug,
      typeSlug: spotTypes.slug,
      count: sql<number>`count(distinct ${spots.id})`.mapWith(Number),
    })
    .from(spotServiceAreas)
    .innerJoin(spots, eq(spotServiceAreas.spotId, spots.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spotServiceAreas.regionId, regions.id))
    .where(indexableCare)
    .groupBy(regions.sidoSlug, regions.sigunguSlug, spotTypes.slug)
    .having(gte(sql`count(distinct ${spots.id})`, MIN_SPOTS_FOR_INDEX));
  const careTypeTotals = await db
    .select({ typeSlug: spotTypes.slug, count: sql<number>`count(distinct ${spots.id})`.mapWith(Number) })
    .from(spotServiceAreas)
    .innerJoin(spots, eq(spotServiceAreas.spotId, spots.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .where(indexableCare)
    .groupBy(spotTypes.slug)
    .having(gte(sql`count(distinct ${spots.id})`, MIN_SPOTS_FOR_INDEX));

  const sidoWithAny = new Set(regionCounts.map((r) => r.sidoSlug));

  return [
    { path: "/spot" },
    ...typeTotals.map((t) => ({ path: `/spot/type/${t.typeSlug}` })),
    ...careTypeTotals.map((t) => ({ path: `/spot/type/${t.typeSlug}` })),
    ...[...sidoWithAny].map((s) => ({ path: `/spot/${s}` })),
    ...sidoTypeCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.typeSlug}` })),
    ...regionCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.sigunguSlug}` })),
    ...regionTypeCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.sigunguSlug}/${r.typeSlug}` })),
    ...careRegionCounts.map((r) => ({ path: `/spot/${r.sidoSlug}/${r.sigunguSlug}/${r.typeSlug}` })),
  ];
}

/** 개별 장소 — 영업 중 + 비샘플 + 정보 3항목 이상만 (링크도 정보 항목으로 센다) */
export async function sitemapPlaces(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ spot: spots })
    .from(spots)
    .where(and(eq(spots.status, "operating"), ne(spots.source, "sample")));
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

/** 뉴스 — 발행된 글 전부 (관리자만 쓰므로 품질 게이트가 따로 없다) */
export async function sitemapNews(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ slug: newsPosts.slug, updatedAt: newsPosts.updatedAt })
    .from(newsPosts)
    .where(eq(newsPosts.status, "published"));
  return rows.map((n) => ({ path: `/news/${n.slug}`, lastModified: n.updatedAt }));
}

/** 재활·한방·특수치료 — 허브와 치료법 페이지. 시행처 3곳 이상인 것만 (지역 페이지와 같은 게이트) */
export async function sitemapRehab(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const [total, byModality] = await Promise.all([countRehabSites(), countRehabSitesByModality()]);
  const entries: SitemapEntry[] = [];
  if (total >= MIN_SPOTS_FOR_INDEX) entries.push({ path: "/rehab" });
  for (const [slug, count] of byModality) {
    if (count >= MIN_SPOTS_FOR_INDEX) entries.push({ path: `/rehab/${slug}` });
  }
  return entries;
}

/** 관리·재활 도구 — 공개 + 원리 설명이 충분한 기기와 허브 (얇은 페이지 방지) */
export async function sitemapDevices(): Promise<SitemapEntry[]> {
  if (!isDbConfigured()) return [];
  const devices = await listIndexableDevices();
  if (devices.length === 0) return [];
  return [{ path: "/device" }, ...devices.map((d) => ({ path: `/device/${encodeURIComponent(d.slug)}`, lastModified: d.updatedAt }))];
}
