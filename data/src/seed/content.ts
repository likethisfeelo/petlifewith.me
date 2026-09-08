// 콘텐츠 시드 — data/content/guides/*.md 를 slug 기준으로 upsert.
// 본문은 git 이 원본, DB 는 서빙 뷰다. 관리자에서 고친 본문은 여기 재실행 시 덮어써진다.
//
// frontmatter:
//   slug, title, topic(토픽 슬러그) — 필수
//   summary, role(hub|spoke), spokeGroup(body|support|...), status,
//   category(토픽별 카테고리 슬러그 — data/src/guides/categories.ts, 없으면 "전체"),
//   banners(글 상단 디렉토리 배너 — spot_types.slug 배열, 클릭하면 그 유형의 디렉토리로),
//   medicalAdjacent, vetReviewed, vetReviewerName, vetReviewedAt — 선택
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { eq } from "drizzle-orm";
import { repoRoot } from "../env.js";
import { closeDb, getDb } from "../db/client.js";
import { guides, spotTypes, topics } from "../db/schema.js";
import { categoriesForTopic } from "../guides/categories.js";
import { seniorSeedPosts } from "../guides/seed-posts.js";

const GUIDES_DIR = path.join(repoRoot, "data", "content", "guides");

type GuideStatus = "draft" | "review_pending" | "published" | "archived";

async function main() {
  const db = getDb();
  const topicRows = await db.select().from(topics);
  if (topicRows.length === 0) throw new Error("topics 가 비어 있습니다. seed:base 를 먼저 실행하세요.");
  const topicBySlug = new Map(topicRows.map((t) => [t.slug, t.id]));
  const spotTypeSlugs = new Set((await db.select({ slug: spotTypes.slug }).from(spotTypes)).map((t) => t.slug));

  const files = readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md")).sort();
  let count = 0;

  for (const file of files) {
    const raw = readFileSync(path.join(GUIDES_DIR, file), "utf8");
    const { data, content } = matter(raw);

    const slug = String(data.slug ?? "").trim();
    const title = String(data.title ?? "").trim();
    const topicSlug = String(data.topic ?? "").trim();
    if (!slug || !title || !topicSlug) {
      throw new Error(`${file}: frontmatter 에 slug/title/topic 이 필요합니다.`);
    }
    const topicId = topicBySlug.get(topicSlug);
    if (!topicId) throw new Error(`${file}: 알 수 없는 topic "${topicSlug}"`);

    // 카테고리는 토픽 정의에 있는 슬러그만 — 오타를 조용히 "전체"로 넘기지 않는다
    const category = data.category ? String(data.category).trim() : null;
    if (category && !categoriesForTopic(topicSlug).some((c) => c.slug === category)) {
      throw new Error(`${file}: 토픽 "${topicSlug}" 에 없는 category "${category}"`);
    }

    const banners: string[] = Array.isArray(data.banners) ? data.banners.map((b: unknown) => String(b).trim()) : [];
    for (const b of banners) {
      if (!spotTypeSlugs.has(b)) throw new Error(`${file}: spot_types 에 없는 banner "${b}" (seed:base 를 먼저 실행했는지 확인)`);
    }

    const medicalAdjacent = Boolean(data.medicalAdjacent ?? false);
    const vetReviewed = Boolean(data.vetReviewed ?? false);
    let status = (data.status ?? "draft") as GuideStatus;

    // 의료 인접 편은 감수 전 발행 불가 — DB CHECK 와 동일 규칙을 시드에서 먼저 적용.
    if (status === "published" && medicalAdjacent && !vetReviewed) {
      console.warn(`  ! ${slug}: 의료 인접 + 감수 미완료 → review_pending 으로 강등`);
      status = "review_pending";
    }

    const existing = await db.select({ id: guides.id, publishedAt: guides.publishedAt }).from(guides).where(eq(guides.slug, slug));
    const publishedAt =
      status === "published" ? (existing[0]?.publishedAt ?? new Date()) : (existing[0]?.publishedAt ?? null);

    const values = {
      slug,
      title,
      summary: data.summary ? String(data.summary) : null,
      bodyMd: content.trim(),
      topicId,
      role: (data.role === "hub" ? "hub" : "spoke") as "hub" | "spoke",
      spokeGroup: data.spokeGroup ? String(data.spokeGroup) : null,
      category,
      bannerSpotTypes: banners,
      status,
      medicalAdjacent,
      vetReviewed,
      vetReviewerName: data.vetReviewerName ? String(data.vetReviewerName) : null,
      vetReviewedAt: data.vetReviewedAt ? String(data.vetReviewedAt) : null,
      publishedAt,
    };

    if (existing[0]) {
      await db.update(guides).set({ ...values, updatedAt: new Date() }).where(eq(guides.id, existing[0].id));
    } else {
      await db.insert(guides).values(values);
    }
    count += 1;
    console.log(`  ${status.padEnd(14)} ${slug}`);
  }

  console.log(`guides: ${count}건 upsert (${GUIDES_DIR})`);

  // 노견생활 신체 영역 Q&A → 게시글 (data/src/guides/seed-posts.ts). 마크다운 글과 같은 upsert 규칙.
  const seniorTopicId = topicBySlug.get("senior-life");
  if (seniorTopicId) {
    let qCount = 0;
    for (const post of seniorSeedPosts()) {
      const existing = await db.select({ id: guides.id }).from(guides).where(eq(guides.slug, post.slug));
      const values = {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        bodyMd: post.bodyMd,
        topicId: seniorTopicId,
        role: "spoke" as const,
        spokeGroup: "body",
        category: post.category,
        status: "published" as const,
        medicalAdjacent: false,
        publishedAt: post.publishedAt,
      };
      if (existing[0]) await db.update(guides).set({ ...values, updatedAt: new Date() }).where(eq(guides.id, existing[0].id));
      else await db.insert(guides).values(values);
      qCount += 1;
    }
    console.log(`guides(신체 영역 Q&A): ${qCount}건 upsert`);
  }
  await closeDb();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
