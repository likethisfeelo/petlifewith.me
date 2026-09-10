// 소유 업체·브랜드·상품 조회 — spots/makers.claimed_by 가 이 회원인 것. /me/business 와 회원 글의 "내 업체·상품 연결"에 쓴다.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { spots, spotTypes, regions, spotLinks, makers, makerLinks, items, itemOffers, guideSpotTags, guideMakerTags, guideItemTags, guides } = schema;

export interface OwnedSpot {
  id: number;
  name: string;
  slug: string;
  status: string;
  typeName: string;
  typeSlug: string;
  regionLabel: string;
  updatedAt: Date;
}

export async function listOwnedSpots(userId: string): Promise<OwnedSpot[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      id: spots.id,
      name: spots.name,
      slug: spots.slug,
      status: spots.status,
      typeName: spotTypes.name,
      typeSlug: spotTypes.slug,
      regionLabel: sql<string>`${regions.sidoName} || ' ' || ${regions.sigunguName}`,
      updatedAt: spots.updatedAt,
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(eq(spots.claimedBy, userId))
    .orderBy(desc(spots.updatedAt));
}

export interface OwnedMaker {
  id: number;
  name: string;
  slug: string;
  status: "draft" | "published";
  category: string;
  itemCount: number;
  updatedAt: Date;
}

export async function listOwnedMakers(userId: string): Promise<OwnedMaker[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({
      id: makers.id,
      name: makers.name,
      slug: makers.slug,
      status: makers.status,
      category: makers.category,
      // 바깥 테이블 컬럼은 글자 그대로 (조인 없는 select 에서 drizzle 이 테이블 한정 없이 렌더한다)
      itemCount: sql<number>`(select count(*) from ${items} i where i.maker_id = makers.id)`.mapWith(Number),
      updatedAt: makers.updatedAt,
    })
    .from(makers)
    .where(eq(makers.claimedBy, userId))
    .orderBy(desc(makers.updatedAt));
}

export type OwnedSpotRow = typeof spots.$inferSelect;
export type OwnedMakerRow = typeof makers.$inferSelect;
export type OwnedItemRow = typeof items.$inferSelect;

/** 소유 스팟 한 건 — 남의 것이면 null (존재 자체를 드러내지 않는다) */
export async function getOwnedSpot(spotId: number, userId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const row = (
    await db
      .select({ spot: spots, typeName: spotTypes.name, typeSlug: spotTypes.slug, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(and(eq(spots.id, spotId), eq(spots.claimedBy, userId)))
      .limit(1)
  )[0];
  if (!row) return null;
  const links = await db.select().from(spotLinks).where(eq(spotLinks.spotId, spotId)).orderBy(spotLinks.sortOrder);
  return { ...row, links };
}

export async function getOwnedMaker(makerId: number, userId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const maker = (await db.select().from(makers).where(and(eq(makers.id, makerId), eq(makers.claimedBy, userId))).limit(1))[0];
  if (!maker) return null;
  const [links, itemRows] = await Promise.all([
    db.select().from(makerLinks).where(eq(makerLinks.makerId, makerId)).orderBy(makerLinks.sortOrder),
    db.select().from(items).where(eq(items.makerId, makerId)).orderBy(desc(items.updatedAt)),
  ]);
  return { maker, links, items: itemRows };
}

/** 소유 브랜드의 상품 한 건 — 브랜드가 내 것일 때만 */
export async function getOwnedItem(itemId: number, userId: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const row = (
    await db
      .select({ item: items, maker: makers })
      .from(items)
      .innerJoin(makers, eq(items.makerId, makers.id))
      .where(and(eq(items.id, itemId), eq(makers.claimedBy, userId)))
      .limit(1)
  )[0];
  if (!row) return null;
  const offers = await db.select().from(itemOffers).where(eq(itemOffers.itemId, itemId)).orderBy(itemOffers.sortOrder);
  const mentionCount = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(guideItemTags).where(eq(guideItemTags.itemId, itemId)))[0]?.n ?? 0;
  return { ...row, offers, mentionCount };
}

/** 회원 글의 "내 업체·상품 연결" 선택지 — 소유한 것만 */
export interface OwnedEntityOptions {
  spots: Array<{ id: number; name: string; sub: string }>;
  makers: Array<{ id: number; name: string }>;
  items: Array<{ id: number; name: string; sub: string }>;
}

export async function listOwnedEntityOptions(userId: string): Promise<OwnedEntityOptions> {
  if (!isDbConfigured()) return { spots: [], makers: [], items: [] };
  const db = getDb();
  const [s, m] = await Promise.all([listOwnedSpots(userId), listOwnedMakers(userId)]);
  const i =
    m.length > 0
      ? await db
          .select({ id: items.id, name: items.name, makerName: makers.name })
          .from(items)
          .innerJoin(makers, eq(items.makerId, makers.id))
          .where(inArray(items.makerId, m.map((x) => x.id)))
          .orderBy(items.name)
      : [];
  return {
    spots: s.map((x) => ({ id: x.id, name: x.name, sub: `${x.typeName} · ${x.regionLabel}` })),
    makers: m.map((x) => ({ id: x.id, name: x.name })),
    items: i.map((x) => ({ id: x.id, name: x.name, sub: x.makerName })),
  };
}

export interface GuideLinks {
  spotIds: number[];
  makerIds: number[];
  itemIds: number[];
}

/** 글에 연결된 개체 id — 편집 폼 초기값 */
export async function getGuideLinks(guideId: number): Promise<GuideLinks> {
  if (!isDbConfigured()) return { spotIds: [], makerIds: [], itemIds: [] };
  const db = getDb();
  const [s, m, i] = await Promise.all([
    db.select({ id: guideSpotTags.spotId }).from(guideSpotTags).where(eq(guideSpotTags.guideId, guideId)),
    db.select({ id: guideMakerTags.makerId }).from(guideMakerTags).where(eq(guideMakerTags.guideId, guideId)),
    db.select({ id: guideItemTags.itemId }).from(guideItemTags).where(eq(guideItemTags.guideId, guideId)),
  ]);
  return { spotIds: s.map((x) => x.id), makerIds: m.map((x) => x.id), itemIds: i.map((x) => x.id) };
}

/** 여러 글의 연결 개체 이름 — /me/posts 칩 */
export async function listGuideLinkNames(guideIds: number[]): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};
  if (!isDbConfigured() || guideIds.length === 0) return out;
  const db = getDb();
  const [s, m, i] = await Promise.all([
    db.select({ guideId: guideSpotTags.guideId, name: spots.name }).from(guideSpotTags).innerJoin(spots, eq(guideSpotTags.spotId, spots.id)).where(inArray(guideSpotTags.guideId, guideIds)),
    db.select({ guideId: guideMakerTags.guideId, name: makers.name }).from(guideMakerTags).innerJoin(makers, eq(guideMakerTags.makerId, makers.id)).where(inArray(guideMakerTags.guideId, guideIds)),
    db.select({ guideId: guideItemTags.guideId, name: items.name }).from(guideItemTags).innerJoin(items, eq(guideItemTags.itemId, items.id)).where(inArray(guideItemTags.guideId, guideIds)),
  ]);
  for (const r of [...s, ...m, ...i]) (out[r.guideId] ??= []).push(r.name);
  return out;
}

/** 내 글 수 (상태별) */
export async function countMyPosts(userId: string): Promise<{ total: number; published: number; pending: number }> {
  if (!isDbConfigured()) return { total: 0, published: 0, pending: 0 };
  const rows = await getDb().select({ status: guides.status, n: sql<number>`count(*)`.mapWith(Number) }).from(guides).where(eq(guides.authorUserId, userId)).groupBy(guides.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { total: rows.reduce((a, r) => a + r.n, 0), published: by.published ?? 0, pending: by.pending ?? 0 };
}
