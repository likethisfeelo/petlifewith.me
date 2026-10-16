import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { newsPosts } = schema;

export type NewsPostRow = typeof newsPosts.$inferSelect;
export type NewsListItem = Pick<NewsPostRow, "id" | "slug" | "title" | "summary" | "heroImageKey" | "category" | "toolKey" | "publishedAt" | "updatedAt"> & {
  hasTool: boolean;
};

/** 공개 목록 — 발행된 글만, 최신순 (본문·HTML 도구는 싣지 않는다) */
export async function listPublishedNews(category?: string): Promise<NewsListItem[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      summary: newsPosts.summary,
      heroImageKey: newsPosts.heroImageKey,
      category: newsPosts.category,
      toolKey: newsPosts.toolKey,
      hasHtml: sql<boolean>`${newsPosts.toolHtml} is not null`,
      publishedAt: newsPosts.publishedAt,
      updatedAt: newsPosts.updatedAt,
    })
    .from(newsPosts)
    .where(category ? and(eq(newsPosts.status, "published"), eq(newsPosts.category, category)) : eq(newsPosts.status, "published"))
    .orderBy(desc(newsPosts.publishedAt));
  return rows.map(({ hasHtml, ...r }) => ({ ...r, hasTool: Boolean(r.toolKey) || Boolean(hasHtml) }));
}

export async function getPublishedNews(slug: string): Promise<NewsPostRow | null> {
  if (!isDbConfigured()) return null;
  const row = (await getDb().select().from(newsPosts).where(eq(newsPosts.slug, slug)).limit(1))[0];
  return row && row.status === "published" ? row : null;
}
