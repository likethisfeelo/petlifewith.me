import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReactionButtons } from "@/components/reactions/reaction-buttons";
import { TopicTagline } from "@/components/site-tagline";
import { GuideCard } from "@/components/cards";
import { EntityTagPanels, hasEntityTags } from "@/components/entity-panels";
import { InstagramEmbedScript } from "@/components/instagram-script";
import { JsonLd } from "@/components/jsonld";
import { CommentSection } from "@/components/comments";
import { AffiliateDisclosure, MedicalNotice, MemberPostNote, VetReviewBadge } from "@/components/notices";
import { getGuideCategory } from "@app/data";
import { SpotTypeBanners } from "@/components/spot-type-banners";
import { countIndexableSpotsForType, listSpotTypesBySlugs } from "@/lib/queries/spots";
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
import { tagHref } from "@/lib/tags";
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
  // 상단 디렉토리 배너 — 관리자가 지정한 스팟 유형(공개 유형만) + 전국 영업 중 수
  const bannerTypes = await listSpotTypesBySlugs(guide.bannerSpotTypes);
  const bannerCounts = new Map(await Promise.all(bannerTypes.map(async (t) => [t.id, await countIndexableSpotsForType(t.id)] as const)));
  // 회원 글의 외부 링크에는 nofollow ugc — 승인은 했지만 검색 권위를 넘기지 않는다
  const rendered = renderMarkdown(guide.bodyMd, { ugc: isMemberPost });
  const showDisclosure = rendered.hasAffiliateLinks || tags.hasAffiliateOffers;
  const style = topicStyle(topic.slug);
  const hub = topicGuides.hub && topicGuides.hub.id !== guide.id ? topicGuides.hub : null;
  // 놀이 글: 태그된 상품·브랜드(제품 링크·홈페이지)·장소·기기를 본문 오른쪽 고정 패널로 (모바일은 본문 아래)
  const sideTags = topic.slug === "play" && hasEntityTags(tags);

  return (
    <div className={sideTags ? "mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : ""}>
    <article className={sideTags ? "min-w-0 max-w-3xl" : "mx-auto max-w-3xl px-4 py-10"}>
      {/* 머리글·푸터 태그라인에 이 글의 토픽을 알린다 (놀이 → "즐거운 삶") */}
      <TopicTagline topic={topic.slug} />
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
          <span className="ml-auto">
            <ReactionButtons target="guide" id={guide.id} kinds={["like", "save"]} nextPath={`/guide/${guide.slug}`} size="sm" />
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
          {guide.title}
        </h1>
        {guide.summary && <p className="mt-3 text-base leading-relaxed text-ink-soft">{guide.summary}</p>}
        {guide.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5" aria-label="태그">
            {guide.tags.map((t) => (
              <Link key={t} href={tagHref(t)} className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft hover:bg-ink hover:text-cream">
                #{t}
              </Link>
            ))}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          {formatDate(guide.publishedAt)} 발행
          {guide.updatedAt && guide.publishedAt && guide.updatedAt.getTime() - guide.publishedAt.getTime() > 86_400_000
            ? ` · ${formatDate(guide.updatedAt)} 업데이트`
            : ""}
        </p>
      </header>

      {bannerTypes.length > 0 && <SpotTypeBanners types={bannerTypes} counts={bannerCounts} />}

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

      {hasEntityTags(tags) && !sideTags && (
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
    {sideTags && (
      <aside aria-label="이 글의 상품·브랜드·장소" className="lg:sticky lg:top-20">
        <div className="rounded-2xl border border-line bg-cream/60 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">In this post</p>
          <EntityTagPanels tags={tags} compact />
        </div>
      </aside>
    )}
    </div>
  );
}
