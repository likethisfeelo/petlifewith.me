// 글 하나가 바뀌면 다시 만들어야 하는 경로 — 글 페이지·토픽 허브·카테고리 게시판·홈.
// 관리자 액션과 회원 액션이 같은 목록을 쓴다.
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

const { guides, topics } = schema;

export async function guideRelatedPaths(guideId: number): Promise<string[]> {
  const row = (
    await getDb()
      .select({ slug: guides.slug, category: guides.category, topicSlug: topics.slug })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .where(eq(guides.id, guideId))
      .limit(1)
  )[0];
  if (!row) return ["/"];
  const paths = [`/guide/${row.slug}`, `/topic/${row.topicSlug}`, "/"];
  if (row.category) paths.push(`/topic/${row.topicSlug}/${row.category}`);
  return paths;
}
