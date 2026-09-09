// 큐레이션 콘텐츠 전체 — 토픽 페이지 상단 그리드는 9편만 보여 주므로 "큐레이션 전체 보기 →" 가 여기로 온다.
// 운영진이 발행한 글과 운영진이 골라 올린 회원 글만 (guides.curated). 정렬은 지정 순번 → 최신순.
// 부위별 게시판·도전 게시판과는 다른 묶음이라 여기에는 카테고리 칩을 두지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { categoriesForTopic } from "@app/data";
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
  const { curated } = await listGuidesForTopic(topic.id);
  return { topic, items: curated };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster } = await params;
  const found = await load(cluster);
  if (!found) return { robots: robotsMeta(false) };
  const { topic, items } = found;
  return buildMeta({
    title: `${topic.name} 큐레이티드 콘텐츠`,
    description: `${topic.name} 클러스터에서 운영진이 발행하고 고른 글 ${items.length}편.`,
    path: `/topic/${topic.slug}/curated`,
    indexable: shouldIndexBoard(items.length),
  });
}

export default async function TopicCuratedPage({ params }: Props) {
  const { cluster } = await params;
  const found = await load(cluster);
  if (!found) notFound();
  const { topic, items } = found;
  const style = topicStyle(topic.slug);
  const categories = categoriesForTopic(topic.slug);
  const categoryName = (slug: string | null) => categories.find((c) => c.slug === slug)?.name ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: topic.name, path: `/topic/${topic.slug}` },
          { name: "큐레이티드 콘텐츠", path: `/topic/${topic.slug}/curated` },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Long Live Petlifewithme · Curated Content
        </p>
        <h1 className={`mt-1 text-3xl font-extrabold tracking-tight ${style.heading}`}>{topic.name} 큐레이티드 콘텐츠</h1>
        <p className="mt-3 text-sm text-ink-soft">
          운영진이 발행하거나 골라 올린 글 {items.length.toLocaleString("ko-KR")}편 · 운영진이 정한 순서가 먼저, 그다음 최신순입니다.
        </p>
      </header>

      <section className="mt-8">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 글이 없습니다. 발행 전 감수·검수 절차를 거칩니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <GuideCard
                key={i.guide.id}
                guide={i.guide}
                showTopic={false}
                categoryName={categoryName(i.guide.category)}
                authorName={i.authorName}
                thumbnail
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/topic/${topic.slug}`} className="font-medium text-sea hover:underline">
          ← {topic.name} 페이지로
        </Link>
        <Link href={`/topic/${topic.slug}/challenge`} className="font-medium text-sea hover:underline">
          도전 게시판 (회원 글) →
        </Link>
      </p>

      {topic.slug === "senior-life" && (
        <div className="mt-8">
          <MedicalNotice />
        </div>
      )}

      {items.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${topic.name} 큐레이티드 콘텐츠`,
            items: items.map((i) => ({ name: i.guide.title, path: `/guide/${i.guide.slug}` })),
          })}
        />
      )}
    </div>
  );
}
