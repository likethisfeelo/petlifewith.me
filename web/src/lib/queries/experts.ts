// 노견 생활 상담 전문가 조회 — experts / expert_slots. 공개 목록은 published 만, 순서는 sort_order(운영자) — 순위·평점 없음.
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { type ExpertKind, type WeeklySlot } from "../reservations";

const { experts, expertSlots, expertRegions, reservations, users, regions } = schema;

export type ExpertRow = typeof experts.$inferSelect;

export interface ExpertCard {
  id: number;
  slug: string;
  kind: ExpertKind;
  displayName: string;
  introMd: string | null;
  credentialsText: string | null;
  credentialsVerifiedAt: string | null;
  topics: string[];
  modes: string[];
  priceText: string | null;
  heroImageKey: string | null;
  hasSlots: boolean;
  hasAccount: boolean;
  /** 활동 지역 라벨 ("서울특별시 마포구") — 비어 있으면 온라인 전용 */
  regionLabels: string[];
}

function toCard(e: ExpertRow, slotCount: number, regionLabels: string[] = []): ExpertCard {
  return {
    id: e.id,
    slug: e.slug,
    kind: e.kind,
    displayName: e.displayName,
    introMd: e.introMd,
    credentialsText: e.credentialsText,
    credentialsVerifiedAt: e.credentialsVerifiedAt,
    topics: e.topics,
    modes: e.modes,
    priceText: e.priceText,
    heroImageKey: e.heroImageKey,
    hasSlots: slotCount > 0,
    hasAccount: Boolean(e.userId),
    regionLabels,
  };
}

/** 여러 전문가의 활동 지역 라벨 */
async function regionLabelsFor(ids: number[]): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};
  if (ids.length === 0) return out;
  const rows = await getDb()
    .select({ expertId: expertRegions.expertId, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
    .from(expertRegions)
    .innerJoin(regions, eq(expertRegions.regionId, regions.id))
    .where(inArray(expertRegions.expertId, ids))
    .orderBy(asc(expertRegions.sortOrder));
  for (const r of rows) (out[r.expertId] ??= []).push(`${r.sidoName} ${r.sigunguName}`);
  return out;
}

const slotCountSql = sql<number>`(select count(*) from ${expertSlots} es where es.expert_id = experts.id)`.mapWith(Number);

export async function listPublishedExperts(kind?: ExpertKind | null): Promise<ExpertCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ e: experts, slotCount: slotCountSql })
    .from(experts)
    .where(kind ? and(eq(experts.status, "published"), eq(experts.kind, kind)) : eq(experts.status, "published"))
    .orderBy(asc(experts.sortOrder), asc(experts.id));
  const labels = await regionLabelsFor(rows.map((r) => r.e.id));
  return rows.map((r) => toCard(r.e, r.slotCount, labels[r.e.id] ?? []));
}

/** 한 지역에서 활동하는 공개 전문가 — 지역 페이지. 순서는 운영자 정렬뿐 (순위·평점 없음) */
export async function listPublishedExpertsInRegion(regionId: number, kind?: ExpertKind | null): Promise<ExpertCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ e: experts, slotCount: slotCountSql })
    .from(expertRegions)
    .innerJoin(experts, eq(expertRegions.expertId, experts.id))
    .where(and(eq(expertRegions.regionId, regionId), eq(experts.status, "published"), kind ? eq(experts.kind, kind) : undefined))
    .orderBy(asc(experts.sortOrder), asc(experts.id));
  const labels = await regionLabelsFor(rows.map((r) => r.e.id));
  return rows.map((r) => toCard(r.e, r.slotCount, labels[r.e.id] ?? []));
}

/** 지역별 공개 전문가 수 — 지도 배지 (종류별) */
export async function countPublishedExpertsByRegion(kind?: ExpertKind | null): Promise<Record<number, number>> {
  if (!isDbConfigured()) return {};
  const rows = await getDb()
    .select({ regionId: expertRegions.regionId, n: sql<number>`count(distinct ${expertRegions.expertId})`.mapWith(Number) })
    .from(expertRegions)
    .innerJoin(experts, eq(expertRegions.expertId, experts.id))
    .where(and(eq(experts.status, "published"), kind ? eq(experts.kind, kind) : undefined))
    .groupBy(expertRegions.regionId);
  return Object.fromEntries(rows.map((r) => [r.regionId, r.n]));
}

export async function countPublishedExpertsByKind(): Promise<Record<string, number>> {
  if (!isDbConfigured()) return {};
  const rows = await getDb().select({ kind: experts.kind, n: sql<number>`count(*)`.mapWith(Number) }).from(experts).where(eq(experts.status, "published")).groupBy(experts.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}

export interface ExpertDetail extends ExpertCard {
  slots: WeeklySlot[];
  regionIds: number[];
  userId: string | null;
  status: "draft" | "published";
  sortOrder: number;
  contact: string | null;
}

async function withSlots(e: ExpertRow): Promise<ExpertDetail> {
  const db = getDb();
  const [slots, regionRows, labels] = await Promise.all([
    db.select({ weekday: expertSlots.weekday, startMin: expertSlots.startMin, endMin: expertSlots.endMin }).from(expertSlots).where(eq(expertSlots.expertId, e.id)).orderBy(expertSlots.weekday, expertSlots.startMin),
    db.select({ regionId: expertRegions.regionId }).from(expertRegions).where(eq(expertRegions.expertId, e.id)).orderBy(asc(expertRegions.sortOrder)),
    regionLabelsFor([e.id]),
  ]);
  return { ...toCard(e, slots.length, labels[e.id] ?? []), slots, regionIds: regionRows.map((r) => r.regionId), userId: e.userId, status: e.status, sortOrder: e.sortOrder, contact: e.contact };
}

/** 회원 본인의 상담 프로필 (한 계정에 하나) */
export async function getExpertForUser(userId: string): Promise<ExpertDetail | null> {
  if (!isDbConfigured()) return null;
  const e = (await getDb().select().from(experts).where(eq(experts.userId, userId)).orderBy(asc(experts.id)).limit(1))[0];
  return e ? withSlots(e) : null;
}

export async function getExpertBySlug(slug: string): Promise<ExpertDetail | null> {
  if (!isDbConfigured()) return null;
  const e = (await getDb().select().from(experts).where(eq(experts.slug, slug)).limit(1))[0];
  return e ? withSlots(e) : null;
}

export async function getExpertById(id: number): Promise<ExpertDetail | null> {
  if (!isDbConfigured()) return null;
  const e = (await getDb().select().from(experts).where(eq(experts.id, id)).limit(1))[0];
  return e ? withSlots(e) : null;
}

/** 이 회원이 관리하는 전문가 프로필 */
export async function listExpertsForUser(userId: string): Promise<ExpertCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb().select({ e: experts, slotCount: slotCountSql }).from(experts).where(eq(experts.userId, userId)).orderBy(asc(experts.id));
  return rows.map((r) => toCard(r.e, r.slotCount));
}

/** 이미 잡힌 슬롯 시작 시각 — 요청됨·확인됨·결제 확인 상태만 자리를 차지한다 */
export async function bookedSlotStarts(expertId: number, from: Date): Promise<Date[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ slotStart: reservations.slotStart })
    .from(reservations)
    .where(and(eq(reservations.expertId, expertId), gte(reservations.slotStart, from), inArray(reservations.status, ["new", "confirmed", "paid"])));
  return rows.map((r) => r.slotStart).filter((d): d is Date => Boolean(d));
}

export interface ExpertAdminRow extends ExpertCard {
  status: "draft" | "published";
  userName: string | null;
  sortOrder: number;
  updatedAt: Date;
}

export async function listExpertsAdmin(): Promise<ExpertAdminRow[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ e: experts, slotCount: slotCountSql, userName: users.displayName })
    .from(experts)
    .leftJoin(users, eq(experts.userId, users.id))
    .orderBy(asc(experts.status), asc(experts.sortOrder), desc(experts.updatedAt));
  const labels = await regionLabelsFor(rows.map((r) => r.e.id));
  return rows.map((r) => ({ ...toCard(r.e, r.slotCount, labels[r.e.id] ?? []), status: r.e.status, userName: r.userName, sortOrder: r.e.sortOrder, updatedAt: r.e.updatedAt }));
}
