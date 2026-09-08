import { describe, expect, it } from "vitest";
import { orderForTopic, parsePinnedOrder } from "./guide-order";

const d = (iso: string) => new Date(iso);

describe("토픽 목록 정렬 — 고정 3 → 최신순", () => {
  it("고정 글은 순번 순으로 먼저, 나머지는 최신 발행이 위로", () => {
    const rows = [
      { id: 1, pinnedOrder: null, publishedAt: d("2026-01-01") },
      { id: 2, pinnedOrder: 2, publishedAt: d("2025-01-01") },
      { id: 3, pinnedOrder: null, publishedAt: d("2026-09-01") },
      { id: 4, pinnedOrder: 1, publishedAt: d("2024-01-01") },
      { id: 5, pinnedOrder: null, publishedAt: d("2026-05-01") },
    ];
    expect(orderForTopic(rows).map((r) => r.id)).toEqual([4, 2, 3, 5, 1]);
  });
  it("범위 밖 고정 순번(0·4)은 고정으로 치지 않고, 발행일이 같으면 id 가 큰(새) 글이 위", () => {
    const rows = [
      { id: 1, pinnedOrder: 4, publishedAt: d("2026-01-01") },
      { id: 2, pinnedOrder: 0, publishedAt: d("2026-01-01") },
    ];
    expect(orderForTopic(rows).map((r) => r.id)).toEqual([2, 1]);
  });
  it("고정 순번 입력은 1~3만 받는다", () => {
    expect(parsePinnedOrder("")).toBeNull();
    expect(parsePinnedOrder("2")).toBe(2);
    expect(parsePinnedOrder("4")).toBeNull();
    expect(parsePinnedOrder("abc")).toBeNull();
  });
});
