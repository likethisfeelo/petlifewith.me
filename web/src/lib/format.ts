// 표시용 포맷터·라벨. UI 문자열을 한 곳에 모은다.

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export const SPOT_STATUS_LABEL: Record<string, string> = {
  operating: "영업 중",
  suspended: "휴업",
  closed: "폐업",
  unknown: "확인 필요",
};

export const SPOT_SOURCE_LABEL: Record<string, string> = {
  public_data: "공공데이터 (행안부 인허가)",
  direct: "직접 발굴",
  claimed: "클레임 보강",
  sample: "개발용 샘플",
};

export const GUIDE_STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  review_pending: "감수 대기",
  published: "발행됨",
  archived: "보관",
};

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

export const MAKER_CATEGORY_LABEL: Record<string, string> = {
  treats: "간식",
  toys: "장난감",
  goods: "용품",
};

export const ITEM_CATEGORY_LABEL: Record<string, string> = {
  toy: "장난감",
  treat: "간식",
  supplement: "보조제",
  tool: "도구",
  gear: "용품",
};

export const OFFER_VENDOR_LABEL: Record<string, string> = {
  coupang: "쿠팡",
  brand_store: "자사몰",
  other: "구매처",
};

export const TOPIC_PHASE_LABEL: Record<string, string> = {
  initial: "지금 집중",
  secondary: "다음 확장",
  always: "상시",
};

/** /item/[id]-[slug] 류 URL 세그먼트에서 선행 숫자 id 를 뽑는다. 실패 시 null. */
export function parseIdSlug(segment: string): number | null {
  const m = decodeURIComponent(segment).match(/^(\d+)(?:-|$)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function idSlugPath(prefix: string, id: number, slug: string): string {
  return `/${prefix}/${id}-${encodeURIComponent(slug)}`;
}
