// 태그 페이지 — 모든 토픽의 발행 글 가운데 이 태그가 붙은 글. 글 3편 미만이면 noindex (게시판과 같은 게이트).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { listGuidesByTag, listPopularTags } from "@/lib/queries/tags";
import { buildMeta, itemListLd, robotsMeta, shouldIndexBoard } from "@/lib/seo";
import { normalizeTag, tagHref } from "@/lib/tags";

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ tag: string }>;
}

function readTag(raw: string): string | null {
  try {
    return normalizeTag(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = readTag((await params).tag);
  if (!tag) return { robots: robotsMeta(false) };
  const posts = await listGuidesByTag(tag);
  return buildMeta({
    title: `#${tag}`,
    description: `#${tag} 태그가 붙은 글 ${posts.length}편.`,
    path: tagHref(tag),
    indexable: shouldIndexBoard(posts.length),
  });
}

export default async function TagPage({ params }: Props) {
  const tag = readTag((await params).tag);
  if (!tag) notFound();
  const [posts, popular] = await Promise.all([listGuidesByTag(tag), listPopularTags(20)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: `#${tag}`, path: tagHref(tag) }]} />
      <header className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Tag</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">#{tag}</h1>
        <p className="mt-2 text-sm text-ink-soft">이 태그가 붙은 글 {posts.length}편 · 최신순</p>
      </header>

      <section className="mt-8">
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 이 태그가 붙은 글이 없습니다.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <GuideCard key={p.guide.id} guide={p.guide} topic={p.topic} authorName={p.authorName} thumbnail />
            ))}
          </div>
        )}
      </section>

      {popular.length > 0 && (
        <nav aria-label="많이 쓰인 태그" className="mt-10 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-ink-faint">다른 태그:</span>
          {popular
            .filter((t) => t.tag !== tag)
            .map((t) => (
              <Link key={t.tag} href={tagHref(t.tag)} className="rounded-full border border-line px-2.5 py-1 text-ink-soft hover:bg-sand hover:text-ink">
                #{t.tag} <span className="text-ink-faint">{t.count}</span>
              </Link>
            ))}
        </nav>
      )}

      {posts.length > 0 && (
        <JsonLd data={itemListLd({ name: `#${tag}`, items: posts.map((p) => ({ name: p.guide.title, path: `/guide/${p.guide.slug}` })) })} />
      )}
    </div>
  );
}
