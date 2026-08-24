import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { EntityTagPanels } from "@/components/entity-panels";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { AffiliateDisclosure, MedicalNotice, VetReviewBadge } from "@/components/notices";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import {
  getGuideEntityTags,
  getPublishedGuide,
  listGuidesForTopic,
  relatedGuides,
} from "@/lib/queries/guides";
import { articleLd, canonicalUrl, robotsMeta } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 86400; // REVALIDATE.guide

export function generateStaticParams() {
  return []; // 온디맨드 ISR — 빌드 시 DB 불필요
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPublishedGuide(decodeURIComponent(slug));
  if (!found) return { robots: robotsMeta(false) };
  const { guide } = found;
  return {
    title: guide.title,
    description: guide.summary ?? undefined,
    alternates: { canonical: canonicalUrl(`/guide/${guide.slug}`) },
    robots: robotsMeta(true),
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const found = await getPublishedGuide(decodeURIComponent(slug));
  if (!found) notFound();
  const { guide, topic } = found;

  const [tags, related, topicGuides] = await Promise.all([
    getGuideEntityTags(guide.id),
    relatedGuides(guide.id, guide.topicId, 3),
    listGuidesForTopic(guide.topicId),
  ]);

  const rendered = renderMarkdown(guide.bodyMd);
  const showDisclosure = rendered.hasAffiliateLinks || tags.hasAffiliateOffers;
  const style = topicStyle(topic.slug);
  const hub = topicGuides.hub && topicGuides.hub.id !== guide.id ? topicGuides.hub : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: topic.name, path: `/topic/${topic.slug}` },
          { name: guide.title, path: `/guide/${guide.slug}` },
        ]}
      />

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/topic/${topic.slug}`} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
            {topic.name}
          </Link>
          {guide.role === "hub" && (
            <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-soft">클러스터 전체 지도</span>
          )}
          {guide.vetReviewed && guide.vetReviewerName && (
            <VetReviewBadge reviewerName={guide.vetReviewerName} reviewedAt={guide.vetReviewedAt} />
          )}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
          {guide.title}
        </h1>
        {guide.summary && <p className="mt-3 text-base leading-relaxed text-ink-soft">{guide.summary}</p>}
        <p className="mt-3 text-xs text-ink-faint">
          {formatDate(guide.publishedAt)} 발행
          {guide.updatedAt && guide.publishedAt && guide.updatedAt.getTime() - guide.publishedAt.getTime() > 86_400_000
            ? ` · ${formatDate(guide.updatedAt)} 업데이트`
            : ""}
        </p>
      </header>

      {showDisclosure && (
        <div className="mt-6">
          <AffiliateDisclosure />
        </div>
      )}

      <div
        className="guide-prose prose prose-neutral mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />

      {guide.medicalAdjacent && (
        <div className="mt-10">
          <MedicalNotice />
        </div>
      )}

      {(tags.items.length > 0 || tags.spots.length > 0 || tags.makers.length > 0 || tags.devices.length > 0) && (
        <div className="mt-10 border-t border-line pt-8">
          <EntityTagPanels tags={tags} />
        </div>
      )}

      {(hub || related.length > 0) && (
        <div className="mt-12 border-t border-line pt-8">
          {hub && (
            <Link
              href={`/guide/${hub.slug}`}
              className={`block rounded-xl border p-4 text-sm font-medium ${style.card} hover:shadow-sm`}
            >
              ↗ {topic.name} 전체 지도 보기 — {hub.title}
            </Link>
          )}
          {related.filter((g) => g.id !== hub?.id).length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-bold text-ink">{topic.name}의 다른 이야기</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {related
                  .filter((g) => g.id !== hub?.id)
                  .map((g) => (
                    <GuideCard key={g.id} guide={g} showTopic={false} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      <JsonLd
        data={articleLd({
          title: guide.title,
          description: guide.summary,
          path: `/guide/${guide.slug}`,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
          reviewedByVet: guide.vetReviewed ? guide.vetReviewerName : null,
        })}
      />
      {rendered.hasInstagramEmbed && <InstagramEmbedScript />}
    </article>
  );
}
