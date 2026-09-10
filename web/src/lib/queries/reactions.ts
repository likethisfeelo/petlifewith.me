// 저장·좋아요·연락 기록 조회 — reactions / contact_logs
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { idSlugPath } from "../format";
import { reactionKey, type ReactionKind, type ReactionTarget } from "../reactions";

const { reactions, contactLogs, guides, spots, spotTypes, makers, items, meetups, makerLinks, spotLinks } = schema;

export interface ReactionState {
  /** 이 회원이 누른 것 — "guide:12" → { save: true, like: false } */
  mine: Record<string, Partial<Record<ReactionKind, boolean>>>;
  /** 공개 좋아요 수 — 게시글만 */
  likes: Record<string, number>;
}

export async function getReactionState(userId: string | null, targets: Array<{ target: ReactionTarget; id: number }>): Promise<ReactionState> {
  const state: ReactionState = { mine: {}, likes: {} };
  if (!isDbConfigured() || targets.length === 0) return state;
  const db = getDb();
  const guideIds = targets.filter((t) => t.target === "guide").map((t) => t.id);
  if (guideIds.length > 0) {
    const rows = await db
      .select({ targetId: reactions.targetId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(reactions)
      .where(and(eq(reactions.targetType, "guide"), eq(reactions.kind, "like"), inArray(reactions.targetId, guideIds)))
      .groupBy(reactions.targetId);
    for (const r of rows) state.likes[reactionKey("guide", r.targetId)] = r.n;
  }
  if (userId) {
    const rows = await db
      .select({ targetType: reactions.targetType, targetId: reactions.targetId, kind: reactions.kind })
      .from(reactions)
      .where(and(eq(reactions.userId, userId), inArray(reactions.targetId, [...new Set(targets.map((t) => t.id))])));
    for (const r of rows) {
      if (!targets.some((t) => t.target === r.targetType && t.id === r.targetId)) continue;
      const key = reactionKey(r.targetType, r.targetId);
      state.mine[key] = { ...(state.mine[key] ?? {}), [r.kind]: true };
    }
  }
  return state;
}

export async function countLikes(target: ReactionTarget, id: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (await getDb().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(reactions).where(and(eq(reactions.targetType, target), eq(reactions.targetId, id), eq(reactions.kind, "like"))))[0];
  return row?.n ?? 0;
}

export async function countSavedByUser(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (await getDb().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(reactions).where(and(eq(reactions.userId, userId), eq(reactions.kind, "save"))))[0];
  return row?.n ?? 0;
}

export interface SavedEntry {
  target: ReactionTarget;
  id: number;
  title: string;
  path: string;
  sub: string | null;
  savedAt: Date;
  /** 사라졌거나 비공개가 된 대상 */
  gone: boolean;
}

/** 내가 저장한 것 — 종류별 이름·경로를 붙여 최신순 */
export async function listSaved(userId: string): Promise<SavedEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ targetType: reactions.targetType, targetId: reactions.targetId, createdAt: reactions.createdAt })
    .from(reactions)
    .where(and(eq(reactions.userId, userId), eq(reactions.kind, "save")))
    .orderBy(desc(reactions.createdAt))
    .limit(300);
  const ids = (t: ReactionTarget) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [g, s, m, i, mt] = await Promise.all([
    ids("guide").length ? db.select({ id: guides.id, title: guides.title, slug: guides.slug, status: guides.status }).from(guides).where(inArray(guides.id, ids("guide"))) : [],
    ids("spot").length
      ? db.select({ id: spots.id, name: spots.name, slug: spots.slug, typeName: spotTypes.name }).from(spots).innerJoin(spotTypes, eq(spots.typeId, spotTypes.id)).where(inArray(spots.id, ids("spot")))
      : [],
    ids("maker").length ? db.select({ id: makers.id, name: makers.name, slug: makers.slug, status: makers.status }).from(makers).where(inArray(makers.id, ids("maker"))) : [],
    ids("item").length
      ? db.select({ id: items.id, name: items.name, slug: items.slug, makerName: makers.name }).from(items).leftJoin(makers, eq(items.makerId, makers.id)).where(inArray(items.id, ids("item")))
      : [],
    ids("meetup").length ? db.select({ id: meetups.id, title: meetups.title, slug: meetups.slug, hiddenAt: meetups.hiddenAt }).from(meetups).where(inArray(meetups.id, ids("meetup"))) : [],
  ]);
  const out: SavedEntry[] = [];
  for (const r of rows) {
    const base = { target: r.targetType, id: r.targetId, savedAt: r.createdAt };
    if (r.targetType === "guide") {
      const x = g.find((v) => v.id === r.targetId);
      out.push(x ? { ...base, title: x.title, path: `/guide/${x.slug}`, sub: null, gone: x.status !== "published" } : { ...base, title: "(삭제된 글)", path: "#", sub: null, gone: true });
    } else if (r.targetType === "spot") {
      const x = s.find((v) => v.id === r.targetId);
      out.push(x ? { ...base, title: x.name, path: idSlugPath("place", x.id, x.slug), sub: x.typeName, gone: false } : { ...base, title: "(삭제된 업체)", path: "#", sub: null, gone: true });
    } else if (r.targetType === "maker") {
      const x = m.find((v) => v.id === r.targetId);
      out.push(x ? { ...base, title: x.name, path: idSlugPath("maker", x.id, x.slug), sub: null, gone: x.status !== "published" } : { ...base, title: "(삭제된 브랜드)", path: "#", sub: null, gone: true });
    } else if (r.targetType === "item") {
      const x = i.find((v) => v.id === r.targetId);
      out.push(x ? { ...base, title: x.name, path: idSlugPath("item", x.id, x.slug), sub: x.makerName, gone: false } : { ...base, title: "(삭제된 상품)", path: "#", sub: null, gone: true });
    } else {
      const x = mt.find((v) => v.id === r.targetId);
      out.push(x ? { ...base, title: x.title, path: `/meetup/${x.slug}`, sub: null, gone: Boolean(x.hiddenAt) } : { ...base, title: "(사라진 모임)", path: "#", sub: null, gone: true });
    }
  }
  return out;
}

export interface ContactLogEntry {
  id: number;
  name: string;
  path: string;
  channel: string;
  channelLabel: string;
  url: string | null;
  createdAt: Date;
}

/** 연락한 업체·브랜드 — 최근순, 같은 업체·채널은 최근 것만 */
export async function listContactLogs(userId: string, limit = 30): Promise<ContactLogEntry[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: contactLogs.id,
      spotId: contactLogs.spotId,
      makerId: contactLogs.makerId,
      channel: contactLogs.channel,
      createdAt: contactLogs.createdAt,
      spotName: spots.name,
      spotSlug: spots.slug,
      makerName: makers.name,
      makerSlug: makers.slug,
    })
    .from(contactLogs)
    .leftJoin(spots, eq(contactLogs.spotId, spots.id))
    .leftJoin(makers, eq(contactLogs.makerId, makers.id))
    .where(eq(contactLogs.userId, userId))
    .orderBy(desc(contactLogs.createdAt))
    .limit(200);
  const seen = new Set<string>();
  const out: ContactLogEntry[] = [];
  const { spotLinkLabel, makerLinkLabel } = await import("../links");
  for (const r of rows) {
    const key = `${r.spotId ?? "s"}-${r.makerId ?? "m"}-${r.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.spotId && r.spotName && r.spotSlug) {
      const link = (await db.select({ url: spotLinks.url }).from(spotLinks).where(and(eq(spotLinks.spotId, r.spotId), eq(spotLinks.kind, r.channel))).limit(1))[0];
      out.push({ id: r.id, name: r.spotName, path: idSlugPath("place", r.spotId, r.spotSlug), channel: r.channel, channelLabel: spotLinkLabel({ kind: r.channel, label: null }), url: link?.url ?? null, createdAt: r.createdAt });
    } else if (r.makerId && r.makerName && r.makerSlug) {
      const link = (await db.select({ url: makerLinks.url }).from(makerLinks).where(and(eq(makerLinks.makerId, r.makerId), eq(makerLinks.kind, r.channel))).limit(1))[0];
      out.push({ id: r.id, name: r.makerName, path: idSlugPath("maker", r.makerId, r.makerSlug), channel: r.channel, channelLabel: makerLinkLabel({ kind: r.channel, label: null }), url: link?.url ?? null, createdAt: r.createdAt });
    }
    if (out.length >= limit) break;
  }
  return out;
}
