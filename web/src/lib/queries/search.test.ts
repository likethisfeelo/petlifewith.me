import { describe, expect, it } from "vitest";
import { csvCell, parseSearchFilter } from "./search";

describe("검색어 보관 — 필터·CSV", () => {
  it("기간이 없으면 마지막 보관일부터 28일", () => {
    expect(parseSearchFilter({}, "2026-10-14")).toMatchObject({ from: "2026-09-17", to: "2026-10-14" });
  });

  it("뒤바뀐 기간은 바로잡고, 잘못된 값은 버린다", () => {
    const f = parseSearchFilter({ from: "2026-10-10", to: "2026-10-01", device: "watch", q: "  노견 " }, null);
    expect(f).toMatchObject({ from: "2026-10-01", to: "2026-10-10", q: "노견" });
    expect(f.device).toBeUndefined();
    expect(parseSearchFilter({ from: "어제" }, "2026-10-14").from).toBe("2026-09-17");
  });

  it("CSV 칸 — 따옴표·쉼표 처리와 엑셀 수식 차단", () => {
    expect(csvCell('노견 "산책", 팁')).toBe('"노견 ""산책"", 팁"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(12)).toBe("12");
  });
});
