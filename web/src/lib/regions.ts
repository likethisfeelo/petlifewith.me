// ============================================================
// 지역 타일 — 지도(시도 → 시군구 격자)와 디렉토리 셸이 함께 쓰는 최소 지역 정보.
// DB regions 행에서 id·이름·슬러그만 뽑은 것. 스팟 디렉토리와 돌봄 파트너 디렉토리가 같이 쓴다.
// ============================================================

export interface RegionTile {
  id: number;
  sidoName: string;
  sidoSlug: string;
  sigunguName: string;
  sigunguSlug: string;
}

/**
 * 시군구 타일이 가리키는 주소.
 *  - 유형이 있으면 지역x유형 페이지(/spot/서울/서초구/boarding) — SEO 페이지이자 지도 페이지
 *  - 없으면 지역 허브(/spot/서울/서초구)
 */
export function regionHref(r: Pick<RegionTile, "sidoSlug" | "sigunguSlug">, typeSlug: string | null): string {
  const base = `/spot/${r.sidoSlug}/${r.sigunguSlug}`;
  return typeSlug ? `${base}/${typeSlug}` : base;
}

/** 시도별 합계 — 시군구 배지를 시도 타일 배지로 합친다 (시설 수 기준) */
export function sumBySido(regions: RegionTile[], countsByRegion: Record<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of regions) {
    const n = countsByRegion[r.id] ?? 0;
    if (n > 0) out[r.sidoSlug] = (out[r.sidoSlug] ?? 0) + n;
  }
  return out;
}
