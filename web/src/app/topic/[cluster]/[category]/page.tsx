import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoriesForTopic, getGuideCategory } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { formatDate } from "@/lib/format";
import { isPinned } from "@/lib/guide-order";
import { countCommentsByGuides } from "@/lib/queries/comments";
import { getTopicBySlug, listGuidesForTopic } from "@/lib/queries/guides";
import { buildMeta, itemListLd, robotsMeta, shouldIndexBoard } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ cluster: string; category: string }>;
}

async function load(cluster: string, category: string) {
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) return null;
  const def = getGuideCategory(topic.slug, decodeURIComponent(category));
  if (!def) return null;
  const { byCategory } = await listGuidesForTopic(topic.id);
  const posts = byCategory.get(def.slug) ?? [];
  return { topic, def, posts };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster, category } = await params;
  const found = await load(cluster, category);
  if (!found) return { robots: robotsMeta(false) };
  const { topic, def, posts } = found;
  return buildMeta({
    title: `${def.name} — ${topic.name} 영역별 정보`,
    description: `${def.blurb} ${def.name}에 관한 글과 보호자들의 경험을 모았습니다.`,
    path: `/topic/${topic.slug}/${def.slug}`,
    indexable: shouldIndexBoard(posts.length),
  });
}

export default async function CategoryBoardPage({ params }: Props) {
  const { cluster, category } = await params;
  const found = await load(cluster, category);
  if (!found) notFound();
  const { topic, def, posts } = found;
  const style = topicStyle(topic.slug);
  const commentCounts = await countCommentsByGuides(posts.map((p) => p.guide.id));
  const others = categoriesForTopic(topic.slug)
    .filter((c) => c.slug !== def.slug)
    .sort((a, b) => Number(b.kind === def.kind) - Number(a.kind === def.kind));
  const writeHref = `/write?topic=${encodeURIComponent(topic.slug)}&category=${encodeURIComponent(def.slug)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: topic.name, path: `/topic/${topic.slug}` },
          { name: def.name, path: `/topic/${topic.slug}/${def.slug}` },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <Link href={def.kind === "body" ? `/topic/${topic.slug}#${def.slug}` : `/topic/${topic.slug}`} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
            {topic.name} · {def.kind === "body" ? "신체 지도로 돌아가기" : "지지 서비스"}
          </Link>
          <h1 className={`mt-3 text-3xl font-extrabold tracking-tight ${style.heading}`}>
            {def.name} <span className="text-lg font-bold text-ink-soft">영역별 정보</span>
          </h1>
          <p className="mt-3 text-ink-soft">{def.blurb}</p>
          {def.directoryType && (
            <Link href={`/spot/type/${def.directoryType}`} className="mt-3 inline-flex items-center rounded-full bg-sea-soft px-3 py-1.5 text-sm font-medium text-sea hover:bg-sea hover:text-white">
              실제 시설 찾기 — 전국 {def.name} 디렉토리 →
            </Link>
          )}
        </div>
        <Link href={writeHref} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
          + 이 부위에 글쓰기
        </Link>
      </header>

      <section className="mt-8">
        <p className="text-xs text-ink-faint">
          {posts.length > 0 ? `${posts.length}편 · 고정 글 다음은 최신순` : ""} 회원 글은 관리자 확인 후 공개되고, 댓글은 각 글에서 남길 수 있습니다.
        </p>
        {posts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 글이 없습니다. 첫 글을 남겨 주세요.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {posts.map(({ guide, authorName }) => {
              const comments = commentCounts.get(guide.id) ?? 0;
              return (
                <li key={guide.id}>
                  <Link href={`/guide/${guide.slug}`} className="group flex flex-col gap-1 px-5 py-4 hover:bg-sand/50">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isPinned(guide) && <span className="rounded-full bg-honey-soft px-2 py-0.5 font-medium text-honey">고정</span>}
                      {authorName ? (
                        <span className="text-ink-faint">회원 글 · {authorName}</span>
                      ) : (
                        <span className="text-ink-faint">운영진</span>
                      )}
                      {guide.vetReviewed && guide.vetReviewerName && <span className="text-sage-deep">수의사 감수</span>}
                    </div>
                    <h2 className="text-base font-bold leading-snug text-ink group-hover:underline">{guide.title}</h2>
                    {guide.summary && <p className="line-clamp-2 text-sm text-ink-soft">{guide.summary}</p>}
                    <p className="text-xs text-ink-faint">
                      {formatDate(guide.publishedAt)} · 댓글 {comments}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-ink">{def.kind === "body" ? "다른 부위" : "다른 카테고리"}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((c) => (
              <Link key={c.slug} href={`/topic/${topic.slug}/${c.slug}`} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:bg-sand hover:text-ink">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <MedicalNotice />
      </div>

      {posts.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${topic.name} ${def.name}`,
            items: posts.map((p) => ({ name: p.guide.title, path: `/guide/${p.guide.slug}` })),
          })}
        />
      )}
    </div>
  );
}
