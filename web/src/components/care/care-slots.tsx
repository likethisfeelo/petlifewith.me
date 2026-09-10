"use client";

// 한 지역의 돌봄 파트너 자리 — 지역마다 MAX_EXPOSED_PER_AREA(5) 칸. 채워진 칸은 파트너 카드,
// 빈 칸은 "비어있습니다" 로 두어 등록 여지를 보여 준다. 순위·평점 없음 — 순서는 운영자 정렬값.
// 지역x유형 페이지(/spot/시도/시군구/pet-sitter 등)가 스팟 디렉토리 셸의 우측 패널로 그린다.
import Link from "next/link";
import { MAX_EXPOSED_PER_AREA } from "@app/data";
import type { CareProvider, CareRegion } from "@/lib/care";
import { idSlugPath } from "@/lib/format";
import { ReserveActions } from "@/components/reservation/reserve-actions";

export function CareProviderCard({
  provider,
  personLabel,
  regionId,
  regionNameById,
  index,
}: {
  provider: CareProvider;
  personLabel: string;
  regionId: number | null;
  regionNameById: Record<number, string>;
  index?: number;
}) {
  const areaNames = provider.areas.filter((a) => a.exposed).map((a) => regionNameById[a.regionId]).filter(Boolean);
  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {index !== undefined && <span className="font-semibold text-ink-faint">{index + 1}번 자리</span>}
        <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{personLabel}</span>
        {provider.source === "sample" && (
          <span className="rounded-full bg-honey-soft px-2 py-0.5 font-semibold text-honey" title="화면 구성을 보여 주기 위한 가상의 예시 — 실제 업체가 아닙니다">
            예시
          </span>
        )}
      </div>
      <h3 className="mt-1.5 text-base font-bold text-ink">{provider.name}</h3>
      {areaNames.length > 0 && (
        <p className="mt-1 text-xs text-ink-soft">
          <span className="text-ink-faint">활동 지역</span> {areaNames.join(" · ")}
        </p>
      )}
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-ink-soft sm:grid-cols-2">
        {provider.hoursText && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">시간</dt>
            <dd>{provider.hoursText}</dd>
          </div>
        )}
        {provider.priceText && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">요금</dt>
            <dd>{provider.priceText}</dd>
          </div>
        )}
      </dl>
      {provider.intro && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{provider.intro}</p>}
      <ReserveActions spotId={provider.id} kakaoUrl={provider.kakaoUrl} detailHref={idSlugPath("place", provider.id, provider.slug)} compact />
    </article>
  );
}

export function CareAreaSlots({
  personLabel,
  typeSlug,
  region,
  providers,
  regionNameById,
}: {
  personLabel: string;
  /** pet-sitter / hourly-sitter / dog-walk — 등록 요청 링크에 실어 보낸다 */
  typeSlug: string;
  region: CareRegion;
  providers: CareProvider[];
  regionNameById: Record<number, string>;
}) {
  const slots = Array.from({ length: MAX_EXPOSED_PER_AREA }, (_, i) => providers[i] ?? null);
  return (
    <section aria-label={`${region.sigunguName} ${personLabel} 목록`}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-ink">
          {region.sidoName} {region.sigunguName} <span className="text-sea">{personLabel}</span>
        </h2>
        <span className="text-xs font-medium text-ink-faint">
          {providers.length}/{MAX_EXPOSED_PER_AREA} 자리
        </span>
      </header>
      <ol className="mt-3 space-y-3">
        {slots.map((p, i) =>
          p ? (
            <li key={p.id}>
              <CareProviderCard provider={p} personLabel={personLabel} regionId={region.id} regionNameById={regionNameById} index={i} />
            </li>
          ) : (
            <li key={`empty-${i}`} className="flex items-center justify-between rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3">
              <span className="text-sm text-ink-faint">{i + 1}번 자리 · 비어있습니다</span>
              <Link href={`/portal/care?type=${typeSlug}&region=${region.id}`} className="text-xs font-medium text-sea hover:underline">
                이 지역 {personLabel}로 등록 →
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        지역마다 {MAX_EXPOSED_PER_AREA}자리. 순위·평점이 아니라 운영자가 확인한 순서이며, 예약 신청은 운영자가 받아 파트너에게 연결합니다.
      </p>
    </section>
  );
}
