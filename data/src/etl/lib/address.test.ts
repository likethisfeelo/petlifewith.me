import { describe, expect, it } from "vitest";
import { resolveRegionFromAddress, sanitizeRoadAddress } from "./address.js";

describe("sanitizeRoadAddress — 상세주소 제거 (claude.md 5-6)", () => {
  it("쉼표 이후(층·호수)를 제거한다", () => {
    expect(sanitizeRoadAddress("서울특별시 강남구 테헤란로 123, 4층 501호 (역삼동)")).toBe(
      "서울특별시 강남구 테헤란로 123",
    );
  });
  it("괄호 표기를 제거한다", () => {
    expect(sanitizeRoadAddress("경기도 성남시 분당구 판교로 11 (백현동)")).toBe(
      "경기도 성남시 분당구 판교로 11",
    );
  });
  it("빈 값은 null", () => {
    expect(sanitizeRoadAddress("  ")).toBeNull();
    expect(sanitizeRoadAddress(undefined)).toBeNull();
  });
});

describe("resolveRegionFromAddress — 시군구 귀속", () => {
  it("광역시 구", () => {
    const m = resolveRegionFromAddress("부산광역시 해운대구 우동 123");
    expect(m?.region.sigunguSlug).toBe("haeundae-gu");
  });
  it("도 + 일반구는 시로 합친다", () => {
    const m = resolveRegionFromAddress("경기도 수원시 장안구 정자로 55");
    expect(m?.region.sigunguName).toBe("수원시");
    expect(m?.mergedGu).toBe(true);
  });
  it("붙어 쓴 시군구(창원시마산합포구)도 시로 귀속", () => {
    const m = resolveRegionFromAddress("경상남도 창원시마산합포구 어딘가로 1");
    expect(m?.region.sigunguName).toBe("창원시");
  });
  it("세종은 단일 행", () => {
    const m = resolveRegionFromAddress("세종특별자치시 한누리대로 2130");
    expect(m?.region.sigunguSlug).toBe("sejong-si");
  });
  it("개칭 전 시도 표기(전라북도)도 인식", () => {
    const m = resolveRegionFromAddress("전라북도 전주시 완산구 효자로 1");
    expect(m?.region.sidoSlug).toBe("jeonbuk");
    expect(m?.region.sigunguName).toBe("전주시");
  });
  it("목록에 없는 시군구는 undefined — 지어내지 않는다", () => {
    expect(resolveRegionFromAddress("서울특별시 없는구 어딘가 1")).toBeUndefined();
    expect(resolveRegionFromAddress("")).toBeUndefined();
  });
  it("2026 통합 표기(전남광주통합특별시)는 시군구명으로 옛 시도에 귀속", () => {
    const gu = resolveRegionFromAddress("전남광주통합특별시 북구 용봉로 77");
    expect(gu?.region.sidoSlug).toBe("gwangju");
    expect(gu?.region.sigunguSlug).toBe("buk-gu");
    const si = resolveRegionFromAddress("전남광주통합특별시 순천시 중앙로 1");
    expect(si?.region.sidoSlug).toBe("jeonnam");
    expect(si?.region.sigunguName).toBe("순천시");
  });
  it("2026 인천 신설 구(검단·영종·서해·제물포)를 인식", () => {
    expect(resolveRegionFromAddress("인천광역시 검단구 아라로 1")?.region.sigunguSlug).toBe("geomdan-gu");
    expect(resolveRegionFromAddress("인천광역시 서해구 청라커낼로 1")?.region.sigunguSlug).toBe("seohae-gu");
    expect(resolveRegionFromAddress("인천광역시 영종구 공항로 1")?.region.sigunguSlug).toBe("yeongjong-gu");
    expect(resolveRegionFromAddress("인천광역시 제물포구 참외전로 1")?.region.sigunguSlug).toBe("jemulpo-gu");
  });
});
