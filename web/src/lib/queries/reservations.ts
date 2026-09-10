// 예약·상담 조회 — reservations / conversations / messages. 접근 권한은 여기서 판단해 role 을 돌려준다.
import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import type { ReservationStatus } from "../reservations";

const { reservations, conversations, messages, users, spots, experts } = schema;

export type ReservationRow = typeof reservations.$inferSelect;
export type ReservationRole = "requester" | "provider" | "admin";

export interface ReservationItem {
  r: ReservationRow;
  requesterNickname: string | null;
  providerNickname: string | null;
  targetPath: string | null;
  hasConversation: boolean;
}

function targetPathOf(r: ReservationRow, spotSlug: string | null, expertSlug: string | null): string | null {
  if (r.spotId && spotSlug) return `/place/${r.spotId}-${encodeURIComponent(spotSlug)}`;
  if (r.expertId && expertSlug) return `/consult/${encodeURIComponent(expertSlug)}`;
  return null;
}

const hasConvSql = sql<boolean>`exists (select 1 from ${conversations} c where c.reservation_id = reservations.id)`;

function baseSelect() {
  const requester = sql<string | null>`(select u.display_name from ${users} u where u.id = reservations.user_id)`;
  const provider = sql<string | null>`(select u.display_name from ${users} u where u.id = reservations.provider_user_id)`;
  return getDb()
    .select({ r: reservations, requesterNickname: requester, providerNickname: provider, spotSlug: spots.slug, expertSlug: experts.slug, hasConversation: hasConvSql })
    .from(reservations)
    .leftJoin(spots, eq(reservations.spotId, spots.id))
    .leftJoin(experts, eq(reservations.expertId, experts.id));
}

type BaseRow = { r: ReservationRow; requesterNickname: string | null; providerNickname: string | null; spotSlug: string | null; expertSlug: string | null; hasConversation: boolean };
const toItem = (x: BaseRow): ReservationItem => ({ r: x.r, requesterNickname: x.requesterNickname, providerNickname: x.providerNickname, targetPath: targetPathOf(x.r, x.spotSlug, x.expertSlug), hasConversation: x.hasConversation });

/** 내가 보낸 예약·상담 */
export async function listMyReservations(userId: string): Promise<ReservationItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await baseSelect().where(eq(reservations.userId, userId)).orderBy(desc(reservations.createdAt)).limit(100);
  return rows.map(toItem);
}

/** 내가 제공자인 예약·상담 (내 업체·내 전문가 프로필로 들어온 것) */
export async function listReceivedReservations(providerUserId: string): Promise<ReservationItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await baseSelect().where(eq(reservations.providerUserId, providerUserId)).orderBy(desc(reservations.createdAt)).limit(200);
  return rows.map(toItem);
}

export async function countOpenReceived(providerUserId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (
    await getDb()
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reservations)
      .where(and(eq(reservations.providerUserId, providerUserId), inArray(reservations.status, ["new", "confirmed", "paid"])))
  )[0];
  return row?.n ?? 0;
}

export async function countOpenMine(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (
    await getDb()
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reservations)
      .where(and(eq(reservations.userId, userId), inArray(reservations.status, ["new", "confirmed", "paid"])))
  )[0];
  return row?.n ?? 0;
}

/** 관리자 목록 */
export async function listReservationsAdmin(status?: ReservationStatus | null): Promise<ReservationItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await baseSelect()
    .where(status ? eq(reservations.status, status) : undefined)
    .orderBy(desc(reservations.createdAt))
    .limit(300);
  return rows.map(toItem);
}

export async function countOpenReservationsAdmin(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (await getDb().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(reservations).where(inArray(reservations.status, ["new", "confirmed"])))[0];
  return row?.n ?? 0;
}

/** 한 건 + 이 사용자의 역할. 접근 권한이 없으면 null */
export async function getReservationFor(id: number, actor: { userId: string | null; admin: boolean }): Promise<(ReservationItem & { role: ReservationRole }) | null> {
  if (!isDbConfigured()) return null;
  const row = (await baseSelect().where(eq(reservations.id, id)).limit(1))[0];
  if (!row) return null;
  const item = toItem(row);
  if (actor.admin) return { ...item, role: "admin" };
  if (actor.userId && item.r.userId === actor.userId) return { ...item, role: "requester" };
  if (actor.userId && item.r.providerUserId === actor.userId) return { ...item, role: "provider" };
  return null;
}

/** 슬롯 충돌 확인용 — 같은 전문가·같은 시작 시각의 살아 있는 요청 */
export async function slotTaken(expertId: number, slotStart: Date): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const row = (
    await getDb()
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.expertId, expertId), eq(reservations.slotStart, slotStart), inArray(reservations.status, ["new", "confirmed", "paid"])))
      .limit(1)
  )[0];
  return Boolean(row);
}

// ---------- 채팅 ----------

export interface MessageRow {
  id: number;
  senderUserId: string | null;
  senderRole: string;
  senderName: string | null;
  body: string;
  createdAt: Date;
}

export async function getConversationId(reservationId: number): Promise<number | null> {
  if (!isDbConfigured()) return null;
  const row = (await getDb().select({ id: conversations.id }).from(conversations).where(eq(conversations.reservationId, reservationId)).limit(1))[0];
  return row?.id ?? null;
}

export async function listMessages(conversationId: number, afterId = 0, limit = 200): Promise<MessageRow[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ id: messages.id, senderUserId: messages.senderUserId, senderRole: messages.senderRole, senderName: users.displayName, body: messages.body, createdAt: messages.createdAt })
    .from(messages)
    .leftJoin(users, eq(messages.senderUserId, users.id))
    .where(afterId > 0 ? and(eq(messages.conversationId, conversationId), gt(messages.id, afterId)) : eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.id))
    .limit(limit);
  return rows;
}

/** 채팅이 있는 내 예약·상담 (양쪽 역할) — /me/chats */
export async function listMyConversations(userId: string): Promise<ReservationItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await baseSelect()
    .where(and(or(eq(reservations.userId, userId), eq(reservations.providerUserId, userId)), hasConvSql))
    .orderBy(desc(reservations.updatedAt))
    .limit(100);
  return rows.map(toItem);
}
