"use client";

// 돌봄 파트너 디렉토리 — 좌측 지도(시도 → 시군구 타일), 우측 선택 지역의 자리 목록.
// 선택은 URL 해시(#시도슬러그/시군구슬러그)로 공유되고, 최근 본 지역이 있으면 그것으로 시작한다.
import { useEffect, useMemo, useState } from "react";
import { countProvidersByRegion, countProvidersBySido, providersInArea, type CareProvider, type CareRegion } from "@/lib/care";
import { CareMap } from "./care-map";
import { CareAreaSlots } from "./care-slots";

const RECENT_KEY = "recent-region"; // components/region-banner.tsx 와 같은 키

function readHash(): { sido: string; sigungu?: string } | null {
  const h = window.location.hash.replace(/^#/, "");
  if (!h) return null;
  const [sido, sigungu] = h.split("/");
  return sido ? { sido, sigungu: sigungu || undefined } : null;
}

function readRecent(): { sido: string; sigungu: string } | null {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { sidoSlug?: string; sigunguSlug?: string };
    return v.sidoSlug && v.sigunguSlug ? { sido: v.sidoSlug, sigungu: v.sigunguSlug } : null;
  } catch {
    return null;
  }
}

export function CareDirectory({
  typeSlug,
  personLabel,
  regions,
  providers,
}: {
  typeSlug: string;
  personLabel: string;
  regions: CareRegion[];
  providers: CareProvider[];
}) {
  const countsByRegion = useMemo(() => countProvidersByRegion(providers), [providers]);
  const countsBySido = useMemo(() => countProvidersBySido(providers, regions), [providers, regions]);
  const regionNameById = useMemo(() => Object.fromEntries(regions.map((r) => [r.id, r.sigunguName])), [regions]);
  // 기본 선택: 첫 파트너의 1순위 지역 (없으면 서울만 펼친다)
  const firstWithProvider = useMemo(() => {
    const primary = providers[0]?.areas.filter((a) => a.exposed).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return primary ? regions.find((r) => r.id === primary.regionId) ?? null : null;
  }, [providers, regions]);

  // 서버 렌더와 첫 클라이언트 렌더는 같아야 한다 — 해시·저장값은 마운트 뒤에 읽는다
  const [selectedSido, setSelectedSido] = useState<string | null>(firstWithProvider?.sidoSlug ?? "seoul");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(firstWithProvider?.id ?? null);

  useEffect(() => {
    const apply = (pick: { sido: string; sigungu?: string } | null) => {
      if (!pick) return;
      const region = pick.sigungu ? regions.find((r) => r.sidoSlug === pick.sido && r.sigunguSlug === pick.sigungu) : undefined;
      if (region) {
        setSelectedSido(region.sidoSlug);
        setSelectedRegionId(region.id);
      } else if (regions.some((r) => r.sidoSlug === pick.sido)) {
        setSelectedSido(pick.sido);
        setSelectedRegionId(null);
      }
    };
    apply(readHash() ?? readRecent());
    // 같은 문서 안의 해시 이동(글 링크 → #seoul/mapo-gu)도 따라간다
    const onHash = () => apply(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [regions]);

  const selectedRegion = selectedRegionId ? regions.find((r) => r.id === selectedRegionId) ?? null : null;

  const select = (sido: string, region: CareRegion | null) => {
    setSelectedSido(sido);
    setSelectedRegionId(region?.id ?? null);
    const hash = region ? `#${sido}/${region.sigunguSlug}` : `#${sido}`;
    try {
      window.history.replaceState(null, "", hash);
    } catch {
      // history 접근이 막힌 환경은 무시
    }
  };

  const total = providers.length;
  const areaCount = Object.keys(countsByRegion).length;
  const sidoRegions = selectedSido ? regions.filter((r) => r.sidoSlug === selectedSido) : [];
  const sidoTotal = selectedSido ? countsBySido[selectedSido] ?? 0 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="rounded-2xl border border-line bg-cream p-4 sm:p-5">
        <p className="mb-3 text-xs text-ink-soft">
          전국 노출 중 <strong className="text-ink">{total}명</strong> · 지역 {areaCount}곳 · 지역마다 5자리
        </p>
        <CareMap
          regions={regions}
          countsByRegion={countsByRegion}
          countsBySido={countsBySido}
          selectedSido={selectedSido}
          selectedRegionId={selectedRegionId}
          onSelectSido={(slug) => select(slug, null)}
          onSelectRegion={(id) => {
            const r = regions.find((x) => x.id === id);
            if (r) select(r.sidoSlug, r);
          }}
        />
      </div>

      <div>
        {selectedRegion ? (
          <CareAreaSlots
            personLabel={personLabel}
            region={selectedRegion}
            providers={providersInArea(providers, selectedRegion.id)}
            regionNameById={regionNameById}
            areaHref={`/spot/${selectedRegion.sidoSlug}/${selectedRegion.sigunguSlug}/${typeSlug}`}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-surface/60 p-6 text-sm text-ink-soft">
            <p className="font-semibold text-ink">{sidoRegions[0]?.sidoName ?? "지역"} · 노출 중 {sidoTotal}명</p>
            <p className="mt-1">지도에서 구·시·군을 고르면 그 지역의 {personLabel} 자리가 여기에 나옵니다.</p>
            {sidoTotal > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {sidoRegions
                  .filter((r) => (countsByRegion[r.id] ?? 0) > 0)
                  .map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => select(r.sidoSlug, r)}
                        className="rounded-full bg-sea-soft px-3 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white"
                      >
                        {r.sigunguName} {countsByRegion[r.id]}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
