// 도전 게시판 — 회원이 직접 쓴 글만 모아 보는 별도 게시판.
// 별도 테이블이 아니라 "글쓴이가 회원인가"(guides.author_user_id) 로 가른다. 글은 카테고리(부위)로 분류되지만
// 노출은 큐레이션 콘텐츠·부위별 게시판과 다른 게시판처럼 한다. 운영진이 골라 큐레이션에 올려도 여기에는 그대로 남는다.
// 순위·추천 없이 최신순. 회원 글은 승인(published) 뒤에만 보인다.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChallengeBoardList } from "@/components/challenge-board";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { categoriesForTopic } from "@app/data";
import { countCommentsByGuides } from "@/lib/queries/comments";
import { getTopicBySlug, listGuidesForTopic } from "@/lib/queries/guides";
import { buildMeta, itemListLd, robotsMeta, shouldIndexBoard } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ cluster: string }>;
}

async function load(cluster: string) {
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) return null;
  const { challenge } = await listGuidesForTopic(topic.id);
  return { topic, posts: challenge };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster } = await params;
  const found = await load(cluster);
  if (!found) return { robots: robotsMeta(false) };
  const { topic, posts } = found;
  return buildMeta({
    title: `${topic.name} 도전 게시판 — 보호자들이 직접 쓴 글`,
    description: `${topic.name} 클러스터의 회원 글 ${posts.length}편. 보호자들이 직접 해 본 것과 물어보는 것.`,
    path: `/topic/${topic.slug}/challenge`,
    indexable: shouldIndexBoard(posts.length),
  });
}

export default async function TopicChallengePage({ params }: Props) {
  const { cluster } = await params;
  const found = await load(cluster);
  if (!found) notFound();
  const { topic, posts } = found;
  const style = topicStyle(topic.slug);
  const categories = categoriesForTopic(topic.slug);
  const categoryName = (slug: string | null) => categories.find((c) => c.slug === slug)?.name ?? null;
  const commentCounts = await countCommentsByGuides(posts.map((p) => p.guide.id));
  const writeHref = `/write?topic=${encodeURIComponent(topic.slug)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: topic.name, path: `/topic/${topic.slug}` },
          { name: "도전 게시판", path: `/topic/${topic.slug}/challenge` },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>{topic.name}</span>
          <h1 className={`mt-3 text-3xl font-extrabold tracking-tight ${style.heading}`}>
            도전 게시판 <span className="text-lg font-bold text-ink-soft">보호자들이 직접 쓴 글</span>
          </h1>
          <p className="mt-3 text-ink-soft">
            회원이면 누구나 씁니다. 해 본 것, 잘 안 된 것, 물어보고 싶은 것을 남겨 주세요. 운영진이 확인한 뒤 공개되고, 좋은 글은
            큐레이션 콘텐츠에도 올라갑니다.
          </p>
        </div>
        <Link href={writeHref} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
          + 글쓰기
        </Link>
      </header>

      <section className="mt-8">
        <p className="text-xs text-ink-faint">
          {posts.length > 0 ? `${posts.length}편 · 최신순` : ""} 진단·처방 단정과 광고는 숨김 처리됩니다. 댓글은 각 글에서 남깁니다.
        </p>
        <div className="mt-3">
          <ChallengeBoardList posts={posts} commentCounts={commentCounts} categoryName={categoryName} />
        </div>
      </section>

      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/topic/${topic.slug}`} className="font-medium text-sea hover:underline">
          ← {topic.name} 페이지로
        </Link>
        <Link href={`/topic/${topic.slug}/curated`} className="font-medium text-sea hover:underline">
          큐레이티드 콘텐츠 →
        </Link>
      </p>

      {topic.slug === "senior-life" && (
        <div className="mt-8">
          <MedicalNotice />
        </div>
      )}

      {posts.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${topic.name} 도전 게시판`,
            items: posts.map((p) => ({ name: p.guide.title, path: `/guide/${p.guide.slug}` })),
          })}
        />
      )}
    </div>
  );
}
