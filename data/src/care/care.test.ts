import { describe, expect, it } from "vitest";
import { carePersonLabel, isCareType, parseAreaListCell } from "./care.js";

describe("돌봄 파트너 상수", () => {
  it("펫시터·펫산책만 돌봄 유형이다", () => {
    expect(isCareType("pet-sitter")).toBe(true);
    expect(isCareType("hourly-sitter")).toBe(true);
    expect(isCareType("dog-walk")).toBe(true);
    expect(isCareType("boarding")).toBe(false);
    expect(isCareType(null)).toBe(false);
  });

  it("사람 호칭 — 시터 / 도그워커, 그 외는 통칭", () => {
    expect(carePersonLabel("pet-sitter")).toBe("펫시터");
    expect(carePersonLabel("hourly-sitter")).toBe("시간제 시터");
    expect(carePersonLabel("dog-walk")).toBe("도그워커");
    expect(carePersonLabel("grooming")).toBe("돌봄 파트너");
  });

  it("서비스지역 셀은 | 또는 ; 로 나누고 공백·빈 조각을 버린다", () => {
    expect(parseAreaListCell("서울특별시 마포구 | 서울특별시 서대문구;  ; 경기도 성남시")).toEqual([
      "서울특별시 마포구",
      "서울특별시 서대문구",
      "경기도 성남시",
    ]);
    expect(parseAreaListCell(null)).toEqual([]);
    expect(parseAreaListCell("   ")).toEqual([]);
  });
});
