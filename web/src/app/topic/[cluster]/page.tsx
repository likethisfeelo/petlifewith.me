import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoriesForTopic } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { SeniorBodyMap, type MapPost } from "@/components/senior-body-map";
import { TOPIC_PHASE_LABEL } from "@/lib/format";
import { isPinned } from "@/lib/guide-order";
import { getTopicBySlug, listGuidesForTopic } from "@/lib/queries/guides";
import { buildMeta, itemListLd, robotsMeta } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ cluster: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster } = await params;
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) return { robots: robotsMeta(false) };
  const { all } = await listGuidesForTopic(topic.id);
  return buildMeta({
    title: `${topic.name} — 토픽 허브`,
    description: topic.description,
    path: `/topic/${topic.slug}`,
    indexable: all.length > 0,
  });
}

export default async function TopicPage({ params }: Props) {
  const { cluster } = await params;
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) notFound();

  const { hub, items, byCategory, all } = await listGuidesForTopic(topic.id);
  const style = topicStyle(topic.slug);
  const categories = categoriesForTopic(topic.slug);
  const categoryName = (slug: string | null) => categories.find((c) => c.slug === slug)?.name ?? null;
  // 정렬은 쿼리가 끝냈다: 최상단 고정(1~3) → 최신순. 여기서는 두 묶음으로 나눠 그린다.
  const pinned = items.filter((i) => isPinned(i.guide));
  const latest = items.filter((i) => !isPinned(i.guide));
  const isSenior = topic.slug === "senior-life";
  const postsByCategory: Record<string, MapPost[]> = {};
  for (const [slug, list] of byCategory) {
    postsByCategory[slug] = list.map((i) => ({ slug: i.guide.slug, title: i.guide.title, summary: i.guide.summary, authorName: i.authorName }));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: topic.name, path: `/topic/${topic.slug}` }]} />

      <header className="mt-6 max-w-3xl">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
          {TOPIC_PHASE_LABEL[topic.phase] ?? topic.phase}
        </span>
        <h1 className={`mt-3 text-3xl font-extrabold tracking-tight ${style.heading}`}>
          {isSenior ? "신체 영역별로 살펴보기" : topic.name}
        </h1>
        <p className="mt-3 text-ink-soft">
          {isSenior
            ? "몸의 변화는 영역별로 신호가 다릅니다. 강아지 그림에서 지금 눈에 밟히는 부위를 올려 보고, 눌러 관찰 포인트와 관련 글을 여세요."
            : topic.description}
        </p>
      </header>

      {/* 신체 지도 — 노견생활 전용. 카테고리 정의는 data/src/guides/categories.ts */}
      {isSenior && categories.length > 0 && <SeniorBodyMap areas={categories} postsByCategory={postsByCategory} />}

      {hub && (
        <Link
          href={`/guide/${hub.slug}`}
          className={`mt-8 block rounded-2xl border p-5 transition-shadow hover:shadow-md ${style.card}`}
        >
          <p className="text-xs font-semibold text-ink-soft">여기서 시작 — 클러스터 전체 지도</p>
          <h2 className="mt-1.5 text-lg font-extrabold text-ink">{hub.title}</h2>
          {hub.summary && <p className="mt-1.5 text-sm text-ink-soft">{hub.summary}</p>}
        </Link>
      )}

      {pinned.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink">지금 읽을 글</h2>
          <p className="mt-1 text-xs text-ink-faint">운영진이 맨 위에 고정한 글입니다.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((i) => (
              <GuideCard key={i.guide.id} guide={i.guide} showTopic={false} categoryName={categoryName(i.guide.category)} authorName={i.authorName} pinned />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">
            최신 글 <span className="text-sm font-medium text-ink-faint">새 글이 맨 위로 옵니다</span>
          </h2>
          <Link href="/write" className="text-sm font-medium text-sea hover:underline">
            회원 글쓰기 →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 글이 없습니다. 발행 전 감수·검수 절차를 거칩니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((i) => (
              <GuideCard key={i.guide.id} guide={i.guide} showTopic={false} categoryName={categoryName(i.guide.category)} authorName={i.authorName} />
            ))}
          </div>
        )}
      </section>

      {isSenior && (
        <div className="mt-10">
          <MedicalNotice />
        </div>
      )}

      {all.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${topic.name} 콘텐츠`,
            items: all.map((g) => ({ name: g.title, path: `/guide/${g.slug}` })),
          })}
        />
      )}
    </div>
  );
}
