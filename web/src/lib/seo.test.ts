import { describe, expect, it } from "vitest";
import { placeInfoItemCount, shouldIndexPlace, shouldIndexRegionPage } from "./seo";

const emptyPlace = {
  addressRoad: null,
  phone: null,
  descriptionMd: null,
  hoursText: null,
  priceText: null,
  parkingText: null,
};

describe("얇은 콘텐츠 방지 게이트 (claude.md 5-3)", () => {
  it("스팟 3개 미만 지역 페이지 → noindex", () => {
    expect(shouldIndexRegionPage(0)).toBe(false);
    expect(shouldIndexRegionPage(2)).toBe(false);
    expect(shouldIndexRegionPage(3)).toBe(true);
  });

  it("정보 3항목 미만 개별 장소 → noindex", () => {
    const sparse = { ...emptyPlace, addressRoad: "주소", phone: "02", status: "operating", source: "public_data" };
    expect(placeInfoItemCount(sparse)).toBe(2);
    expect(shouldIndexPlace(sparse)).toBe(false);

    const rich = { ...sparse, hoursText: "10-20시" };
    expect(shouldIndexPlace(rich)).toBe(true);
  });

  it("등록된 외부 링크도 정보 항목으로 센다", () => {
    const withLinks = { ...emptyPlace, addressRoad: "주소", phone: "02", status: "operating", source: "direct" };
    // 주소 + 전화 = 2항목이라 그대로면 미달
    expect(shouldIndexPlace(withLinks, 0)).toBe(false);
    // 카카오톡 링크 하나가 더해지면 3항목
    expect(placeInfoItemCount(withLinks, 1)).toBe(3);
    expect(shouldIndexPlace(withLinks, 1)).toBe(true);
  });

  it("빈 문자열은 정보 항목으로 세지 않는다", () => {
    const padded = { ...emptyPlace, addressRoad: "  ", phone: "02", descriptionMd: "설명" };
    expect(placeInfoItemCount(padded)).toBe(2);
  });

  it("폐업·샘플 스팟은 정보가 많아도 색인하지 않는다", () => {
    const rich = {
      ...emptyPlace,
      addressRoad: "주소",
      phone: "02",
      hoursText: "10-20시",
      priceText: "1만원",
    };
    expect(shouldIndexPlace({ ...rich, status: "closed", source: "public_data" })).toBe(false);
    expect(shouldIndexPlace({ ...rich, status: "operating", source: "sample" }, 5)).toBe(false);
    expect(shouldIndexPlace({ ...rich, status: "operating", source: "direct" })).toBe(true);
  });
});
