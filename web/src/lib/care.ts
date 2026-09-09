// ============================================================
// 돌봄 파트너 — DB 없이 쓰는 타입·순수 헬퍼 (클라이언트 컴포넌트가 import 한다)
// DB 조회는 lib/queries/care.ts.
// ============================================================
import { MAX_EXPOSED_PER_AREA } from "@app/data";
import type { RegionTile } from "./regions";

/** 지역 타일 — 스팟 디렉토리와 같은 모양 (lib/regions.ts) */
export type CareRegion = RegionTile;

export interface CareArea {
  regionId: number;
  exposed: boolean;
  sortOrder: number;
}

export interface CareProvider {
  id: number;
  slug: string;
  name: string;
  typeSlug: string;
  typeName: string;
  source: string;
  status: string;
  /** 소개 — 마크다운을 걷어낸 짧은 발췌 (카드용) */
  intro: string | null;
  priceText: string | null;
  hoursText: string | null;
  dataReferenceDate: string | null;
  homeRegionId: number;
  areas: CareArea[];
  kakaoUrl: string | null;
  reservationUrl: string | null;
}

/** 돌봄 유형별 첫 문장 — 무엇을 하는 사람인지 한 줄로 (유형 허브·지역 페이지) */
export const CARE_INTRO: Record<string, string> = {
  "pet-sitter": "보호자 집으로 와서 돌보는 방문 펫시터를 지역별로 찾습니다.",
  "hourly-sitter": "몇 시간 자리를 비울 때 시터 집에 아이를 맡기는 시간제 시터를 지역별로 찾습니다.",
  "dog-walk": "산책 대행·동행 도그워커를 지역별로 찾습니다.",
};

/** 파트너의 1순위 노출 지역 (허브가 처음 펼쳐 둘 시도를 고를 때) */
export function primaryArea(provider: CareProvider | undefined): CareArea | null {
  if (!provider) return null;
  return [...provider.areas].filter((a) => a.exposed).sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}

/** 마크다운 소개 → 카드용 한 문단. 강조·링크·제목 기호만 걷어낸다. */
export function plainExcerpt(md: string | null | undefined, max = 150): string | null {
  if (!md) return null;
  const text = md
    .replace(/\{\{[^}]*\}\}/g, " ") // 임베드 숏코드
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** 한 지역의 공개 자리 — 지역 정렬값 → 이름순, 최대 MAX_EXPOSED_PER_AREA */
export function providersInArea(providers: CareProvider[], regionId: number): CareProvider[] {
  return providers
    .filter((p) => p.areas.some((a) => a.regionId === regionId && a.exposed))
    .sort((a, b) => {
      const sa = a.areas.find((x) => x.regionId === regionId)!.sortOrder;
      const sb = b.areas.find((x) => x.regionId === regionId)!.sortOrder;
      return sa - sb || a.name.localeCompare(b.name, "ko");
    })
    .slice(0, MAX_EXPOSED_PER_AREA);
}

/** 지역별 노출 중 파트너 수 (지도 배지) */
export function countProvidersByRegion(providers: CareProvider[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const p of providers) {
    for (const a of p.areas) {
      if (!a.exposed) continue;
      out[a.regionId] = (out[a.regionId] ?? 0) + 1;
    }
  }
  return out;
}

/** 시도별 노출 중 파트너 수 — 한 파트너가 같은 시도의 여러 구를 맡아도 1명으로 센다 */
export function countProvidersBySido(providers: CareProvider[], regions: CareRegion[]): Record<string, number> {
  const sidoByRegion = new Map(regions.map((r) => [r.id, r.sidoSlug]));
  const seen = new Map<string, Set<number>>();
  for (const p of providers) {
    for (const a of p.areas) {
      if (!a.exposed) continue;
      const sido = sidoByRegion.get(a.regionId);
      if (!sido) continue;
      const set = seen.get(sido) ?? new Set<number>();
      set.add(p.id);
      seen.set(sido, set);
    }
  }
  return Object.fromEntries([...seen.entries()].map(([sido, set]) => [sido, set.size]));
}
