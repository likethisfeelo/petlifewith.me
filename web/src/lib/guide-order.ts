// ============================================================
// 토픽 목록 정렬 규칙 — 순수 함수 (쿼리·페이지가 모두 이 규칙만 따른다)
//   1) 최상단 고정(pinned_order 1~3) 이 먼저, 순번 순
//   2) 나머지는 최신 발행순 — 새 글은 무조건 위로
// 허브(전체 지도)는 목록이 아니라 별도 카드라 호출부에서 뺀다.
// ============================================================

export const MAX_PINNED_PER_TOPIC = 3;

export interface Orderable {
  pinnedOrder: number | null;
  publishedAt: Date | null;
  id: number;
}

export function isPinned(g: { pinnedOrder: number | null }): boolean {
  return g.pinnedOrder !== null && g.pinnedOrder >= 1 && g.pinnedOrder <= MAX_PINNED_PER_TOPIC;
}

function publishedTime(g: Orderable): number {
  return g.publishedAt ? g.publishedAt.getTime() : 0;
}

/** 고정 → 최신순으로 정렬한 새 배열 */
export function orderForTopic<T extends Orderable>(rows: T[]): T[] {
  const pinned = rows.filter(isPinned).sort((a, b) => a.pinnedOrder! - b.pinnedOrder!);
  const rest = rows
    .filter((g) => !isPinned(g))
    .sort((a, b) => publishedTime(b) - publishedTime(a) || b.id - a.id);
  return [...pinned, ...rest];
}

/** 고정 순번 입력 검증 — 1~3 또는 없음 */
export function parsePinnedOrder(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PINNED_PER_TOPIC) return null;
  return n;
}
