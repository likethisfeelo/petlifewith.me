import { afterEach, describe, expect, it, vi } from "vitest";
import { adminCookieDomain } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

function domainFor(siteUrl: string, siteEnv: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.stubEnv("NEXT_PUBLIC_SITE_ENV", siteEnv);
  return adminCookieDomain();
}

describe("adminCookieDomain", () => {
  it("운영 — admin. 과 메인 사이트가 공유하도록 상위 도메인", () => {
    expect(domainFor("https://petlifewith.me", "production")).toBe("petlifewith.me");
  });
  it("dev — dev. 와 admin-dev. 가 함께 쓰도록 상위 도메인", () => {
    expect(domainFor("https://dev.petlifewith.me", "preview")).toBe("petlifewith.me");
  });
  it("로컬은 호스트 전용 (도메인 지정 없음)", () => {
    expect(domainFor("http://localhost:3000", "local")).toBeUndefined();
  });
});
