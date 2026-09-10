import { describe, expect, it } from "vitest";
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_BLURB, DEVICE_CATEGORY_LABEL, deviceIndexable, isDeviceCategory, isDeviceSiteKind } from "./devices";

describe("기기 분류", () => {
  it("모든 분류에 라벨과 설명이 있다", () => {
    for (const c of DEVICE_CATEGORIES) {
      expect(DEVICE_CATEGORY_LABEL[c].length).toBeGreaterThan(0);
      expect(DEVICE_CATEGORY_BLURB[c].length).toBeGreaterThan(0);
    }
  });

  it("분류·보유처 종류를 가려낸다", () => {
    expect(isDeviceCategory("rehab_equipment")).toBe(true);
    expect(isDeviceCategory("massage")).toBe(false);
    expect(isDeviceSiteKind("hospital")).toBe(true);
    expect(isDeviceSiteKind("trial")).toBe(true);
    expect(isDeviceSiteKind("dealer")).toBe(false);
  });
});

describe("기기 페이지 색인 게이트", () => {
  const long = "가".repeat(200);

  it("공개 + 원리 설명 200자 이상이어야 색인한다", () => {
    expect(deviceIndexable({ published: true, summaryMd: long })).toBe(true);
    expect(deviceIndexable({ published: false, summaryMd: long })).toBe(false);
    expect(deviceIndexable({ published: true, summaryMd: "짧은 설명" })).toBe(false);
    expect(deviceIndexable({ published: true, summaryMd: null })).toBe(false);
  });

  it("공백만 채운 설명은 통과하지 못한다", () => {
    expect(deviceIndexable({ published: true, summaryMd: " ".repeat(300) })).toBe(false);
  });
});
