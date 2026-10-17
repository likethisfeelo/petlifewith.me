import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { NewsBanners } from "@/components/news-banners";
import { BuiltinToolView } from "@/components/tools/builtin-tool";
import { HtmlToolFrame } from "@/components/tools/html-tool-frame";
import { TrackContext } from "@/components/tracker";
import { assetUrl } from "@/lib/assets";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { visibleNewsBanners } from "@/lib/news-banners";
import { getPublishedNews } from "@/lib/queries/news";
import { getNewsBanners, getPetsegwonStats } from "@/lib/queries/settings";
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
  const [post, allBanners] = await Promise.all([getPublishedNews(decodeURIComponent(slug)), getNewsBanners()]);
  if (!post) notFound();
  const banners = visibleNewsBanners(allBanners);

  const body = post.bodyMd ? renderMarkdown(post.bodyMd) : null;
  const hero = assetUrl(post.heroImageKey);
  const tool = builtinTool(post.toolKey);
  const petsegwonStats = tool?.key === "petsegwon" ? await getPetsegwonStats() : undefined;

  return (
    // 뉴스 목록과 같은 틀 — 헤더 폭(max-w-6xl)에서 왼쪽 정렬, 오른쪽은 이미지 배너 (모바일은 본문 아래)
    <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-10 ${banners.length ? "lg:grid-cols-[minmax(0,1fr)_17.5rem]" : ""}`}>
    <article className="min-w-0">
      <TrackContext entity_type="news" entity_id={post.slug} category={post.category} />
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "뉴스", path: "/news" },
          { name: post.title, path: `/news/${post.slug}` },
        ]}
      />

      <header className="mt-6 max-w-3xl">
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
        <img src={hero} alt={post.title} className="mt-6 w-full max-w-3xl rounded-2xl bg-sand" loading="eager" decoding="async" />
      )}

      {body && <div className="guide-prose prose prose-neutral mt-8 max-w-3xl" dangerouslySetInnerHTML={{ __html: body.html }} />}

      {tool && (
        <section className="mt-10" aria-label={tool.label}>
          <BuiltinToolView toolKey={tool.key} petsegwonStats={petsegwonStats} />
        </section>
      )}
      {!tool && post.toolHtml && (
        // 업로드 HTML 은 왼쪽 칸 전체 폭. 도구 안쪽 여백(16px)만큼 바깥으로 넓혀 도구 내용의 왼쪽 끝이 본문 글자와 맞게 한다
        <section className="-mx-4 mt-10" aria-label="도구">
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

    {banners.length > 0 && (
      <aside aria-label="배너" className="lg:self-start">
        <NewsBanners banners={banners} />
      </aside>
    )}
    </div>
  );
}
