import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { BuiltinToolView } from "@/components/tools/builtin-tool";
import { HtmlToolFrame } from "@/components/tools/html-tool-frame";
import { TrackContext } from "@/components/tracker";
import { assetUrl } from "@/lib/assets";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { getPublishedNews } from "@/lib/queries/news";
import { articleLd, buildMeta, robotsMeta } from "@/lib/seo";
import { builtinTool, newsCategoryLabel } from "@/lib/tools";

export const revalidate = 86400; // REVALIDATE.news

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNews(decodeURIComponent(slug));
  if (!post) return { robots: robotsMeta(false) };
  return buildMeta({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.summary ?? undefined,
    path: `/news/${post.slug}`,
    indexable: true,
    ogImageUrl: assetUrl(post.ogImageKey ?? post.heroImageKey),
    type: "article",
    publishedAt: post.publishedAt,
    modifiedAt: post.updatedAt,
  });
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedNews(decodeURIComponent(slug));
  if (!post) notFound();

  const body = post.bodyMd ? renderMarkdown(post.bodyMd) : null;
  const hero = assetUrl(post.heroImageKey);
  const tool = builtinTool(post.toolKey);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <TrackContext entity_type="news" entity_id={post.slug} category={post.category} />
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "뉴스", path: "/news" },
          { name: post.title, path: `/news/${post.slug}` },
        ]}
      />

      <header className="mt-6">
        <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-soft">{newsCategoryLabel(post.category)}</span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{post.title}</h1>
        <p className="mt-2 text-xs text-ink-faint">
          {formatDate(post.publishedAt)} 발행
          {post.updatedAt && post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 86_400_000 && ` · ${formatDate(post.updatedAt)} 수정`}
        </p>
        {post.summary && <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">{post.summary}</p>}
      </header>

      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero} alt={post.title} className="mt-6 w-full rounded-2xl bg-sand" loading="eager" decoding="async" />
      )}

      {body && <div className="guide-prose prose prose-neutral mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: body.html }} />}

      {tool && (
        <section className="mt-10" aria-label={tool.label}>
          <BuiltinToolView toolKey={tool.key} />
        </section>
      )}
      {!tool && post.toolHtml && (
        // 업로드 HTML 은 본문 폭보다 넓게 — 도구 자체가 레이아웃을 갖고 있다
        <section className="relative left-1/2 mt-10 w-screen max-w-6xl -translate-x-1/2 px-0 sm:px-4" aria-label="도구">
          <HtmlToolFrame html={post.toolHtml} title={post.title} storageKey={post.slug} minHeight={post.toolHeight ?? 900} />
        </section>
      )}

      <p className="mt-12 text-sm">
        <Link href="/news" className="font-medium text-ink-soft hover:text-ink hover:underline">
          ← 뉴스 목록
        </Link>
      </p>

      <JsonLd
        data={articleLd({
          title: post.title,
          description: post.summary,
          path: `/news/${post.slug}`,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          imageUrl: assetUrl(post.ogImageKey ?? post.heroImageKey),
        })}
      />
      {body?.hasInstagramEmbed && <InstagramEmbedScript />}
    </article>
  );
}
