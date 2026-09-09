"use client";

// 지역 지도 — 시도 타일(17) → 시군구 타일. 격자라 크롤러·키보드에도 같은 구조다.
// 실측 지도가 아니라 카토그램: 위치 감각만 준다. 시도 타일은 펼치기(클라이언트 상태), 시군구 타일은
// 진짜 링크(지역x유형 페이지 = SEO 페이지)다. 스팟 디렉토리 셸(components/spot/spot-directory.tsx)이 감싼다.
import Link from "next/link";
import { SEOUL_GRID, SEOUL_TILES, SIDO_GRID, SIDO_TILES, tileLabel } from "./care-map-layout";
import type { CareRegion } from "@/lib/care";

export interface CareMapProps {
  regions: CareRegion[];
  /** 지역별 배지 수 (시군구) — 시설 수 또는 노출 중 파트너 수 */
  countsByRegion: Record<number, number>;
  /** 시도별 배지 수 — 돌봄 파트너는 사람 수 기준 (한 사람이 여러 구를 맡아도 1) */
  countsBySido: Record<string, number>;
  selectedSido: string | null;
  selectedRegionId: number | null;
  onSelectSido: (slug: string) => void;
  /** 시군구 타일이 가리키는 주소 (지역x유형 페이지 또는 지역 허브) */
  hrefForRegion: (r: CareRegion) => string;
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-sm">
      {n}
    </span>
  );
}

export function CareMap({ regions, countsByRegion, countsBySido, selectedSido, selectedRegionId, onSelectSido, hrefForRegion }: CareMapProps) {
  const sigungus = selectedSido ? regions.filter((r) => r.sidoSlug === selectedSido) : [];
  const sidoName = sigungus[0]?.sidoName ?? "";
  const isSeoul = selectedSido === "seoul";

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="시도 선택"
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${SIDO_GRID.cols}, minmax(0, 1fr))` }}
      >
        {SIDO_TILES.map((t) => {
          const active = t.slug === selectedSido;
          const n = countsBySido[t.slug] ?? 0;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onSelectSido(t.slug)}
              aria-pressed={active}
              className={`relative flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors sm:h-12 ${
                active
                  ? "border-sea bg-sea text-white shadow-sm"
                  : n > 0
                    ? "border-sea/40 bg-sea-soft text-sea hover:bg-sea hover:text-white"
                    : "border-line bg-surface text-ink-soft hover:border-sea/50 hover:text-ink"
              }`}
              style={{ gridColumn: t.col + 1, gridRow: t.row + 1 }}
            >
              {t.short}
              <Badge n={n} />
            </button>
          );
        })}
      </div>

      {selectedSido && (
        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">
            <span className="text-ink">{sidoName}</span> · 구·시·군을 고르세요
          </p>
          <div
            role="group"
            aria-label={`${sidoName} 시군구 선택`}
            className={`grid gap-1.5 ${isSeoul ? "" : "grid-cols-4 sm:grid-cols-5"}`}
            style={isSeoul ? { gridTemplateColumns: `repeat(${SEOUL_GRID.cols}, minmax(0, 1fr))` } : undefined}
          >
            {sigungus.map((r) => {
              const active = r.id === selectedRegionId;
              const n = countsByRegion[r.id] ?? 0;
              const pos = isSeoul ? SEOUL_TILES[r.sigunguName] : undefined;
              return (
                <Link
                  key={r.id}
                  href={hrefForRegion(r)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  title={`${r.sidoName} ${r.sigunguName}`}
                  className={`relative flex min-h-9 items-center justify-center rounded-lg border px-1 text-[11px] font-medium leading-tight transition-colors sm:text-xs ${
                    active
                      ? "border-sea bg-sea text-white"
                      : n > 0
                        ? "border-sea/40 bg-sea-soft text-sea hover:bg-sea hover:text-white"
                        : "border-line bg-surface text-ink-faint hover:border-sea/50 hover:text-ink"
                  }`}
                  style={pos ? { gridColumn: pos.col + 1, gridRow: pos.row + 1 } : undefined}
                >
                  {tileLabel(r.sigunguName)}
                  <Badge n={n} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
