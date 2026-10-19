// 글 하나가 바뀌면 다시 만들어야 하는 경로 — 글 페이지·토픽 허브·카테고리 게시판·홈.
// 관리자 액션과 회원 액션이 같은 목록을 쓴다.
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

const { guides, topics } = schema;

export async function guideRelatedPaths(guideId: number): Promise<string[]> {
  const row = (
    await getDb()
      .select({ slug: guides.slug, category: guides.category, topicSlug: topics.slug, tags: guides.tags })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .where(eq(guides.id, guideId))
      .limit(1)
  )[0];
  if (!row) return ["/"];
  const paths = [`/guide/${row.slug}`, `/topic/${row.topicSlug}`, `/topic/${row.topicSlug}/curated`, `/topic/${row.topicSlug}/challenge`, "/"];
  if (row.category) paths.push(`/topic/${row.topicSlug}/${row.category}`);
  for (const t of row.tags) paths.push(`/tag/${encodeURIComponent(t)}`);
  return paths;
}

// 돌봄 파트너 하나가 바뀌면(노출 ON/OFF·지역 변경) 유형 허브·시도·지역 허브·지역x유형·개별 페이지를 다시 만든다.
const { spots, spotTypes, regions, spotServiceAreas } = schema;

export async function careRelatedPaths(spotId: number): Promise<string[]> {
  const db = getDb();
  const row = (
    await db
      .select({ id: spots.id, slug: spots.slug, typeSlug: spotTypes.slug })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row) return [];
  const areas = await db
    .select({ sidoSlug: regions.sidoSlug, sigunguSlug: regions.sigunguSlug })
    .from(spotServiceAreas)
    .innerJoin(regions, eq(spotServiceAreas.regionId, regions.id))
    .where(eq(spotServiceAreas.spotId, spotId));
  // 시도 페이지(유형 칩 배지)와 지역 허브(유형 분포)도 서비스 지역 기준으로 돌봄 수를 보여 준다
  return [
    ...new Set([
      `/spot/type/${row.typeSlug}`,
      `/place/${row.id}-${row.slug}`,
      ...areas.flatMap((a) => [
        `/spot/${a.sidoSlug}`,
        `/spot/${a.sidoSlug}/${a.sigunguSlug}`,
        `/spot/${a.sidoSlug}/${a.sigunguSlug}/${row.typeSlug}`,
      ]),
    ]),
  ];
}

// 업체 링크 페이지가 바뀌면(생성·유료 기간·짧은 주소·소개·사진) 링크 페이지와 장소 페이지, 지역 목록(노출 순서)을 다시 만든다.
export async function spotPageRelatedPaths(spotId: number, extraHandles: Array<string | null | undefined> = []): Promise<string[]> {
  const db = getDb();
  const row = (
    await db
      .select({ id: spots.id, slug: spots.slug, typeSlug: spotTypes.slug, sidoSlug: regions.sidoSlug, sigunguSlug: regions.sigunguSlug, handle: schema.spotPages.handle })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .leftJoin(schema.spotPages, eq(schema.spotPages.spotId, spots.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row) return [];
  const handles = [row.handle, ...extraHandles].filter((h): h is string => !!h);
  return [
    ...new Set([
      `/l/${row.id}`,
      `/api/spots/${row.id}/preview`,
      ...handles.map((h) => `/l/${h}`),
      `/place/${row.id}-${row.slug}`,
      `/spot/${row.sidoSlug}/${row.sigunguSlug}`,
      `/spot/${row.sidoSlug}/${row.sigunguSlug}/${row.typeSlug}`,
      ...(await careRelatedPaths(spotId)),
    ]),
  ];
}
