// 노견 생활 상담 전문가 조회 — experts / expert_slots. 공개 목록은 published 만, 순서는 sort_order(운영자) — 순위·평점 없음.
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { type ExpertKind, type WeeklySlot } from "../reservations";

const { experts, expertSlots, reservations, users } = schema;

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
}

function toCard(e: ExpertRow, slotCount: number): ExpertCard {
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
  };
}

const slotCountSql = sql<number>`(select count(*) from ${expertSlots} es where es.expert_id = experts.id)`.mapWith(Number);

export async function listPublishedExperts(kind?: ExpertKind | null): Promise<ExpertCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ e: experts, slotCount: slotCountSql })
    .from(experts)
    .where(kind ? and(eq(experts.status, "published"), eq(experts.kind, kind)) : eq(experts.status, "published"))
    .orderBy(asc(experts.sortOrder), asc(experts.id));
  return rows.map((r) => toCard(r.e, r.slotCount));
}

export async function countPublishedExpertsByKind(): Promise<Record<string, number>> {
  if (!isDbConfigured()) return {};
  const rows = await getDb().select({ kind: experts.kind, n: sql<number>`count(*)`.mapWith(Number) }).from(experts).where(eq(experts.status, "published")).groupBy(experts.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}

export interface ExpertDetail extends ExpertCard {
  slots: WeeklySlot[];
  userId: string | null;
  status: "draft" | "published";
  sortOrder: number;
  contact: string | null;
}

async function withSlots(e: ExpertRow): Promise<ExpertDetail> {
  const slots = await getDb().select({ weekday: expertSlots.weekday, startMin: expertSlots.startMin, endMin: expertSlots.endMin }).from(expertSlots).where(eq(expertSlots.expertId, e.id)).orderBy(expertSlots.weekday, expertSlots.startMin);
  return { ...toCard(e, slots.length), slots, userId: e.userId, status: e.status, sortOrder: e.sortOrder, contact: e.contact };
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
  return rows.map((r) => ({ ...toCard(r.e, r.slotCount), status: r.e.status, userName: r.userName, sortOrder: r.e.sortOrder, updatedAt: r.e.updatedAt }));
}
