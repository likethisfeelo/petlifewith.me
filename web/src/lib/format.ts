// 표시용 포맷터·라벨. UI 문자열을 한 곳에 모은다.
//
// 날짜·시각은 반드시 **한국 시간(KST) 고정**으로 찍는다. 시간대를 지정하지 않으면
// 서버(Lambda=UTC)와 브라우저(KST)가 다른 문자열을 만든다 — 클라이언트 컴포넌트에서 그러면
// 하이드레이션 불일치(React #418)로 페이지가 통째로 죽는다. 그래서 시각 문자열은
// 서버에서 만들어 넘기고(예: PublicComment.createdAtLabel), 포맷터는 항상 timeZone 을 준다.
const DISPLAY_TIME_ZONE = "Asia/Seoul";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** 날짜 + 시각 (KST 고정). 서버에서만 호출해 문자열로 넘긴다. */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  claimed: "요청 반영",
  sample: "개발용 샘플",
};

export const GUIDE_STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  review_pending: "감수 대기",
  published: "발행됨",
  archived: "보관",
  pending: "승인 대기 (회원 글)",
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
