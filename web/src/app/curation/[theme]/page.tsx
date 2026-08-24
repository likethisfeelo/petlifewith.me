import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { getCurationByTheme } from "@/lib/queries/curations";
import { articleLd, canonicalUrl, robotsMeta } from "@/lib/seo";

export const revalidate = 86400; // REVALIDATE.curation

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ theme: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { theme } = await params;
  const found = await getCurationByTheme(decodeURIComponent(theme));
  if (!found) return { robots: robotsMeta(false) };
  return {
    title: found.curation.title,
    description: found.curation.introMd?.split("\n")[0] ?? undefined,
    alternates: { canonical: canonicalUrl(`/curation/${found.curation.themeSlug}`) },
    // 자체 가치 판정(3-3): 항목이 없으면 색인하지 않는다
    robots: robotsMeta(found.entries.length > 0),
  };
}

export default async function CurationPage({ params }: Props) {
  const { theme } = await params;
  const found = await getCurationByTheme(decodeURIComponent(theme));
  if (!found) notFound();
  const { curation, entries } = found;

  const intro = curation.introMd ? renderMarkdown(curation.introMd) : null;
  let hasInstagram = false;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "큐레이션", path: "/curation" },
          { name: curation.title, path: `/curation/${curation.themeSlug}` },
        ]}
      />

      <header className="mt-6">
        <span className="rounded-full bg-plum-soft px-2.5 py-1 text-xs font-medium text-plum">테마 큐레이션</span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{curation.title}</h1>
        <p className="mt-2 text-xs text-ink-faint">{formatDate(curation.publishedAt)} 발행</p>
      </header>

      {intro && (
        <div className="guide-prose prose prose-neutral mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: intro.html }} />
      )}

      <div className="mt-8 space-y-8">
        {entries.map((entry, i) => {
          const summary = renderMarkdown(entry.summaryMd);
          if (entry.embedSource === "instagram") hasInstagram = true;
          return (
            <section key={entry.id} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold text-ink-faint">#{i + 1}</p>

              {/* 임베드는 공식 플레이어/공식 코드만. 출처는 해당 위치에 표기 (기획서 3-2·3-4) */}
              {entry.embedSource === "youtube" && entry.embedRef && (
                <figure className="md-embed">
                  <div className="md-embed-frame">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(entry.embedRef)}`}
                      title={`${entry.creatorName} 영상`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                  <figcaption>
                    영상: {entry.creatorName} ·{" "}
                    <a href={entry.originalUrl} target="_blank" rel="noopener noreferrer">
                      원본 보기
                    </a>
                  </figcaption>
                </figure>
              )}
              {entry.embedSource === "instagram" && entry.embedRef && (
                <figure className="md-embed">
                  <blockquote
                    className="instagram-media"
                    data-instgrm-permalink={entry.embedRef}
                    data-instgrm-version="14"
                  >
                    <a href={entry.embedRef} target="_blank" rel="noopener noreferrer">
                      Instagram 게시물 보기
                    </a>
                  </blockquote>
                  <figcaption>
                    게시물: {entry.creatorName} ·{" "}
                    <a href={entry.originalUrl} target="_blank" rel="noopener noreferrer">
                      원본 보기
                    </a>
                  </figcaption>
                </figure>
              )}
              {entry.embedSource === "none" && (
                <p className="text-sm">
                  <a
                    href={entry.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-plum hover:underline"
                  >
                    {entry.creatorName} 의 원본 콘텐츠 보러 가기 ↗
                  </a>
                </p>
              )}

              {/* 임베드를 빼도 읽을 가치가 있어야 한다 — 우리 언어로 쓴 요약 (기획서 3-3) */}
              <div
                className="guide-prose prose prose-neutral mt-3 max-w-none text-[15px]"
                dangerouslySetInnerHTML={{ __html: summary.html }}
              />
            </section>
          );
        })}
      </div>

      {entries.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          항목을 준비 중입니다.
        </p>
      )}

      <JsonLd
        data={articleLd({
          title: curation.title,
          description: curation.introMd?.split("\n")[0] ?? null,
          path: `/curation/${curation.themeSlug}`,
          publishedAt: curation.publishedAt,
          updatedAt: curation.updatedAt,
        })}
      />
      {hasInstagram && <InstagramEmbedScript />}
    </article>
  );
}
