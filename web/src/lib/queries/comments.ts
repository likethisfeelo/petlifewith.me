// 댓글 — 회원만 쓴다. 공개 목록은 숨김 처리되지 않은 것만, 닉네임만 노출 (이메일 없음).
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { comments, users } = schema;

export interface PublicComment {
  id: number;
  body: string;
  createdAt: Date;
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
  return rows.map((r) => ({ ...r, authorName: r.authorName ?? "회원" }));
}

export async function countVisibleComments(guideId: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(comments)
    .where(and(eq(comments.guideId, guideId), isNull(comments.hiddenAt)));
  return rows[0]?.count ?? 0;
}
