import { describe, expect, it } from "vitest";
import { isAnalyticsExcluded } from "./analytics";

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
