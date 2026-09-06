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
  it("쉼표 없이 이어진 동·호수·층도 건물번호 뒤에서 자른다", () => {
    expect(sanitizeRoadAddress("경기도 용인시 기흥구 한일로9번길 20 103동 02호")).toBe("경기도 용인시 기흥구 한일로9번길 20");
    expect(sanitizeRoadAddress("서울특별시 동작구 노들로2길 7 A동 2층 201호")).toBe("서울특별시 동작구 노들로2길 7");
    expect(sanitizeRoadAddress("서울특별시 금천구 시흥대로126길 22-8 1층 102호")).toBe("서울특별시 금천구 시흥대로126길 22-8");
    expect(sanitizeRoadAddress("인천광역시 남동구 청능대로 581 503-413호")).toBe("인천광역시 남동구 청능대로 581");
  });
  it("건물명·아파트 단지명은 남기지 않는다 (1인 사업장 = 주거지)", () => {
    expect(sanitizeRoadAddress("경기 성남시 분당구 서현동 96 시범단지우성아파트")).toBe("경기 성남시 분당구 서현동 96");
    expect(sanitizeRoadAddress("경기도 고양시 일산동구 정발산로 24 웨스턴돔1, 2층 A-263호 버블펫")).toBe(
      "경기도 고양시 일산동구 정발산로 24",
    );
    expect(sanitizeRoadAddress("경기도 수원시 권선구 금곡로 229 다인로얄팰리스 3차 1층 116호 건물뒷편")).toBe(
      "경기도 수원시 권선구 금곡로 229",
    );
  });
  it("번지·읍면리·지하 표기를 유지한다", () => {
    expect(sanitizeRoadAddress("광주 남구 주월동 1022-6번지 2층")).toBe("광주 남구 주월동 1022-6번지");
    expect(sanitizeRoadAddress("부산광역시 기장군 일광읍 일광로 111-10")).toBe("부산광역시 기장군 일광읍 일광로 111-10");
    expect(sanitizeRoadAddress("서울특별시 강남구 강남대로 지하 396")).toBe("서울특별시 강남구 강남대로 지하 396");
    expect(sanitizeRoadAddress("전북 전주시 완산구 효자동1가 180-18")).toBe("전북 전주시 완산구 효자동1가 180-18");
  });
  it("건물번호가 없으면 상세 위치 토큰부터 버리고 나머지는 그대로 둔다", () => {
    expect(sanitizeRoadAddress("서울특별시 강동구 길동")).toBe("서울특별시 강동구 길동");
    expect(sanitizeRoadAddress("경기도 고양시 일산동구 정발산로24")).toBe("경기도 고양시 일산동구 정발산로24");
    expect(sanitizeRoadAddress("어딘가 상가 3층 301호")).toBe("어딘가 상가");
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
