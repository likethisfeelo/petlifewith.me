// 댓글 — 회원만 쓴다. 공개 목록은 숨김 처리되지 않은 것만, 닉네임만 노출 (이메일 없음).
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { formatDateTime } from "../format";

const { comments, users } = schema;

export interface PublicComment {
  id: number;
  body: string;
  createdAt: Date;
  /** 화면에 찍을 시각 문자열 — 서버에서 KST 로 만든다.
   *  클라이언트에서 포맷하면 서버(UTC)와 달라져 하이드레이션이 깨진다 (lib/format.ts). */
  createdAtLabel: string;
  authorName: string;
  authorId: string;
}

export async function listVisibleComments(guideId: number): Promise<PublicComment[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: users.displayName,
      authorId: comments.userId,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.guideId, guideId), isNull(comments.hiddenAt)))
    .orderBy(asc(comments.createdAt));
  return rows.map((r) => ({ ...r, authorName: r.authorName ?? "회원", createdAtLabel: formatDateTime(r.createdAt) }));
}

export async function countVisibleComments(guideId: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(comments)
    .where(and(eq(comments.guideId, guideId), isNull(comments.hiddenAt)));
  return rows[0]?.count ?? 0;
}

/** 여러 글의 댓글 수 — 게시판 목록용 */
export async function countCommentsByGuides(guideIds: number[]): Promise<Map<number, number>> {
  if (!isDbConfigured() || guideIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ guideId: comments.guideId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(comments)
    .where(and(inArray(comments.guideId, guideIds), isNull(comments.hiddenAt)))
    .groupBy(comments.guideId);
  return new Map(rows.map((r) => [r.guideId, r.count]));
}
