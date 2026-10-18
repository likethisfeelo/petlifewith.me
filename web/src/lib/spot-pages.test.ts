import { describe, expect, it } from "vitest";
import { isPaidActive, linkBaseUrl, linkPageUrl, parseLinkKey, parseServices, tierOf, todayKst, validateHandle } from "./spot-pages";

const page = (o: Partial<{ published: boolean; paidFrom: string | null; paidUntil: string | null; handle: string | null }> = {}) => ({
  published: true,
  paidFrom: null,
  paidUntil: null,
  handle: null,
  ...o,
});

describe("spot pages", () => {
  it("한국 날짜", () => {
    expect(todayKst(new Date("2026-10-18T16:00:00Z"))).toBe("2026-10-19");
    expect(todayKst(new Date("2026-10-18T14:59:00Z"))).toBe("2026-10-18");
  });
  it("유료 기간", () => {
    expect(isPaidActive(page({ paidFrom: "2026-10-01", paidUntil: "2026-10-31" }), "2026-10-18")).toBe(true);
    expect(isPaidActive(page({ paidFrom: "2026-10-01", paidUntil: "2026-10-31" }), "2026-11-01")).toBe(false);
    expect(isPaidActive(page({ paidFrom: "2026-10-01" }), "2026-10-18")).toBe(false);
    expect(isPaidActive(null, "2026-10-18")).toBe(false);
  });
  it("등급: 상단 노출 → 유료 → 무료 → 미등록", () => {
    expect(tierOf({ promoted: true, page: null })).toBe("promoted");
    expect(tierOf({ promoted: false, page: page({ paidFrom: "2026-10-01", paidUntil: "2026-12-31" }) }, "2026-10-18")).toBe("paid");
    expect(tierOf({ promoted: false, page: page() })).toBe("free");
    expect(tierOf({ promoted: false, page: page({ published: false }) })).toBe("unlisted");
    expect(tierOf({ promoted: false, page: null })).toBe("unlisted");
  });
  it("짧은 주소 검사", () => {
    expect(validateHandle(" MasterPet ")).toEqual({ ok: true, handle: "masterpet" });
    expect(validateHandle("pet-taxi-1").ok).toBe(true);
    expect(validateHandle("12345").ok).toBe(false);
    expect(validateHandle("ab").ok).toBe(false);
    expect(validateHandle("-abc").ok).toBe(false);
    expect(validateHandle("a--b").ok).toBe(false);
    expect(validateHandle("admin").ok).toBe(false);
    expect(validateHandle("한글").ok).toBe(false);
  });
  it("링크 주소 기준", () => {
    expect(linkBaseUrl("https://petlifewith.me")).toBe("https://link.petlifewith.me");
    expect(linkBaseUrl("https://www.petlifewith.me")).toBe("https://link.petlifewith.me");
    expect(linkBaseUrl("https://dev.petlifewith.me")).toBe("https://link-dev.petlifewith.me");
    expect(linkBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/l");
  });
  it("링크 주소 — 유료+짧은 주소면 짧은 주소", () => {
    const b = "https://link.petlifewith.me";
    expect(linkPageUrl(b, 7, page({ handle: "masterpet", paidFrom: "2026-10-01", paidUntil: "2026-10-31" }), "2026-10-18")).toBe(`${b}/masterpet`);
    expect(linkPageUrl(b, 7, page({ handle: "masterpet", paidFrom: "2026-09-01", paidUntil: "2026-09-30" }), "2026-10-18")).toBe(`${b}/7`);
    expect(linkPageUrl(b, 7, null)).toBe(`${b}/7`);
  });
  it("주소 key 해석", () => {
    expect(parseLinkKey("123")).toEqual({ kind: "id", id: 123 });
    expect(parseLinkKey("MasterPet")).toEqual({ kind: "handle", handle: "masterpet" });
    expect(parseLinkKey("0")).toBeNull();
    expect(parseLinkKey("a b")).toBeNull();
  });
  it("주요 서비스 줄 나누기", () => {
    expect(parseServices("• 병원 동행\n\n- 공항 픽업 \n긴급 이동")).toEqual(["병원 동행", "공항 픽업", "긴급 이동"]);
  });
});
