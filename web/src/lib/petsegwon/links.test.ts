import { describe, expect, it } from "vitest";
import { analysisQuery, directoryLink, sidoFromSlug, sidoSlug, sigunguFromParam, sigunguParam } from "./links";

describe("petsegwon links", () => {
  it("시도 슬러그 왕복", () => {
    expect(sidoSlug("전남")).toBe("jeonnam");
    expect(sidoSlug("강원")).toBe("gangwon");
    expect(sidoFromSlug("jeonnam", ["서울", "전남"])).toBe("전남");
    expect(sidoFromSlug("nope", ["서울"])).toBeNull();
  });
  it("시군구 슬러그 — 디렉토리에 있으면 슬러그, 없으면 이름", () => {
    expect(sigunguParam("서울", "강남구")).toBe("gangnam-gu");
    expect(sigunguParam("경남", "창원시")).toBe("changwon-si");
    expect(sigunguParam("세종", "세종")).toBe("sejong-si");
    expect(sigunguParam("인천", "제물포구·영종구")).toBe("제물포구·영종구");
    expect(sigunguFromParam("서울", "gangnam-gu", ["강남구", "종로구"])).toBe("강남구");
    expect(sigunguFromParam("인천", "제물포구·영종구", ["제물포구·영종구"])).toBe("제물포구·영종구");
  });
  it("업장 링크", () => {
    expect(directoryLink("서울", "강남구", "grooming")).toEqual({ href: "/spot/seoul/gangnam-gu/grooming", label: "서울 강남구 미용·스파 업장 보기" });
    expect(directoryLink("서울", "강남구", "exhibition")?.href).toBe("/spot/seoul/gangnam-gu");
    expect(directoryLink("전남", null, "grooming")?.href).toBe("/spot/jeonnam");
    expect(directoryLink("인천", "제물포구·영종구", "boarding")?.href).toBe("/spot/incheon");
  });
  it("공유 주소", () => {
    expect(analysisQuery("전남", null, "grooming")).toBe("region=jeonnam&category=grooming");
    expect(analysisQuery("서울", "강남구", "boarding")).toBe("region=seoul&sigungu=gangnam-gu&category=boarding");
  });
});
