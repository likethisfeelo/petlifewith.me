// 개체 단위 태깅 렌더링 (claude.md 5-4)
// "관련 글" 배너가 아니라, 본문에 등장한 상품·장소·브랜드가 개체 카드로 붙는다.
import Link from "next/link";
import type { GuideEntityTags, TaggedDevice, TaggedItem, TaggedMaker, TaggedSpot } from "@/lib/queries/guides";
import { ITEM_CATEGORY_LABEL, MAKER_CATEGORY_LABEL, OFFER_VENDOR_LABEL, idSlugPath } from "@/lib/format";
import { FactBadge } from "./notices";

function ItemTagCard({ tagged }: { tagged: TaggedItem }) {
  const { item, offers, makerName, contextLabel } = tagged;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      {contextLabel && <p className="text-xs font-medium text-accent-deep">{contextLabel}</p>}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <Link href={idSlugPath("item", item.id, item.slug)} className="font-bold text-ink hover:underline" data-track="entity_click" data-track-entity-type="item" data-track-entity-id={String(item.id)} data-track-link-area="guide_panel">
          {item.name}
        </Link>
        <span className="shrink-0 text-xs text-ink-faint">{ITEM_CATEGORY_LABEL[item.category] ?? item.category}</span>
      </div>
      {item.summary && <p className="mt-1 text-sm text-ink-soft">{item.summary}</p>}
      {makerName && <p className="mt-1 text-xs text-ink-faint">만든 곳: {makerName}</p>}
      {offers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offers.map((o) => (
            <a
              key={o.id}
              href={o.url}
              target="_blank"
              rel={o.isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
              data-track="purchase_click"
              data-track-vendor={o.vendor}
              data-track-is-affiliate={String(Boolean(o.isAffiliate))}
              data-track-entity-type="item"
              data-track-entity-id={String(item.id)}
              data-track-link-area="guide_panel"
              className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep transition-colors hover:bg-accent hover:text-white"
            >
              {o.label ?? OFFER_VENDOR_LABEL[o.vendor] ?? "구매처"} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SpotTagCard({ tagged }: { tagged: TaggedSpot }) {
  const { spot, typeName, sidoName, sigunguName, contextLabel } = tagged;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      {contextLabel && <p className="text-xs font-medium text-sea">{contextLabel}</p>}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <Link href={idSlugPath("place", spot.id, spot.slug)} className="font-bold text-ink hover:underline" data-track="entity_click" data-track-entity-type="spot" data-track-entity-id={String(spot.id)} data-track-link-area="guide_panel">
          {spot.name}
        </Link>
        <span className="shrink-0 text-xs text-ink-faint">{typeName}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {sidoName} {sigunguName}
        {spot.addressRoad ? ` · ${spot.addressRoad}` : ""}
      </p>
      {spot.priceText && <p className="mt-1 text-xs text-ink-faint">{spot.priceText}</p>}
    </div>
  );
}

const MAKER_LINK_LABEL: Record<string, string> = { website: "홈페이지", instagram: "인스타그램", smartstore: "스마트스토어", funding: "펀딩", blog: "블로그", naver: "네이버" };

function MakerTagCard({ tagged }: { tagged: TaggedMaker }) {
  const { maker, contextLabel, links } = tagged;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      {contextLabel && <p className="text-xs font-medium text-honey">{contextLabel}</p>}
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <Link href={idSlugPath("maker", maker.id, maker.slug)} className="font-bold text-ink hover:underline" data-track="entity_click" data-track-entity-type="maker" data-track-entity-id={String(maker.id)} data-track-link-area="guide_panel">
          {maker.name}
        </Link>
        <span className="shrink-0 text-xs text-ink-faint">{MAKER_CATEGORY_LABEL[maker.category] ?? maker.category}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {maker.badgeFeedRegistered && (
          <FactBadge label="사료제조업 등록 확인" verifiedAt={maker.badgeVerifiedAt} note={maker.badgeNote} />
        )}
      </div>
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-sand hover:text-ink"
            >
              {l.label ?? MAKER_LINK_LABEL[l.kind] ?? l.kind} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 치료·진단 기기 블록 — 주어는 병원이 아니라 기기다 (claude.md 6-2).
 * 보유처 목록은 무료 노출 전용이고 순위·추천·비교 없이 이름 나열만 한다.
 */
function DeviceBlock({ tagged }: { tagged: TaggedDevice }) {
  const { device, sites } = tagged;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-faint">치료·진단 기기 정보</p>
      <p className="mt-1 font-bold text-ink">{device.name}</p>
      {device.makerName && <p className="text-xs text-ink-faint">제조: {device.makerName}</p>}
      {device.summaryMd && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{device.summaryMd}</p>}
      {sites.length > 0 && (
        <div className="mt-3 rounded-lg bg-sand p-3">
          <p className="text-xs font-semibold text-ink-soft">
            보유를 확인한 곳 <span className="font-normal text-ink-faint">— 무료 정보이며 순위·추천이 아닙니다. 가나다순.</span>
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
            {sites.map((s, i) => (
              <li key={i}>
                {s.facilityName}
                {s.sidoName && (
                  <span className="text-ink-faint">
                    {" "}
                    ({s.sidoName} {s.sigunguName ?? ""})
                  </span>
                )}
                {s.verifiedAt && <span className="text-xs text-ink-faint"> · {s.verifiedAt} 확인</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 태그된 개체가 하나라도 있는가 — 놀이 글은 우측 패널을, 그 밖은 본문 아래 패널을 그릴지 정한다 */
export function hasEntityTags(tags: GuideEntityTags): boolean {
  return tags.items.length + tags.spots.length + tags.makers.length + tags.devices.length > 0;
}

/**
 * compact: 우측 고정 패널용 — 카드를 한 줄로 쌓는다 (놀이 글: 제품 링크·홈페이지 정보가 본문 옆에 뜬다).
 */
export function EntityTagPanels({ tags, compact = false }: { tags: GuideEntityTags; compact?: boolean }) {
  if (!hasEntityTags(tags)) return null;
  const grid = compact ? "mt-3 space-y-3" : "mt-3 grid gap-3 sm:grid-cols-2";
  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      {tags.items.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink">이 글에 등장한 상품</h2>
          <div className={grid}>
            {tags.items.map((t) => (
              <ItemTagCard key={t.item.id} tagged={t} />
            ))}
          </div>
        </section>
      )}
      {tags.spots.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink">이 글에 등장한 장소</h2>
          <div className={grid}>
            {tags.spots.map((t) => (
              <SpotTagCard key={t.spot.id} tagged={t} />
            ))}
          </div>
        </section>
      )}
      {tags.makers.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink">이 글에 등장한 브랜드</h2>
          <div className={grid}>
            {tags.makers.map((t) => (
              <MakerTagCard key={t.maker.id} tagged={t} />
            ))}
          </div>
        </section>
      )}
      {tags.devices.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink">이 글에서 다룬 기기</h2>
          <div className="mt-3 space-y-3">
            {tags.devices.map((t) => (
              <DeviceBlock key={t.device.id} tagged={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
