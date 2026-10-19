// ============================================================
// 업체 링크 페이지 — 등급·짧은 주소·주소 만들기 (순수 함수, 테스트 대상)
//
// 등급 (지역 목록 노출 순서도 이 순서):
//   promoted   지역 상단 노출(유료 광고, promotions.region_top)
//   paid       유료 링크 페이지 — spot_pages.paid_from ≤ 오늘 ≤ paid_until (관리자가 수동으로 켠다, 상단 노출과 별개)
//   free       링크 페이지가 있는 등록 업체 (등록 요청·소유 연결·관리자 생성)
//   unlisted   링크 페이지 없음 — 공공데이터에서 온 정보 일부만 있다 (직접 확인 안 된 정보 안내를 붙인다)
//
// 주소: 무료 link.<apex>/<번호>, 유료 link.<apex>/<짧은 주소>. dev 는 link-dev.petlifewith.me, 로컬은 <사이트>/l.
// ============================================================

export type SpotTier = "promoted" | "paid" | "free" | "unlisted";

export const TIER_ORDER: Record<SpotTier, number> = { promoted: 0, paid: 1, free: 2, unlisted: 3 };

export const TIER_LABEL: Record<SpotTier, string> = {
  promoted: "광고",
  paid: "프리미엄",
  free: "등록 업체",
  unlisted: "미등록",
};

/** 링크 페이지 사진·영상 — 종류별 최대 개수 (유료) */
export const SPOT_MEDIA_LIMIT = 10;

export interface SpotPageLike {
  published: boolean;
  paidFrom: string | null;
  paidUntil: string | null;
  handle: string | null;
}

/** 한국 날짜 (YYYY-MM-DD) */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function isPaidActive(page: Pick<SpotPageLike, "paidFrom" | "paidUntil"> | null | undefined, today: string = todayKst()): boolean {
  if (!page?.paidFrom || !page.paidUntil) return false;
  return page.paidFrom <= today && today <= page.paidUntil;
}

export function tierOf(input: { promoted: boolean; page: SpotPageLike | null | undefined }, today: string = todayKst()): SpotTier {
  if (input.promoted) return "promoted";
  if (!input.page?.published) return "unlisted";
  return isPaidActive(input.page, today) ? "paid" : "free";
}

/** 짧은 주소로 쓸 수 없는 이름 — 사이트 경로·운영 단어 */
const RESERVED = new Set([
  "admin", "api", "app", "l", "link", "links", "place", "spot", "spots", "www", "help", "about", "login", "logout", "signup",
  "me", "my", "portal", "service", "product", "news", "guide", "petlife", "petlifewithme", "official", "support", "static", "_next",
]);

/** 짧은 주소 검사 — 3~30자, 영문 소문자·숫자·하이픈, 글자 하나 이상(번호 주소와 겹치지 않게) */
export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const h = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(h)) return { ok: false, error: "짧은 주소는 영문 소문자·숫자·하이픈 3~30자로 적어 주세요 (처음과 끝은 하이픈 불가)." };
  if (!/[a-z]/.test(h)) return { ok: false, error: "짧은 주소에는 영문 글자가 하나 이상 있어야 합니다." };
  if (h.includes("--")) return { ok: false, error: "하이픈을 연달아 쓸 수 없습니다." };
  if (RESERVED.has(h)) return { ok: false, error: "이 이름은 쓸 수 없습니다. 다른 짧은 주소를 골라 주세요." };
  return { ok: true, handle: h };
}

/** 링크 페이지 주소의 기준 — 사이트 주소에서 만든다 */
export function linkBaseUrl(siteUrl: string): string {
  try {
    const u = new URL(siteUrl);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "localhost" || /^[\d.]+$/.test(host)) return `${u.origin}/l`;
    // dev.petlifewith.me 처럼 이미 서브도메인이면 하이픈 형식 (lib/hosts.ts — 와일드카드 인증서 한 단계)
    return host.split(".").length >= 3 ? `${u.protocol}//link-${host}` : `${u.protocol}//link.${host}`;
  } catch {
    return "/l";
  }
}

/** 업체 링크 페이지 주소 — 유료이고 짧은 주소가 있으면 그것, 아니면 번호 */
export function linkPageUrl(base: string, spotId: number, page: SpotPageLike | null | undefined, today: string = todayKst()): string {
  const key = page?.handle && isPaidActive(page, today) ? page.handle : String(spotId);
  return `${base}/${key}`;
}

/** /l/[key] 의 key 해석 — 숫자면 번호, 아니면 짧은 주소 */
export function parseLinkKey(key: string): { kind: "id"; id: number } | { kind: "handle"; handle: string } | null {
  const k = decodeURIComponent(key).trim().toLowerCase();
  if (/^\d{1,15}$/.test(k)) {
    const id = Number(k);
    return Number.isSafeInteger(id) && id > 0 ? { kind: "id", id } : null;
  }
  return /^[a-z0-9-]{3,30}$/.test(k) ? { kind: "handle", handle: k } : null;
}

/** 주요 서비스 — 줄마다 하나, 빈 줄 제거, 최대 12개·각 60자 */
export function parseServices(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•·*]\s*/, "").trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 12);
}

/** 사장님이 직접 확인하지 않은 업체 안내 (미등록) */
export const UNVERIFIED_NOTICE =
  "업체가 직접 확인하지 않은 정보입니다. 공공데이터포털에서 확인된 정보 중 일부만 제공되고 있어 위치·연락처가 정확하지 않을 수 있으니, 이용 전 업체에 직접 문의하세요.";

// ---------- 프리미엄 상태 (관리자 유료 상품 화면) ----------

export type PremiumState = "active" | "scheduled" | "expired" | "none";

export const PREMIUM_STATE_LABEL: Record<PremiumState, string> = {
  active: "진행 중",
  scheduled: "시작 예정",
  expired: "끝남",
  none: "미적용",
};

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 프리미엄 상태와 남은 날 (진행 중이면 종료일까지, 예정이면 시작일까지) */
export function premiumStatus(page: Pick<SpotPageLike, "paidFrom" | "paidUntil"> | null | undefined, today: string = todayKst()): { state: PremiumState; days: number | null } {
  if (!page?.paidFrom || !page.paidUntil) return { state: "none", days: null };
  if (today < page.paidFrom) return { state: "scheduled", days: dayDiff(today, page.paidFrom) };
  if (today > page.paidUntil) return { state: "expired", days: dayDiff(page.paidUntil, today) };
  return { state: "active", days: dayDiff(today, page.paidUntil) };
}

/** 기간 빠른 선택 — 시작일부터 n개월 뒤 하루 전 (2026-10-19 + 1개월 → 2026-11-18) */
export function addMonths(start: string, months: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
