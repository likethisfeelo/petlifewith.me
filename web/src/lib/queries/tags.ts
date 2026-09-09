// 태그 조회 — guides.tags(text[]) 기준. 발행 글만.
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import type { GuideListItem } from "./guides";

const { guides, topics, users } = schema;

export interface TagCount {
  tag: string;
  count: number;
}

/** db.execute 결과는 드라이버에 따라 배열이거나 { rows } 다 — 행 배열로 맞춘다 */
export function resultRows<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = res as { rows?: unknown };
  return Array.isArray(r?.rows) ? (r.rows as T[]) : [];
}

/** 많이 쓰인 태그 — 편집기 추천·태그 페이지 */
export async function listPopularTags(limit = 30): Promise<TagCount[]> {
  if (!isDbConfigured()) return [];
  const res = await getDb().execute(sql`
    select t as tag, count(*)::int as count
    from ${guides}, unnest(${guides.tags}) as t
    where ${guides.status} = 'published'
    group by t
    order by count desc, t
    limit ${limit}
  `);
  return resultRows<{ tag: string; count: number }>(res).map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** 태그가 붙은 발행 글 (최신순) — 토픽 이름과 회원 닉네임을 같이 준다 */
export async function listGuidesByTag(tag: string): Promise<Array<GuideListItem & { topic: typeof topics.$inferSelect }>> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ guide: guides, topic: topics, authorName: users.displayName })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .leftJoin(users, eq(guides.authorUserId, users.id))
    .where(and(eq(guides.status, "published"), sql`${guides.tags} @> ARRAY[${tag}]::text[]`))
    .orderBy(desc(guides.publishedAt));
  return rows.map((r) => ({ guide: r.guide, topic: r.topic, authorName: r.guide.authorUserId ? r.authorName : null }));
}
