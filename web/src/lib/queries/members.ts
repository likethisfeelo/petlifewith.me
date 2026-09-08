// 회원 본인 화면용 조회 — 서버 컴포넌트에서만 부른다 (서버 액션으로 노출하지 않는다)
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { guides, topics } = schema;

export async function listMyPosts(userId: string) {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ guide: guides, topicSlug: topics.slug, topicName: topics.name })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .where(eq(guides.authorUserId, userId))
    .orderBy(desc(guides.updatedAt));
}
