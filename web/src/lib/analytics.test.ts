import { describe, expect, it } from "vitest";
import { isAdsExcluded, isAnalyticsExcluded } from "./analytics";

const APEX = "petlifewith.me";

describe("isAnalyticsExcluded", () => {
  it("공개 페이지는 수집한다", () => {
    expect(isAnalyticsExcluded("/", "petlifewith.me", APEX)).toBe(false);
    expect(isAnalyticsExcluded("/spot/seoul/jongno-gu", "www.petlifewith.me", APEX)).toBe(false);
    expect(isAnalyticsExcluded("/", "service.petlifewith.me", APEX)).toBe(false);
    expect(isAnalyticsExcluded("/", "product.petlifewith.me", APEX)).toBe(false);
  });
  it("경로가 /admin 이면 제외", () => {
    expect(isAnalyticsExcluded("/admin", "petlifewith.me", APEX)).toBe(true);
    expect(isAnalyticsExcluded("/admin/spots/123", "petlifewith.me", APEX)).toBe(true);
  });
  it("admin 서브도메인은 경로가 / 여도 제외 (미들웨어 재작성 대응)", () => {
    expect(isAnalyticsExcluded("/", "admin.petlifewith.me", APEX)).toBe(true);
    expect(isAnalyticsExcluded("/guides", "admin.petlifewith.me", APEX)).toBe(true);
    // dev 스테이지의 하이픈 형식도 같은 규칙
    expect(isAnalyticsExcluded("/", "admin-dev.petlifewith.me", "dev.petlifewith.me")).toBe(true);
  });
  it("이름이 비슷한 다른 호스트는 제외하지 않는다", () => {
    expect(isAnalyticsExcluded("/", "administrator.petlifewith.me", APEX)).toBe(false);
    expect(isAnalyticsExcluded("/adminx", "petlifewith.me", APEX)).toBe(false);
  });
});

describe("isAdsExcluded (AdSense 로드 범위)", () => {
  it("일반 공개 페이지는 허용", () => {
    expect(isAdsExcluded("/", "petlifewith.me", APEX)).toBe(false);
    expect(isAdsExcluded("/guide/some-post", "www.petlifewith.me", APEX)).toBe(false);
    expect(isAdsExcluded("/spot/seoul/jongno-gu", "petlifewith.me", APEX)).toBe(false);
    expect(isAdsExcluded("/rehabilitation-tips", "petlifewith.me", APEX)).toBe(false);
  });
  it("관리자·포털·클레임·재활 목록은 제외", () => {
    expect(isAdsExcluded("/admin/spots", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/portal/spot", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/claim/spot/1", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/rehab", "petlifewith.me", APEX)).toBe(true);
    // 개인 대화·상담은 광고를 붙이지 않는다. 기기 허브는 광고 대상이다.
    expect(isAdsExcluded("/chat/12", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/consult", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/device", "petlifewith.me", APEX)).toBe(false);
    expect(isAdsExcluded("/device/aqua-walk", "petlifewith.me", APEX)).toBe(false);
    expect(isAdsExcluded("/rehab/acupuncture", "petlifewith.me", APEX)).toBe(true);
  });
  it("회원 화면(로그인·가입·내정보·글쓰기)은 제외", () => {
    expect(isAdsExcluded("/login", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/signup", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/me", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/write/12", "petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/measure", "petlifewith.me", APEX)).toBe(false);
  });
  it("관리자·포털 서브도메인은 경로가 / 여도 제외 (통계와 달리 포털도 광고 없음)", () => {
    expect(isAdsExcluded("/", "admin.petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/", "service.petlifewith.me", APEX)).toBe(true);
    expect(isAdsExcluded("/", "product-dev.petlifewith.me", "dev.petlifewith.me")).toBe(true);
  });
});
