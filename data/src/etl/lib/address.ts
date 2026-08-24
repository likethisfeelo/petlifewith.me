// 주소 정규화 + 시군구 귀속.
// - 상세주소(층·호수·동호수)는 저장하지 않는다: 쉼표 이후와 괄호 표기를 제거 (claude.md 5-6)
// - 시군구 귀속은 regions 기준 데이터로만 한다. 목록에 없으면 undefined 를 반환하고
//   호출부가 리포트에 남긴다. 지어내지 않는다.
import { REGIONS, normalizeSidoName, type RegionDef } from "../../regions/regions.js";

/** 도로명 주소에서 건물번호까지만 남긴다. "테헤란로 123, 4층 501호 (역삼동)" → "테헤란로 123" */
export function sanitizeRoadAddress(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  const comma = s.indexOf(",");
  if (comma >= 0) s = s.slice(0, comma);
  s = s.replace(/\([^)]*\)/g, " "); // 괄호 안 법정동·참고 표기 제거
  s = s.replace(/\s+/g, " ").trim();
  return s || null;
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
  if (!sido) return undefined;

  const candidates = REGIONS.filter((r) => r.sidoSlug === sido.slug);

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
