// 주소 정규화 + 시군구 귀속.
// - 상세주소(층·호수·동호수·건물 내 위치)는 저장하지 않는다 (claude.md 5-6).
//   도로명(또는 지번) + 건물번호까지만 남기고 그 뒤는 전부 버린다.
// - 시군구 귀속은 regions 기준 데이터로만 한다. 목록에 없으면 undefined 를 반환하고
//   호출부가 리포트에 남긴다. 지어내지 않는다.
import { MERGED_SIDO_SLUGS, REGIONS, normalizeSidoName, type RegionDef } from "../../regions/regions.js";

/** 도로명·법정동·리 등 "번지가 뒤따르는" 토큰. 여기 뒤의 첫 숫자 토큰이 건물번호다. */
const PLACE_TOKEN = /(로|길|동|리|가|읍|면)\d*$/;
/** 건물번호: 123 / 123-4 / 123번지 */
const BUILDING_NO = /^\d+(-\d+)?(번지)?$/;
/** 상세 위치 토큰: 301동 / 704호 / 2층 / 지하1층 / B1 / A동 / 101-2호 */
const UNIT_TOKEN = /^((지하|B)?\d+(-\d+)?(동|호|층|실)|[A-Za-z]동|B\d+)$/;

/**
 * 주소에서 건물번호까지만 남긴다.
 *   "테헤란로 123, 4층 501호 (역삼동)"      → "테헤란로 123"
 *   "한일로9번길 20 103동 02호"            → "한일로9번길 20"
 *   "정발산로 24 웨스턴돔1, 2층 A-263호"    → "정발산로 24"
 *   "서현동 96 시범단지우성아파트"          → "서현동 96"
 */
export function sanitizeRoadAddress(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  const comma = s.indexOf(",");
  if (comma >= 0) s = s.slice(0, comma);
  s = s.replace(/\([^)]*\)/g, " "); // 괄호 안 법정동·참고 표기 제거
  const tokens = s.split(/\s+/).filter(Boolean);

  // 1) 도로명/동 토큰 뒤의 첫 건물번호에서 자른다
  const placeIdx = tokens.findIndex((t) => PLACE_TOKEN.test(t));
  if (placeIdx >= 0) {
    const noIdx = tokens.findIndex((t, i) => i > placeIdx && BUILDING_NO.test(t));
    if (noIdx >= 0) return tokens.slice(0, noIdx + 1).join(" ");
  }
  // 2) 건물번호를 못 찾으면 상세 위치 토큰부터 뒤를 버린다
  const unitIdx = tokens.findIndex(
    (t, i) => i > 0 && UNIT_TOKEN.test(t) && !(PLACE_TOKEN.test(t) && !/^\d/.test(t)),
  );
  const kept = unitIdx >= 0 ? tokens.slice(0, unitIdx) : tokens;
  const out = kept.join(" ").trim();
  return out || null;
}

export interface RegionMatch {
  region: RegionDef;
  /** 일반구(창원시 마산합포구 등)가 시로 합쳐졌는지 */
  mergedGu: boolean;
}

/**
 * 주소 문자열에서 시도·시군구를 찾는다.
 * 실패 시 undefined — 호출부는 반드시 리포트에 사유를 남길 것.
 */
export function resolveRegionFromAddress(raw: string | undefined | null): RegionMatch | undefined {
  if (!raw) return undefined;
  const tokens = raw.trim().split(/\s+/);
  const first = tokens[0];
  if (!first) return undefined;

  const sido = normalizeSidoName(first);
  let candidates: RegionDef[];
  if (sido) {
    candidates = REGIONS.filter((r) => r.sidoSlug === sido.slug);
  } else {
    // 통합 시도 표기(전남광주통합특별시 등)는 시군구명으로 옛 시도에 귀속시킨다
    const mergedSlugs = MERGED_SIDO_SLUGS[first.trim()];
    if (!mergedSlugs) return undefined;
    candidates = REGIONS.filter((r) => mergedSlugs.includes(r.sidoSlug));
  }

  // 세종처럼 시군구가 없는 시도는 단일 행으로 귀속
  if (candidates.length === 1) {
    const only = candidates[0];
    if (only) return { region: only, mergedGu: false };
  }

  const second = tokens[1];
  if (!second) return undefined;

  // 1) 두 번째 토큰이 그대로 시군구 (강남구, 수원시, 기장군 ...)
  const direct = candidates.find((r) => r.sigunguName === second);
  if (direct) {
    // "수원시 장안구" 처럼 다음 토큰이 일반구인 경우
    const third = tokens[2];
    const mergedGu = !!third && /구$/.test(third) && second.endsWith("시");
    return { region: direct, mergedGu };
  }

  // 2) "수원시장안구" 처럼 붙어 있는 경우 — 시군구명이 접두인지 확인
  const prefixed = candidates.find((r) => second.startsWith(r.sigunguName));
  if (prefixed) return { region: prefixed, mergedGu: second.length > prefixed.sigunguName.length };

  return undefined;
}
