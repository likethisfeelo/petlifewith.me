// ============================================================
// 게시판 3분할과 정렬 규칙 — 순수 함수 (쿼리·페이지가 모두 이 규칙만 따른다)
//
//   1) 큐레이션 콘텐츠 (curated) — 관리자가 발행한 글 + 관리자가 골라 올린 회원 글.
//      curated_order(1~9) 를 준 글이 그 순서로 먼저, 나머지는 최신 발행순.
//   2) 일반 게시판 (challenge — 노견생활은 "일반 - 노령견 생활 공유 게시판") — 회원이 쓴 글 전체. 큐레이션 승격 여부와 무관하게 여기 남는다.
//      별도 테이블이 아니라 "글쓴이가 회원인가" 로 가른다.
//   3) 부위별 게시판 (category) — 카테고리별 묶음. 대표(area_order 1~3)가 먼저, 나머지는 최신순.
//
// 허브(전체 지도)는 목록이 아니라 별도 카드라 호출부에서 뺀다.
// ============================================================

/** 큐레이션 순서로 지정할 수 있는 최대 순번 — 토픽 상단 그리드 칸 수와 같다 */
export const MAX_CURATED_ORDER = 9;

/** 부위별 게시판 대표 글 수 */
export const MAX_AREA_ORDER = 3;

export interface Orderable {
  id: number;
  publishedAt: Date | null;
}

export interface CuratedOrderable extends Orderable {
  curatedOrder: number | null;
}

export interface AreaOrderable extends Orderable {
  areaOrder: number | null;
}

function inRange(n: number | null, max: number): boolean {
  return n !== null && Number.isInteger(n) && n >= 1 && n <= max;
}

export function hasCuratedOrder(g: { curatedOrder: number | null }): boolean {
  return inRange(g.curatedOrder, MAX_CURATED_ORDER);
}

export function isAreaLead(g: { areaOrder: number | null }): boolean {
  return inRange(g.areaOrder, MAX_AREA_ORDER);
}

function newestFirst(a: Orderable, b: Orderable): number {
  const ta = a.publishedAt ? a.publishedAt.getTime() : 0;
  const tb = b.publishedAt ? b.publishedAt.getTime() : 0;
  return tb - ta || b.id - a.id;
}

/** 지정 순번이 있는 글이 순번 순으로 먼저, 나머지는 최신순 */
function orderByRank<T extends Orderable>(rows: T[], rank: (row: T) => number | null, max: number): T[] {
  const ranked = rows.filter((r) => inRange(rank(r), max)).sort((a, b) => rank(a)! - rank(b)!);
  const rest = rows.filter((r) => !inRange(rank(r), max)).sort(newestFirst);
  return [...ranked, ...rest];
}

/** 큐레이션 피드 정렬 — curated_order → 최신순 */
export function orderCurated<T extends CuratedOrderable>(rows: T[]): T[] {
  return orderByRank(rows, (r) => r.curatedOrder, MAX_CURATED_ORDER);
}

/** 부위별 게시판 정렬 — 대표(area_order) → 최신순 */
export function orderArea<T extends AreaOrderable>(rows: T[]): T[] {
  return orderByRank(rows, (r) => r.areaOrder, MAX_AREA_ORDER);
}

/** 일반 게시판 정렬 — 최신순만 (순위·고정 없음) */
export function orderNewest<T extends Orderable>(rows: T[]): T[] {
  return [...rows].sort(newestFirst);
}

function parseRank(raw: string | null | undefined, max: number): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/** 큐레이션 순번 입력 검증 — 1~9 또는 없음 */
export function parseCuratedOrder(raw: string | null | undefined): number | null {
  return parseRank(raw, MAX_CURATED_ORDER);
}

/** 부위 대표 순번 입력 검증 — 1~3 또는 없음 */
export function parseAreaOrder(raw: string | null | undefined): number | null {
  return parseRank(raw, MAX_AREA_ORDER);
}
