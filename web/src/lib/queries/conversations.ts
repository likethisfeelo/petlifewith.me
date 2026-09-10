// 대화 조회 — 예약에 딸린 대화(결제 확인 뒤 열림)와 상담 프로필에서 바로 연 대화(direct)를 한 곳에서 다룬다.
// 접근 권한은 여기서 판단해 역할(requester/provider/admin)을 돌려준다. 권한이 없으면 null.
import { desc, eq, or, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { chatOpen, type ReservationStatus } from "../reservations";

const { conversations, reservations, experts, messages, users } = schema;

export type ConversationRow = typeof conversations.$inferSelect;
export type ChatRole = "requester" | "provider" | "admin";

export interface ChatAccess {
  conv: ConversationRow;
  role: ChatRole;
  /** 대화 제목 — 전문가 활동명 또는 예약 대상 이름 */
  title: string;
  /** 대상 공개 페이지 (있으면) */
  targetPath: string | null;
  requesterNickname: string | null;
  providerNickname: string | null;
  /** 지금 메시지를 보낼 수 있는지 — direct 는 항상, 예약은 결제 확인 뒤 */
  open: boolean;
  /** 예약에 딸린 대화면 그 예약 */
  reservationId: number | null;
  reservationStatus: ReservationStatus | null;
}

const requesterNameSql = sql<string | null>`(select u.display_name from ${users} u where u.id = coalesce(reservations.user_id, conversations.user_id))`;
const providerNameSql = sql<string | null>`(select u.display_name from ${users} u where u.id = coalesce(reservations.provider_user_id, experts.user_id))`;

function chatSelect() {
  return getDb()
    .select({
      c: conversations,
      expertSlug: experts.slug,
      expertName: experts.displayName,
      expertUserId: experts.userId,
      r: reservations,
      requesterNickname: requesterNameSql,
      providerNickname: providerNameSql,
      lastBody: sql<string | null>`(select m.body from ${messages} m where m.conversation_id = conversations.id order by m.id desc limit 1)`,
    })
    .from(conversations)
    .leftJoin(experts, eq(conversations.expertId, experts.id))
    .leftJoin(reservations, eq(conversations.reservationId, reservations.id));
}

type ChatQueryRow = Awaited<ReturnType<ReturnType<typeof chatSelect>["execute"]>>[number];

function roleOf(row: ChatQueryRow, actor: { userId: string | null; admin: boolean }): ChatRole | null {
  if (actor.admin) return "admin";
  if (!actor.userId) return null;
  if (row.r) {
    if (row.r.userId === actor.userId) return "requester";
    if (row.r.providerUserId === actor.userId) return "provider";
    return null;
  }
  if (row.c.userId === actor.userId) return "requester";
  if (row.expertUserId && row.expertUserId === actor.userId) return "provider";
  return null;
}

function titleOf(row: ChatQueryRow): string {
  return row.r?.targetName ?? row.expertName ?? "상담";
}

function targetPathOf(row: ChatQueryRow): string | null {
  if (row.expertSlug) return `/consult/${encodeURIComponent(row.expertSlug)}`;
  if (row.r?.spotId) return null; // 예약 대화는 예약 페이지가 대상 링크를 가진다
  return null;
}

/** 대화 한 건 + 이 사용자의 역할. 권한이 없으면 null */
export async function getChatFor(id: number, actor: { userId: string | null; admin: boolean }): Promise<ChatAccess | null> {
  if (!isDbConfigured()) return null;
  const row = (await chatSelect().where(eq(conversations.id, id)).limit(1))[0];
  if (!row) return null;
  const role = roleOf(row, actor);
  if (!role) return null;
  return {
    conv: row.c,
    role,
    title: titleOf(row),
    targetPath: targetPathOf(row),
    requesterNickname: row.requesterNickname,
    providerNickname: row.providerNickname,
    open: row.r ? chatOpen(row.r.status) : true,
    reservationId: row.r?.id ?? null,
    reservationStatus: (row.r?.status as ReservationStatus | undefined) ?? null,
  };
}

/** 상담 프로필 ↔ 회원의 direct 대화 (있으면) */
export async function findDirectConversation(expertId: number, userId: string): Promise<number | null> {
  if (!isDbConfigured()) return null;
  const row = (
    await getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(sql`${conversations.expertId} = ${expertId} and ${conversations.userId} = ${userId}`)
      .limit(1)
  )[0];
  return row?.id ?? null;
}

export interface ChatListItem {
  id: number;
  kind: string;
  title: string;
  path: string;
  role: ChatRole;
  otherName: string | null;
  lastBody: string | null;
  lastAt: Date;
  reservationStatus: ReservationStatus | null;
}

/** 내 대화 목록 — 바로 연 상담 대화와 예약에 딸린 대화 모두 (/me/chats) */
export async function listMyChats(userId: string): Promise<ChatListItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await chatSelect()
    .where(or(eq(conversations.userId, userId), eq(experts.userId, userId), eq(reservations.userId, userId), eq(reservations.providerUserId, userId)))
    .orderBy(desc(sql`coalesce(conversations.last_message_at, conversations.created_at)`))
    .limit(100);
  return rows.flatMap((row) => {
    const role = roleOf(row, { userId, admin: false });
    if (!role) return [];
    return [
      {
        id: row.c.id,
        kind: row.c.kind,
        title: titleOf(row),
        path: row.r ? `/reservations/${row.r.id}` : `/chat/${row.c.id}`,
        role,
        otherName: role === "provider" ? row.requesterNickname : row.providerNickname,
        lastBody: row.lastBody,
        lastAt: row.c.lastMessageAt ?? row.c.createdAt,
        reservationStatus: (row.r?.status as ReservationStatus | undefined) ?? null,
      },
    ];
  });
}

/** 안 읽은 표시 대신 쓰는 가벼운 집계 — 최근 24시간 안에 메시지가 온 대화 수 */
export async function countActiveChats(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await listMyChats(userId);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return rows.filter((c) => c.lastAt.getTime() >= since).length;
}
