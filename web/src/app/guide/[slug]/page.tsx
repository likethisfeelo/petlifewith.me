import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { EntityTagPanels } from "@/components/entity-panels";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { CommentSection } from "@/components/comments";
import { AffiliateDisclosure, MedicalNotice, MemberPostNote, VetReviewBadge } from "@/components/notices";
import { getGuideCategory } from "@app/data";
import { CategoryBanners } from "@/components/category-banners";
import { listVisibleComments } from "@/lib/queries/comments";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import {
  getGuideEntityTags,
  getPublishedGuide,
  listGuidesForTopic,
  relatedGuides,
} from "@/lib/queries/guides";
import { articleLd, buildMeta, robotsMeta, shouldIndexGuide } from "@/lib/seo";
import { assetUrl } from "@/lib/assets";
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
  // 페이지별 SEO 오버라이드(seo_title/seo_description/og_image_key) 우선, 없으면 자동 생성
  return buildMeta({
    title: guide.seoTitle ?? guide.title,
    description: guide.seoDescription ?? guide.summary,
    path: `/guide/${guide.slug}`,
    // 본문이 짧은 글(지도 Q&A 시드 등)은 늘리기 전까지 noindex (claude.md 5-3)
    indexable: shouldIndexGuide(guide.bodyMd),
    ogImageUrl: assetUrl(guide.ogImageKey ?? guide.heroImageKey),
    type: "article",
    publishedAt: guide.publishedAt,
    modifiedAt: guide.updatedAt,
    // 의료 인접 편은 광고 지면으로 쓰지 않는다 — 수익은 비의료 쪽에서 (기획서 SECTION 02)
    ads: !guide.medicalAdjacent,
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const found = await getPublishedGuide(decodeURIComponent(slug));
  if (!found) notFound();
  const { guide, topic, authorName } = found;

  const [tags, related, topicGuides, comments] = await Promise.all([
    getGuideEntityTags(guide.id),
    relatedGuides(guide.id, guide.topicId, 3),
    listGuidesForTopic(guide.topicId),
    listVisibleComments(guide.id),
  ]);

  const isMemberPost = Boolean(guide.authorUserId);
  const category = getGuideCategory(topic.slug, guide.category);
  // 상단 배너 — 관리자가 지정한 카테고리만, 정의에 있는 것만 (게시판 글 수 함께)
  const bannerDefs = guide.bannerCategories
    .map((slug) => getGuideCategory(topic.slug, slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const bannerCounts = new Map(bannerDefs.map((c) => [c.slug, topicGuides.byCategory.get(c.slug)?.length ?? 0]));
  // 회원 글의 외부 링크에는 nofollow ugc — 승인은 했지만 검색 권위를 넘기지 않는다
  const rendered = renderMarkdown(guide.bodyMd, { ugc: isMemberPost });
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
          {category && (
            <Link href={`/topic/${topic.slug}#${category.slug}`} className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-ink hover:text-cream">
              {category.name}
            </Link>
          )}
          {guide.role === "hub" && (
            <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink-soft">클러스터 전체 지도</span>
          )}
          {isMemberPost && authorName && (
            <span className="rounded-full bg-honey-soft px-2.5 py-1 text-xs font-medium text-honey">회원 글 · {authorName}</span>
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

      {bannerDefs.length > 0 && <CategoryBanners topicSlug={topic.slug} categories={bannerDefs} counts={bannerCounts} />}

      {assetUrl(guide.heroImageKey) && (
        // 대표 이미지 — 직접 촬영·제작분만 업로드한다 (재호스팅 금지, 운영 규칙 3-1)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(guide.heroImageKey)}
          alt={guide.title}
          className="mt-6 w-full rounded-2xl bg-sand"
          loading="eager"
          decoding="async"
        />
      )}

      {isMemberPost && authorName && <MemberPostNote authorName={authorName} />}

      {showDisclosure && (
        <div className="mt-6">
          <AffiliateDisclosure />
        </div>
      )}

      <div
        className="guide-prose prose prose-neutral mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />

      {/* 노견 클러스터는 필연적으로 의료에 근접한다 — 플래그와 무관하게 결론을 고정 (claude.md 6-2) */}
      {(guide.medicalAdjacent || topic.slug === "senior-life") && (
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

      <CommentSection guideId={guide.id} slug={guide.slug} comments={comments} />

      <JsonLd
        data={articleLd({
          title: guide.title,
          description: guide.summary,
          path: `/guide/${guide.slug}`,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
          reviewedByVet: guide.vetReviewed ? guide.vetReviewerName : null,
          imageUrl: assetUrl(guide.ogImageKey ?? guide.heroImageKey),
        })}
      />
      {rendered.hasInstagramEmbed && <InstagramEmbedScript />}
    </article>
  );
}
