import { describe, expect, it } from "vitest";
import { groupTypes, searchSpotRegions, shortSido, spotSearchHref } from "./spot-search";

const tiles = [
  { id: 1, sidoName: "서울특별시", sidoSlug: "seoul", sigunguName: "강남구", sigunguSlug: "gangnam-gu" },
  { id: 2, sidoName: "서울특별시", sidoSlug: "seoul", sigunguName: "강서구", sigunguSlug: "gangseo-gu" },
  { id: 3, sidoName: "경기도", sidoSlug: "gyeonggi", sigunguName: "수원시", sigunguSlug: "suwon-si" },
  { id: 4, sidoName: "부산광역시", sidoSlug: "busan", sigunguName: "강서구", sigunguSlug: "gangseo-gu" },
];

describe("spot search", () => {
  it("시도 짧게", () => {
    expect(shortSido("서울특별시")).toBe("서울");
    expect(shortSido("경기도")).toBe("경기");
    expect(shortSido("충청북도")).toBe("충북");
  });
  it("시군구 → 일반구 → 시도", () => {
    expect(searchSpotRegions(tiles, "강남").map((o) => o.label)).toEqual(["서울 강남구"]);
    expect(searchSpotRegions(tiles, "강서").map((o) => o.label)).toEqual(["부산 강서구", "서울 강서구"]);
    expect(searchSpotRegions(tiles, "영통")[0]?.label).toBe("경기 수원시 (영통구 포함)");
    expect(searchSpotRegions(tiles, "부산").map((o) => o.label)).toContain("부산 전체");
    expect(searchSpotRegions(tiles, "")).toEqual([]);
  });
  it("주소", () => {
    expect(spotSearchHref({ sidoSlug: "seoul", sigunguSlug: "gangnam-gu" }, "grooming")).toBe("/spot/seoul/gangnam-gu/grooming");
    expect(spotSearchHref({ sidoSlug: "seoul", sigunguSlug: "gangnam-gu" }, null)).toBe("/spot/seoul/gangnam-gu");
    expect(spotSearchHref({ sidoSlug: "seoul", sigunguSlug: null }, "grooming")).toBe("/spot/seoul");
  });
  it("유형 묶음", () => {
    const r = groupTypes([
      { slug: "pool", monetizable: true },
      { slug: "grooming", monetizable: true },
      { slug: "memorial", monetizable: false },
      { slug: "new-thing", monetizable: true },
    ]);
    expect(r.groups.map((g) => g.key)).toEqual(["play", "care", "etc"]);
    expect(r.facts.map((t) => t.slug)).toEqual(["memorial"]);
  });
});
