"use client";

// 스팟 디렉토리 셸 — 좌측 지역 지도(시도 → 시군구 타일), 우측 서버가 그린 목록.
//
// SEO 페이지가 곧 지도 페이지다: 시군구 타일은 진짜 링크(/spot/시도/시군구/유형)라 크롤러는 유형마다
// 모든 지역 링크를 보고, 사람은 타일을 누르면 주소만 바뀌며 지도는 그대로 남는다(같은 라우트 사이의
// 소프트 내비게이션은 이 컴포넌트를 다시 만들지 않는다). 브라우저에는 선택한 지역의 목록만 내려간다.
// 시도 타일은 펼치기(클라이언트 상태)만 한다 — 시도x유형 페이지는 두지 않는다.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CareMap } from "@/components/care/care-map";
import { regionHref, sumBySido, type RegionTile } from "@/lib/regions";

export interface TypeChip {
  slug: string;
  name: string;
}

export interface TypeFilter {
  /** 칩 목록 (정렬 순서대로). "전체" 칩은 셸이 붙인다 */
  types: TypeChip[];
  /** 유형 슬러그 → (지역 id → 수) */
  countsByType: Record<string, Record<number, number>>;
}

export function SpotDirectory({
  regions,
  countsByRegion,
  typeFilter,
  selectedSido,
  selectedRegionId,
  typeSlug,
  mapTitle,
  children,
}: {
  regions: RegionTile[];
  /** 지역별 배지 수 — 유형 페이지면 그 유형, 지역 허브면 전체 */
  countsByRegion: Record<number, number>;
  /** 시도 페이지의 유형 필터 — 칩을 고르면 배지와 타일 링크가 그 유형으로 바뀐다 */
  typeFilter?: TypeFilter;
  /** 처음 펼쳐 둘 시도 (지역 페이지는 그 지역의 시도) */
  selectedSido: string | null;
  /** 강조할 시군구 (지역 페이지) */
  selectedRegionId: number | null;
  /** 시군구 타일 링크의 유형. null 이면 지역 허브로 간다 */
  typeSlug: string | null;
  mapTitle?: string;
  /** 우측 패널 — 서버가 그린 목록 */
  children: ReactNode;
}) {
  const [openSido, setOpenSido] = useState<string | null>(selectedSido);
  const [activeType, setActiveType] = useState<string | null>(typeSlug);
  const [mapOpen, setMapOpen] = useState(false);

  // 다른 지역 페이지로 넘어오면(소프트 내비게이션) 그 지역의 시도를 펼친다. 같은 시도면 상태 유지.
  useEffect(() => {
    if (selectedSido) setOpenSido(selectedSido);
  }, [selectedSido, selectedRegionId]);

  const counts = useMemo(() => {
    if (typeFilter && activeType && typeFilter.countsByType[activeType]) return typeFilter.countsByType[activeType]!;
    return countsByRegion;
  }, [typeFilter, activeType, countsByRegion]);
  const countsBySido = useMemo(() => sumBySido(regions, counts), [regions, counts]);
  const linkType = typeFilter ? activeType : typeSlug;
  const total = useMemo(() => Object.values(counts).reduce((a, n) => a + n, 0), [counts]);
  const openSidoName = openSido ? regions.find((r) => r.sidoSlug === openSido)?.sidoName ?? null : null;
  const openSidoTotal = openSido ? countsBySido[openSido] ?? 0 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
      <aside aria-label={mapTitle ?? "지역 지도"}>
        <button
          type="button"
          onClick={() => setMapOpen((o) => !o)}
          aria-expanded={mapOpen}
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-cream px-4 py-3 text-sm font-semibold text-ink lg:hidden"
        >
          <span>
            지역 고르기
            {openSidoName && <span className="ml-2 font-normal text-ink-soft">{openSidoName}</span>}
          </span>
          <span aria-hidden="true">{mapOpen ? "▴" : "▾"}</span>
        </button>
        <div className={`${mapOpen ? "mt-2 block" : "hidden"} rounded-2xl border border-line bg-cream p-4 lg:mt-0 lg:block sm:p-5`}>
          {typeFilter && (
            <div role="group" aria-label="유형 선택" className="mb-3 flex flex-wrap gap-1.5">
              {[{ slug: null as string | null, name: "전체" }, ...typeFilter.types].map((t) => {
                const active = t.slug === activeType;
                return (
                  <button
                    key={t.slug ?? "all"}
                    type="button"
                    onClick={() => setActiveType(t.slug)}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active ? "bg-ink text-cream" : "bg-surface text-ink-soft hover:bg-sand hover:text-ink"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mb-3 text-xs text-ink-soft">
            {openSidoName ? (
              <>
                <strong className="text-ink">{openSidoName}</strong> {openSidoTotal.toLocaleString("ko-KR")}곳
                {total > openSidoTotal && <> · 전국 {total.toLocaleString("ko-KR")}곳</>}
              </>
            ) : (
              <>전국 {total.toLocaleString("ko-KR")}곳 · 시도를 누르면 구·시·군이 펼쳐집니다</>
            )}
          </p>
          <CareMap
            regions={regions}
            countsByRegion={counts}
            countsBySido={countsBySido}
            selectedSido={openSido}
            selectedRegionId={selectedRegionId}
            onSelectSido={setOpenSido}
            hrefForRegion={(r) => regionHref(r, linkType)}
          />
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
