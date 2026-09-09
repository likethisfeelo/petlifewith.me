import { describe, expect, it } from "vitest";
import { hasCuratedOrder, isAreaLead, orderArea, orderCurated, orderNewest, parseAreaOrder, parseCuratedOrder } from "./guide-order";

const d = (s: string) => new Date(s);

describe("큐레이션 정렬", () => {
  it("순번 지정 글이 순번 순으로 먼저, 나머지는 최신순", () => {
    const rows = [
      { id: 1, curatedOrder: null, publishedAt: d("2026-01-01") },
      { id: 2, curatedOrder: 2, publishedAt: d("2025-01-01") },
      { id: 3, curatedOrder: null, publishedAt: d("2026-09-01") },
      { id: 4, curatedOrder: 1, publishedAt: d("2024-01-01") },
      { id: 5, curatedOrder: null, publishedAt: d("2026-05-01") },
    ];
    expect(orderCurated(rows).map((r) => r.id)).toEqual([4, 2, 3, 5, 1]);
  });

  it("범위 밖 순번(0, 10)은 지정 없음으로 본다", () => {
    const rows = [
      { id: 1, curatedOrder: 10, publishedAt: d("2026-01-01") },
      { id: 2, curatedOrder: 0, publishedAt: d("2026-02-01") },
    ];
    expect(orderCurated(rows).map((r) => r.id)).toEqual([2, 1]);
    expect(hasCuratedOrder({ curatedOrder: 9 })).toBe(true);
    expect(hasCuratedOrder({ curatedOrder: 10 })).toBe(false);
  });

  it("입력 검증 — 1~9 또는 없음", () => {
    expect(parseCuratedOrder("")).toBeNull();
    expect(parseCuratedOrder("2")).toBe(2);
    expect(parseCuratedOrder("9")).toBe(9);
    expect(parseCuratedOrder("10")).toBeNull();
    expect(parseCuratedOrder("abc")).toBeNull();
  });
});

describe("부위별 게시판 정렬", () => {
  it("대표(1~3)가 먼저, 나머지는 최신순", () => {
    const rows = [
      { id: 1, areaOrder: null, publishedAt: d("2026-09-01") },
      { id: 2, areaOrder: 3, publishedAt: d("2024-01-01") },
      { id: 3, areaOrder: 1, publishedAt: d("2023-01-01") },
      { id: 4, areaOrder: null, publishedAt: d("2026-08-01") },
    ];
    expect(orderArea(rows).map((r) => r.id)).toEqual([3, 2, 1, 4]);
    expect(isAreaLead({ areaOrder: 2 })).toBe(true);
    expect(isAreaLead({ areaOrder: 4 })).toBe(false);
  });

  it("입력 검증 — 1~3 또는 없음", () => {
    expect(parseAreaOrder("")).toBeNull();
    expect(parseAreaOrder("3")).toBe(3);
    expect(parseAreaOrder("4")).toBeNull();
  });
});

describe("도전 게시판 정렬", () => {
  it("최신순만, 같은 시각이면 id 내림차순", () => {
    const rows = [
      { id: 1, publishedAt: d("2026-01-01") },
      { id: 2, publishedAt: d("2026-01-01") },
      { id: 3, publishedAt: d("2026-03-01") },
      { id: 4, publishedAt: null },
    ];
    expect(orderNewest(rows).map((r) => r.id)).toEqual([3, 2, 1, 4]);
  });
});
