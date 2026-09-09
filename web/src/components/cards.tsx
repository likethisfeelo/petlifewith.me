import Link from "next/link";
import type { GuideRow, TopicRow } from "@/lib/queries/guides";
import type { SpotWithMeta } from "@/lib/queries/spots";
import type { MakerRow } from "@/lib/queries/makers";
import { topicStyle } from "@/lib/topic-style";
import { MAKER_CATEGORY_LABEL, SPOT_STATUS_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { assetUrl } from "@/lib/assets";
import { AdLabel, FactBadge } from "./notices";

/** 대표 이미지가 없는 글의 섬네일 자리 — 빈 사각형 대신 발자국 문양을 옅게 깐다 */
function ThumbPlaceholder() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-sand" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-12 w-12 text-ink-faint/35" fill="currentColor">
        <ellipse cx="16" cy="16" rx="4.4" ry="5.6" />
        <ellipse cx="27" cy="12.5" rx="4.2" ry="5.4" />
        <ellipse cx="37" cy="18" rx="4" ry="5" />
        <path d="M24.5 22c-5.6 0-9.6 4.2-9.6 8.6 0 3.5 2.9 5.4 6.6 5.4h6c3.7 0 6.6-1.9 6.6-5.4 0-4.4-4-8.6-9.6-8.6Z" />
      </svg>
    </span>
  );
}

export function GuideCard({
  guide,
  topic,
  showTopic = true,
  categoryName,
  authorName,
  badge,
  thumbnail = false,
}: {
  guide: GuideRow;
  topic?: TopicRow;
  showTopic?: boolean;
  /** 카테고리(위치) 표시명 — 토픽 페이지가 넘긴다 */
  categoryName?: string | null;
  /** 회원 글이면 닉네임 */
  authorName?: string | null;
  /** 강조 배지 — "대표", "큐레이션 1" 처럼 짧게. 있으면 테두리도 강조된다 */
  badge?: string | null;
  /** 상단에 대표 이미지 섬네일을 붙인다 (없으면 발자국 자리표시) */
  thumbnail?: boolean;
}) {
  const style = topic ? topicStyle(topic.slug) : null;
  const thumbSrc = thumbnail ? assetUrl(guide.heroImageKey) : undefined;
  return (
    <Link
      href={`/guide/${guide.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-md ${
        badge ? "border-honey/40" : "border-line"
      }`}
    >
      {thumbnail && (
        <span className="block aspect-[16/10] w-full overflow-hidden bg-sand">
          {thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <ThumbPlaceholder />
          )}
        </span>
      )}
      <span className="flex flex-1 flex-col p-5">
        <span className="flex flex-wrap items-center gap-2 text-xs">
          {badge && <span className="rounded-full bg-honey-soft px-2 py-0.5 font-medium text-honey">{badge}</span>}
          {showTopic && topic && style && (
            <span className={`rounded-full px-2 py-0.5 font-medium ${style.chip}`}>{topic.name}</span>
          )}
          {categoryName && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">{categoryName}</span>}
          {guide.role === "hub" && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">전체 지도</span>}
          {guide.vetReviewed && guide.vetReviewerName && <span className="text-sage-deep">수의사 감수</span>}
        </span>
        <span className="mt-2 block text-base font-bold leading-snug text-ink group-hover:underline">{guide.title}</span>
        {guide.summary && <span className="mt-1.5 line-clamp-2 block text-sm text-ink-soft">{guide.summary}</span>}
        <span className="mt-auto block pt-3 text-xs text-ink-faint">
          {authorName ? `${authorName} · ` : ""}
          {formatDate(guide.publishedAt)}
        </span>
      </span>
    </Link>
  );
}

export function SpotCard({ item }: { item: SpotWithMeta }) {
  const { spot, typeName, region, promoted } = item;
  return (
    <Link
      href={idSlugPath("place", spot.id, spot.slug)}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{typeName}</span>
        <span>
          {region.sidoName} {region.sigunguName}
        </span>
        {promoted && <AdLabel />}
      </div>
      <h3 className="mt-2 text-base font-bold text-ink group-hover:underline">{spot.name}</h3>
      {spot.addressRoad && <p className="mt-1 text-sm text-ink-soft">{spot.addressRoad}</p>}
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-ink-faint">
        <span>{SPOT_STATUS_LABEL[spot.status] ?? spot.status}</span>
        {spot.priceText && <span>· {spot.priceText}</span>}
      </div>
    </Link>
  );
}

export function MakerCard({ maker, regionLabel }: { maker: MakerRow; regionLabel: string | null }) {
  return (
    <Link
      href={idSlugPath("maker", maker.id, maker.slug)}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="rounded-full bg-honey-soft px-2 py-0.5 font-medium text-honey">
          {MAKER_CATEGORY_LABEL[maker.category] ?? maker.category}
        </span>
        {regionLabel && <span>{regionLabel}</span>}
      </div>
      <h3 className="mt-2 text-base font-bold text-ink group-hover:underline">{maker.name}</h3>
      {maker.storyMd && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{maker.storyMd.split("\n")[0]}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {maker.badgeFeedRegistered && (
          <FactBadge label="사료제조업 등록 확인" verifiedAt={maker.badgeVerifiedAt} note={maker.badgeNote} />
        )}
        {maker.badgeIngredientRegistered && (
          <FactBadge label="성분등록 확인" verifiedAt={maker.badgeVerifiedAt} note={maker.badgeNote} />
        )}
      </div>
    </Link>
  );
}
