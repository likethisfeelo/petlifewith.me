// ============================================================
// 외부 링크 종류 — 스팟·메이커가 공유하는 어휘
//
// 업체마다 쓰는 채널이 제각각이라(카카오톡 채널만 있는 곳, 네이버 예약만 있는 곳)
// 고정 컬럼 대신 spot_links / maker_links 로 필요한 것만 골라 넣는다.
// kind 는 text 라 목록에 없는 값도 저장되지만, 관리자에서는 이 목록으로 고르게 한다.
// ============================================================

export interface LinkKindDef {
  kind: string;
  label: string;
  placeholder: string;
}

/** 스팟(업체)에서 고를 수 있는 링크 */
export const SPOT_LINK_KINDS: LinkKindDef[] = [
  { kind: "website", label: "홈페이지", placeholder: "https://example.com" },
  { kind: "kakao", label: "카카오톡", placeholder: "http://pf.kakao.com/_xxxxx" },
  { kind: "reservation", label: "예약", placeholder: "https://booking.naver.com/..." },
  { kind: "naver", label: "네이버 플레이스", placeholder: "https://map.naver.com/..." },
  { kind: "instagram", label: "인스타그램", placeholder: "https://instagram.com/..." },
  { kind: "blog", label: "블로그", placeholder: "https://blog.naver.com/..." },
  { kind: "youtube", label: "유튜브", placeholder: "https://youtube.com/@..." },
  { kind: "tiktok", label: "틱톡", placeholder: "https://tiktok.com/@..." },
  { kind: "tistory", label: "티스토리", placeholder: "https://xxx.tistory.com" },
  { kind: "etc", label: "기타", placeholder: "https://..." },
];

/** 메이커(브랜드)에서 고를 수 있는 링크 */
export const MAKER_LINK_KINDS: LinkKindDef[] = [
  { kind: "website", label: "자사몰·홈페이지", placeholder: "https://example.com" },
  { kind: "smartstore", label: "스마트스토어", placeholder: "https://smartstore.naver.com/..." },
  { kind: "kakao", label: "카카오톡", placeholder: "http://pf.kakao.com/_xxxxx" },
  { kind: "instagram", label: "인스타그램", placeholder: "https://instagram.com/..." },
  { kind: "funding", label: "크라우드펀딩", placeholder: "https://www.wadiz.kr/..." },
  { kind: "blog", label: "블로그", placeholder: "https://blog.naver.com/..." },
  { kind: "etc", label: "기타", placeholder: "https://..." },
];

function labelMap(defs: LinkKindDef[]): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.kind, d.label]));
}

const SPOT_LABELS = labelMap(SPOT_LINK_KINDS);
const MAKER_LABELS = labelMap(MAKER_LINK_KINDS);

/** 저장된 링크의 표시 이름. label 이 있으면 그것을, 없으면 kind 의 기본 라벨을 쓴다. */
export function spotLinkLabel(link: { kind: string; label: string | null }): string {
  return link.label?.trim() || SPOT_LABELS[link.kind] || link.kind;
}

export function makerLinkLabel(link: { kind: string; label: string | null }): string {
  return link.label?.trim() || MAKER_LABELS[link.kind] || link.kind;
}

/** http(s) 만 허용한다. javascript: 같은 스킴을 막는다. */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
