import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { guides, topics, guideItemTags, guideSpotTags, guideMakerTags, guideDeviceTags } = schema;
const { items, itemOffers, makers, spots, spotTypes, regions, deviceModels, deviceSites } = schema;

export type GuideRow = typeof guides.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;

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

export async function getPublishedGuide(slug: string): Promise<{ guide: GuideRow; topic: TopicRow } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ guide: guides, topic: topics })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .where(and(eq(guides.slug, slug), eq(guides.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

/** 토픽 허브: 허브 1 + 스포크 그룹별 목록 (발행분만) */
export async function listGuidesForTopic(topicId: number): Promise<{
  hub: GuideRow | null;
  spokesByGroup: Map<string, GuideRow[]>;
  all: GuideRow[];
}> {
  if (!isDbConfigured()) return { hub: null, spokesByGroup: new Map(), all: [] };
  const db = getDb();
  const rows = await db
    .select()
    .from(guides)
    .where(and(eq(guides.topicId, topicId), eq(guides.status, "published")))
    .orderBy(desc(guides.publishedAt));
  const hub = rows.find((g) => g.role === "hub") ?? null;
  const spokesByGroup = new Map<string, GuideRow[]>();
  for (const g of rows) {
    if (g.role === "hub") continue;
    const key = g.spokeGroup ?? "";
    const list = spokesByGroup.get(key) ?? [];
    list.push(g);
    spokesByGroup.set(key, list);
  }
  return { hub, spokesByGroup, all: rows };
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
