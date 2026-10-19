// ============================================================
// 업체 등록 흐름 — 내 업체 찾기·중복 확인 규칙 (순수 함수, 테스트 대상)
// 화면: app/portal/spot (찾기 → 내 업체예요 / 새로 등록 → 연락처 남기기)
// ============================================================

/** 전화번호 숫자만 (02-123-4567 → 021234567). 9자리 미만이면 null — 검색·비교에 쓰기엔 짧다 */
export function phoneDigits(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d : null;
}

/** 이름 비교용 — 공백·기호·흔한 꾸밈말 제거, 소문자 */
export function nameKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[\s·.,&+\-_'"!?/]/g, "")
    .replace(/(주식회사|유한회사|\(주\)|㈜)/g, "");
}

/** 같은 업체로 볼 만큼 이름이 비슷한가 — 한쪽이 다른 쪽을 포함(지점명 차이)하거나 같으면 */
export function namesLookSame(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  if (x.length < 2 || y.length < 2) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export type OwnerState = "none" | "mine" | "other";

export function ownerStateOf(claimedBy: string | null, memberId: string | null): OwnerState {
  if (!claimedBy) return "none";
  return memberId && claimedBy === memberId ? "mine" : "other";
}

/** 검색어 정리 — 2자 미만이면 검색하지 않는다 */
export function searchTerm(raw: string | null | undefined): { text: string; phone: string | null } | null {
  const text = (raw ?? "").trim().slice(0, 40);
  if (text.replace(/\s/g, "").length < 2) return null;
  return { text, phone: phoneDigits(text) };
}
