// 토픽 전체 글 목록 — 토픽 페이지 상단 큐레이션 그리드가 9편만 보여 주므로,
// "전체 글보기 →" 가 여기로 온다. 정렬은 토픽 페이지와 같다(최상단 고정 → 최신순).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { categoriesForTopic } from "@app/data";
import { isPinned } from "@/lib/guide-order";
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
  const { items } = await listGuidesForTopic(topic.id);
  return { topic, items };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster } = await params;
  const found = await load(cluster);
  if (!found) return { robots: robotsMeta(false) };
  const { topic, items } = found;
  return buildMeta({
    title: `${topic.name} 전체 글`,
    description: `${topic.name} 클러스터에 발행된 글 ${items.length}편을 최신순으로 모았습니다.`,
    path: `/topic/${topic.slug}/archive`,
    indexable: shouldIndexBoard(items.length),
  });
}

export default async function TopicArchivePage({ params }: Props) {
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
          { name: "전체 글", path: `/topic/${topic.slug}/archive` },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Long Live Petlifewithme · Curated Content
        </p>
        <h1 className={`mt-1 text-3xl font-extrabold tracking-tight ${style.heading}`}>{topic.name} 전체 글</h1>
        <p className="mt-3 text-sm text-ink-soft">
          발행된 글 {items.length.toLocaleString("ko-KR")}편 · 최상단 고정 글이 먼저, 그다음 최신순입니다.
        </p>
      </header>

      {categories.length > 0 && (
        <nav aria-label="카테고리별 게시판" className="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-ink-faint">카테고리:</span>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/topic/${topic.slug}/${c.slug}`}
              className="rounded-full border border-line px-2.5 py-1 text-ink-soft hover:bg-sand hover:text-ink"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

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
                pinned={isPinned(i.guide)}
                thumbnail
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-sm">
        <Link href={`/topic/${topic.slug}`} className="font-medium text-sea hover:underline">
          ← {topic.name} 페이지로
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
            name: `${topic.name} 전체 글`,
            items: items.map((i) => ({ name: i.guide.title, path: `/guide/${i.guide.slug}` })),
          })}
        />
      )}
    </div>
  );
}
