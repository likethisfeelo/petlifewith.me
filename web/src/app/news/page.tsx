import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { assetUrl } from "@/lib/assets";
import { formatDate } from "@/lib/format";
import { listPublishedNews } from "@/lib/queries/news";
import { buildMeta } from "@/lib/seo";
import { newsCategoryLabel } from "@/lib/tools";

export const revalidate = 86400; // REVALIDATE.news

export function generateMetadata(): Metadata {
  return buildMeta({
    title: "뉴스",
    description: "반려생활과 반려동물 영업장에 필요한 소식, 바뀐 제도, 바로 쓸 수 있는 도구를 정리합니다.",
    path: "/news",
    indexable: true,
  });
}

export default async function NewsIndexPage() {
  const posts = await listPublishedNews();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "뉴스", path: "/news" }]} />

      <header className="mt-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">뉴스</h1>
        <p className="mt-3 text-ink-soft">반려생활과 반려동물 영업장에 필요한 소식, 바뀐 제도, 바로 쓸 수 있는 도구를 정리합니다.</p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">첫 소식을 준비 중입니다.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {posts.map((p) => {
            const thumb = assetUrl(p.heroImageKey);
            return (
              <li key={p.id}>
                <Link
                  href={`/news/${p.slug}`}
                  data-track="entity_click"
                  data-track-entity-type="news"
                  data-track-entity-id={p.slug}
                  className="group flex gap-4 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">{newsCategoryLabel(p.category)}</span>
                      {p.hasTool && p.category !== "tool" && <span className="rounded-full bg-sea/10 px-2 py-0.5 font-medium text-sea">도구</span>}
                      <span className="text-ink-faint">{formatDate(p.publishedAt)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold leading-snug text-ink group-hover:underline">{p.title}</h2>
                    {p.summary && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{p.summary}</p>}
                  </div>
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-20 w-28 shrink-0 rounded-lg bg-sand object-cover sm:h-24 sm:w-36" loading="lazy" decoding="async" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
