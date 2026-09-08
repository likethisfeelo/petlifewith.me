import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { orderForTopic } from "../guide-order";

const { guides, topics, users, guideItemTags, guideSpotTags, guideMakerTags, guideDeviceTags } = schema;
const { items, itemOffers, makers, spots, spotTypes, regions, deviceModels, deviceSites } = schema;

export type GuideRow = typeof guides.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;

/** 목록 항목 — 회원 글이면 닉네임이 붙는다 (이메일 등 다른 정보는 절대 싣지 않는다) */
export interface GuideListItem {
  guide: GuideRow;
  authorName: string | null;
}

export async function listTopics(): Promise<TopicRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db.select().from(topics).orderBy(topics.sortOrder);
}

export async function getTopicBySlug(slug: string): Promise<TopicRow | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPublishedGuide(
  slug: string,
): Promise<{ guide: GuideRow; topic: TopicRow; authorName: string | null } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ guide: guides, topic: topics, authorName: users.displayName })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .leftJoin(users, eq(guides.authorUserId, users.id))
    .where(and(eq(guides.slug, slug), eq(guides.status, "published")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { guide: row.guide, topic: row.topic, authorName: row.guide.authorUserId ? row.authorName : null };
}

/**
 * 토픽 허브 목록 (발행분만).
 *  - hub: 클러스터 전체 지도 (별도 카드)
 *  - items: 허브를 뺀 글을 "최상단 고정(1~3) → 최신순" 으로 정렬 (lib/guide-order.ts)
 *  - byCategory: 카테고리별 목록 (신체 지도 패널용). 카테고리 없는 글은 "전체"에만 있다.
 */
export async function listGuidesForTopic(topicId: number): Promise<{
  hub: GuideRow | null;
  items: GuideListItem[];
  byCategory: Map<string, GuideListItem[]>;
  all: GuideRow[];
}> {
  if (!isDbConfigured()) return { hub: null, items: [], byCategory: new Map(), all: [] };
  const db = getDb();
  const rows = await db
    .select({ guide: guides, authorName: users.displayName })
    .from(guides)
    .leftJoin(users, eq(guides.authorUserId, users.id))
    .where(and(eq(guides.topicId, topicId), eq(guides.status, "published")))
    .orderBy(desc(guides.publishedAt));
  const hub = rows.find((r) => r.guide.role === "hub")?.guide ?? null;
  const spokes = rows
    .filter((r) => r.guide.role !== "hub")
    .map((r) => ({ guide: r.guide, authorName: r.guide.authorUserId ? r.authorName : null }));
  const ordered = orderForTopic(spokes.map((r) => ({ ...r, id: r.guide.id, pinnedOrder: r.guide.pinnedOrder, publishedAt: r.guide.publishedAt })));
  const items: GuideListItem[] = ordered.map(({ guide, authorName }) => ({ guide, authorName }));
  const byCategory = new Map<string, GuideListItem[]>();
  for (const item of items) {
    if (!item.guide.category) continue;
    const list = byCategory.get(item.guide.category) ?? [];
    list.push(item);
    byCategory.set(item.guide.category, list);
  }
  return { hub, items, byCategory, all: rows.map((r) => r.guide) };
}

export async function latestPublishedGuides(limit: number): Promise<Array<{ guide: GuideRow; topic: TopicRow }>> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select({ guide: guides, topic: topics })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .where(eq(guides.status, "published"))
    .orderBy(desc(guides.publishedAt))
    .limit(limit);
}

/** 내부링크 자동 생성 — 같은 클러스터의 다른 발행 글 (허브 우선) */
export async function relatedGuides(guideId: number, topicId: number, limit = 6): Promise<GuideRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(guides)
    .where(and(eq(guides.topicId, topicId), eq(guides.status, "published"), ne(guides.id, guideId)))
    .orderBy(sql`case when ${guides.role} = 'hub' then 0 else 1 end`, desc(guides.publishedAt))
    .limit(limit);
}

// ---------- 개체 단위 태깅 (기획서 SECTION 01 — 오늘의집에서 가져온 것 하나) ----------

export interface TaggedItem {
  contextLabel: string | null;
  item: typeof items.$inferSelect;
  makerName: string | null;
  offers: Array<typeof itemOffers.$inferSelect>;
}

export interface TaggedSpot {
  contextLabel: string | null;
  spot: typeof spots.$inferSelect;
  typeName: string;
  typeSlug: string;
  sidoName: string;
  sigunguName: string;
}

export interface TaggedMaker {
  contextLabel: string | null;
  maker: typeof makers.$inferSelect;
}

export interface TaggedDevice {
  device: typeof deviceModels.$inferSelect;
  sites: Array<{ facilityName: string; sigunguName: string | null; sidoName: string | null; verifiedAt: string | null }>;
}

export interface GuideEntityTags {
  items: TaggedItem[];
  spots: TaggedSpot[];
  makers: TaggedMaker[];
  devices: TaggedDevice[];
  hasAffiliateOffers: boolean;
}

export async function getGuideEntityTags(guideId: number): Promise<GuideEntityTags> {
  if (!isDbConfigured()) return { items: [], spots: [], makers: [], devices: [], hasAffiliateOffers: false };
  const db = getDb();

  const itemRows = await db
    .select({ tag: guideItemTags, item: items, makerName: makers.name })
    .from(guideItemTags)
    .innerJoin(items, eq(guideItemTags.itemId, items.id))
    .leftJoin(makers, eq(items.makerId, makers.id))
    .where(eq(guideItemTags.guideId, guideId))
    .orderBy(guideItemTags.sortOrder);

  const offerRows =
    itemRows.length > 0
      ? await db
          .select()
          .from(itemOffers)
          .where(inArray(itemOffers.itemId, itemRows.map((r) => r.item.id)))
          .orderBy(itemOffers.sortOrder)
      : [];

  const spotRows = await db
    .select({
      tag: guideSpotTags,
      spot: spots,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      sidoName: regions.sidoName,
      sigunguName: regions.sigunguName,
    })
    .from(guideSpotTags)
    .innerJoin(spots, eq(guideSpotTags.spotId, spots.id))
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(eq(guideSpotTags.guideId, guideId))
    .orderBy(guideSpotTags.sortOrder);

  const makerRows = await db
    .select({ tag: guideMakerTags, maker: makers })
    .from(guideMakerTags)
    .innerJoin(makers, eq(guideMakerTags.makerId, makers.id))
    .where(eq(guideMakerTags.guideId, guideId))
    .orderBy(guideMakerTags.sortOrder);

  const deviceRows = await db
    .select({ device: deviceModels })
    .from(guideDeviceTags)
    .innerJoin(deviceModels, eq(guideDeviceTags.deviceModelId, deviceModels.id))
    .where(eq(guideDeviceTags.guideId, guideId))
    .orderBy(guideDeviceTags.sortOrder);

  const devices: TaggedDevice[] = [];
  for (const { device } of deviceRows) {
    const sites = await db
      .select({
        facilityName: deviceSites.facilityName,
        sigunguName: regions.sigunguName,
        sidoName: regions.sidoName,
        verifiedAt: deviceSites.verifiedAt,
      })
      .from(deviceSites)
      .leftJoin(regions, eq(deviceSites.regionId, regions.id))
      .where(eq(deviceSites.deviceModelId, device.id))
      .orderBy(deviceSites.facilityName);
    devices.push({ device, sites });
  }

  const taggedItems: TaggedItem[] = itemRows.map((r) => ({
    contextLabel: r.tag.contextLabel,
    item: r.item,
    makerName: r.makerName,
    offers: offerRows.filter((o) => o.itemId === r.item.id),
  }));

  return {
    items: taggedItems,
    spots: spotRows.map((r) => ({
      contextLabel: r.tag.contextLabel,
      spot: r.spot,
      typeName: r.typeName,
      typeSlug: r.typeSlug,
      sidoName: r.sidoName,
      sigunguName: r.sigunguName,
    })),
    makers: makerRows.map((r) => ({ contextLabel: r.tag.contextLabel, maker: r.maker })),
    devices,
    hasAffiliateOffers: offerRows.some((o) => o.isAffiliate),
  };
}

// ---------- 역참조 (태깅 데이터가 쌓이면 자동 생성되는 역방향 페이지) ----------

export async function guidesMentioningItem(itemId: number): Promise<Array<{ guide: GuideRow; contextLabel: string | null }>> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ guide: guides, contextLabel: guideItemTags.contextLabel })
    .from(guideItemTags)
    .innerJoin(guides, eq(guideItemTags.guideId, guides.id))
    .where(and(eq(guideItemTags.itemId, itemId), eq(guides.status, "published")))
    .orderBy(desc(guides.publishedAt));
  return rows;
}

export async function guidesMentioningSpot(spotId: number): Promise<GuideRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ guide: guides })
    .from(guideSpotTags)
    .innerJoin(guides, eq(guideSpotTags.guideId, guides.id))
    .where(and(eq(guideSpotTags.spotId, spotId), eq(guides.status, "published")))
    .orderBy(desc(guides.publishedAt));
  return rows.map((r) => r.guide);
}

/** 지역 페이지 "관련 콘텐츠" — 이 지역 스팟이 태깅된 발행 글 (고유 데이터 블록의 일부) */
export async function guidesForRegion(regionId: number, limit = 4): Promise<GuideRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .selectDistinct({ guide: guides })
    .from(guideSpotTags)
    .innerJoin(guides, eq(guideSpotTags.guideId, guides.id))
    .innerJoin(spots, eq(guideSpotTags.spotId, spots.id))
    .where(and(eq(spots.regionId, regionId), eq(guides.status, "published")))
    .limit(limit);
  return rows.map((r) => r.guide);
}

export async function guidesMentioningMaker(makerId: number): Promise<GuideRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ guide: guides })
    .from(guideMakerTags)
    .innerJoin(guides, eq(guideMakerTags.guideId, guides.id))
    .where(and(eq(guideMakerTags.makerId, makerId), eq(guides.status, "published")))
    .orderBy(desc(guides.publishedAt));
  return rows.map((r) => r.guide);
}
