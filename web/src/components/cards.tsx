import Link from "next/link";
import type { GuideRow, TopicRow } from "@/lib/queries/guides";
import type { SpotWithMeta } from "@/lib/queries/spots";
import type { MakerRow } from "@/lib/queries/makers";
import { topicStyle } from "@/lib/topic-style";
import { MAKER_CATEGORY_LABEL, SPOT_STATUS_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { AdLabel, FactBadge } from "./notices";

export function GuideCard({ guide, topic, showTopic = true }: { guide: GuideRow; topic?: TopicRow; showTopic?: boolean }) {
  const style = topic ? topicStyle(topic.slug) : null;
  return (
    <Link
      href={`/guide/${guide.slug}`}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-xs">
        {showTopic && topic && style && (
          <span className={`rounded-full px-2 py-0.5 font-medium ${style.chip}`}>{topic.name}</span>
        )}
        {guide.role === "hub" && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">전체 지도</span>}
        {guide.vetReviewed && guide.vetReviewerName && (
          <span className="text-sage-deep">수의사 감수</span>
        )}
      </div>
      <h3 className="mt-2 text-base font-bold leading-snug text-ink group-hover:underline">{guide.title}</h3>
      {guide.summary && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{guide.summary}</p>}
      <p className="mt-auto pt-3 text-xs text-ink-faint">{formatDate(guide.publishedAt)}</p>
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
