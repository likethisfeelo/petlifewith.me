import { describe, expect, it } from "vitest";
import { REGIONS, SIDO } from "@app/data";
import { SEOUL_GRID, SEOUL_TILES, SIDO_GRID, SIDO_TILES, tileLabel } from "./care-map-layout";

describe("돌봄 지도 타일 배치", () => {
  it("시도 타일 17개가 기준 목록과 1:1 이고 겹치지 않는다", () => {
    expect(SIDO_TILES.map((t) => t.slug).sort()).toEqual(SIDO.map((s) => s.slug).sort());
    const cells = new Set(SIDO_TILES.map((t) => `${t.col},${t.row}`));
    expect(cells.size).toBe(SIDO_TILES.length);
    for (const t of SIDO_TILES) {
      expect(t.col).toBeLessThan(SIDO_GRID.cols);
      expect(t.row).toBeLessThan(SIDO_GRID.rows);
    }
  });

  it("서울 타일 25개가 regions 의 구 이름과 정확히 같고 겹치지 않는다", () => {
    const seoul = REGIONS.filter((r) => r.sidoSlug === "seoul").map((r) => r.sigunguName).sort();
    expect(Object.keys(SEOUL_TILES).sort()).toEqual(seoul);
    const cells = new Set(Object.values(SEOUL_TILES).map((p) => `${p.col},${p.row}`));
    expect(cells.size).toBe(25);
    for (const p of Object.values(SEOUL_TILES)) {
      expect(p.col).toBeLessThan(SEOUL_GRID.cols);
      expect(p.row).toBeLessThan(SEOUL_GRID.rows);
    }
  });

  it("타일 라벨은 긴 이름만 접미사를 줄인다", () => {
    expect(tileLabel("마포구")).toBe("마포구");
    expect(tileLabel("서귀포시")).toBe("서귀포");
    expect(tileLabel("동대문구")).toBe("동대문");
    expect(tileLabel("중구")).toBe("중구");
  });
});
