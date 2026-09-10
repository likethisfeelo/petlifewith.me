"use client";

// 펫모임 셸 — 좌측 지역 지도(시도 → 시군구), 우측 서버가 그린 패널. 시군구 타일은 /meetup?region=<id> 링크.
// 배지는 열린 모임 수. 스팟 디렉토리 셸(components/spot/spot-directory.tsx)과 같은 구조를 단순하게 쓴다.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CareMap } from "@/components/care/care-map";
import { sumBySido, type RegionTile } from "@/lib/regions";

export function MeetupMapShell({
  regions,
  countsByRegion,
  selectedSido,
  selectedRegionId,
  children,
}: {
  regions: RegionTile[];
  countsByRegion: Record<number, number>;
  selectedSido: string | null;
  selectedRegionId: number | null;
  children: ReactNode;
}) {
  const [openSido, setOpenSido] = useState<string | null>(selectedSido);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (selectedSido) setOpenSido(selectedSido);
  }, [selectedSido, selectedRegionId]);
  const countsBySido = useMemo(() => sumBySido(regions, countsByRegion), [regions, countsByRegion]);
  const total = useMemo(() => Object.values(countsByRegion).reduce((a, n) => a + n, 0), [countsByRegion]);
  const openSidoName = openSido ? (regions.find((r) => r.sidoSlug === openSido)?.sidoName ?? null) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
      <aside aria-label="지역 지도">
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
          <p className="mb-3 text-xs text-ink-soft">
            {openSidoName ? (
              <>
                <strong className="text-ink">{openSidoName}</strong> 모임 {(countsBySido[openSido!] ?? 0).toLocaleString("ko-KR")}개 · 전국 {total.toLocaleString("ko-KR")}개
              </>
            ) : (
              <>전국 모임 {total.toLocaleString("ko-KR")}개 · 시도를 누르면 구·시·군이 펼쳐집니다</>
            )}
          </p>
          <CareMap
            regions={regions}
            countsByRegion={countsByRegion}
            countsBySido={countsBySido}
            selectedSido={openSido}
            selectedRegionId={selectedRegionId}
            onSelectSido={setOpenSido}
            hrefForRegion={(r) => `/meetup?region=${r.id}`}
          />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
