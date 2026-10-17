// 펫세권 분석 ↔ 주소·디렉토리 연결 (순수 함수, 테스트 대상)
//  - 공유 주소: /news/petsegwon?region=jeonnam&sigungu=yeosu-si&category=grooming
//  - 실제 업장: 스팟 디렉토리 /spot/시도/시군구/유형 (유형이 없는 업종은 지역 페이지까지)
import { REGIONS, SIDO } from "@app/data/regions";

/** 분석 업종 → 스팟 유형(spot_types.slug). 없는 업종(전시·생산·수입)은 지역 페이지로만 보낸다 */
const SPOT_TYPE: Record<string, { slug: string; name: string }> = {
  grooming: { slug: "grooming", name: "미용·스파" },
  boarding: { slug: "boarding", name: "유치원·위탁" },
  transport: { slug: "transport", name: "이동·운송" },
  funeral: { slug: "memorial", name: "장묘" },
};

/** 시도 짧은 이름(서울) → 디렉토리 시도 정의 */
function sidoDef(sido: string) {
  return SIDO.find((s) => s.aliases.includes(sido) || s.name === sido);
}

export function sidoSlug(sido: string): string | null {
  return sidoDef(sido)?.slug ?? null;
}

export function sidoFromSlug(slug: string, sidoNames: readonly string[]): string | null {
  const def = SIDO.find((s) => s.slug === slug);
  return def ? (sidoNames.find((n) => def.aliases.includes(n) || def.name === n) ?? null) : null;
}

/** 분석 시군구 이름 → 디렉토리 시군구 (세종은 "세종시" 한 행, 인천 개편 묶음 등은 없음) */
function regionDef(sido: string, sigungu: string) {
  const def = sidoDef(sido);
  if (!def) return null;
  const name = sido === "세종" ? "세종시" : sigungu;
  return REGIONS.find((r) => r.sidoSlug === def.slug && r.sigunguName === name) ?? null;
}

/** 주소에 쓸 시군구 값 — 디렉토리 슬러그가 있으면 그것, 없으면 이름 그대로 */
export function sigunguParam(sido: string, sigungu: string): string {
  return regionDef(sido, sigungu)?.sigunguSlug ?? sigungu;
}

export function sigunguFromParam(sido: string, param: string, names: readonly string[]): string | null {
  return names.find((n) => n === param || sigunguParam(sido, n) === param) ?? null;
}

export interface DirectoryLink {
  href: string;
  label: string;
}

/** "실제 업장 보기" 링크 — 시군구·유형이 맞으면 그 목록, 아니면 시도 디렉토리 */
export function directoryLink(sido: string, sigungu: string | null, industry: string): DirectoryLink | null {
  const sSlug = sidoSlug(sido);
  if (!sSlug) return null;
  const type = SPOT_TYPE[industry];
  const region = sigungu ? regionDef(sido, sigungu) : null;
  if (region) {
    return type
      ? { href: `/spot/${sSlug}/${region.sigunguSlug}/${type.slug}`, label: `${sido} ${sigungu} ${type.name} 업장 보기` }
      : { href: `/spot/${sSlug}/${region.sigunguSlug}`, label: `${sido} ${sigungu} 반려동물 스팟 보기` };
  }
  return { href: `/spot/${sSlug}`, label: type ? `${sido} ${type.name} 업장 시군구별로 보기` : `${sido} 반려동물 스팟 보기` };
}

/** 공유 주소의 쿼리 문자열 */
export function analysisQuery(sido: string, sigungu: string | null, industry: string): string {
  const q = new URLSearchParams();
  q.set("region", sidoSlug(sido) ?? sido);
  if (sigungu) q.set("sigungu", sigunguParam(sido, sigungu));
  q.set("category", industry);
  return q.toString();
}
