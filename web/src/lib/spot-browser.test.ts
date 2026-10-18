import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, countActiveFilters, filterSpots, parseView, placeIdFromPath, withinBounds, type BrowserSpot } from "./spot-browser";

const base: BrowserSpot = {
  id: 1, name: "가", href: "/place/1-a", typeName: "미용", typeSlug: "grooming", regionLabel: "서울 종로구", address: null,
  status: "operating", hours: null, parking: null, price: null, tier: "unlisted", monetizable: true, heroUrl: null, lat: null, lng: null, booking: false, claimed: false,
};
const items: BrowserSpot[] = [
  { ...base, id: 1, name: "다", tier: "paid", hours: "09-18", booking: true, lat: 37.5, lng: 127 },
  { ...base, id: 2, name: "가", status: "closed", parking: "가능" },
  { ...base, id: 3, name: "나", tier: "free", lat: 35, lng: 129 },
];

describe("spot browser", () => {
  it("필터", () => {
    expect(filterSpots(items, EMPTY_FILTERS).map((s) => s.id)).toEqual([1, 2, 3]);
    expect(filterSpots(items, { ...EMPTY_FILTERS, open: true }).map((s) => s.id)).toEqual([1, 3]);
    expect(filterSpots(items, { ...EMPTY_FILTERS, parking: true }).map((s) => s.id)).toEqual([2]);
    expect(filterSpots(items, { ...EMPTY_FILTERS, booking: true, hours: true }).map((s) => s.id)).toEqual([1]);
    expect(filterSpots(items, { ...EMPTY_FILTERS, registered: true }).map((s) => s.id)).toEqual([1, 3]);
    expect(countActiveFilters({ ...EMPTY_FILTERS, open: true, parking: true })).toBe(2);
  });
  it("정렬: 기본은 서버 순서, 이름순은 가나다", () => {
    expect(filterSpots(items, EMPTY_FILTERS, "name").map((s) => s.name)).toEqual(["가", "나", "다"]);
  });
  it("지도 범위", () => {
    expect(withinBounds(items, { south: 37, west: 126, north: 38, east: 128 }).map((s) => s.id)).toEqual([1]);
    expect(withinBounds(items, null)).toHaveLength(3);
  });
  it("주소 해석", () => {
    expect(parseView("map")).toBe("map");
    expect(parseView("x")).toBeNull();
    expect(placeIdFromPath("/place/123-abc")).toBe(123);
    expect(placeIdFromPath("/place/123")).toBe(123);
    expect(placeIdFromPath("/spot/seoul")).toBeNull();
  });
});
