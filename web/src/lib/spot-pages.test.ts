import { describe, expect, it } from "vitest";
import { PREMIUM_THEMES, contrastRatio, premiumTheme, mediaLimit, visibleMedia, addMonths, premiumStatus, isPaidActive, linkBaseUrl, linkPageUrl, parseLinkKey, parseServices, tierOf, todayKst, validateHandle } from "./spot-pages";

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
  it("프리미엄 상태", () => {
    const p = { paidFrom: "2026-10-10", paidUntil: "2026-10-31" };
    expect(premiumStatus(p, "2026-10-19")).toEqual({ state: "active", days: 12 });
    expect(premiumStatus(p, "2026-10-01")).toEqual({ state: "scheduled", days: 9 });
    expect(premiumStatus(p, "2026-11-02")).toEqual({ state: "expired", days: 2 });
    expect(premiumStatus(null)).toEqual({ state: "none", days: null });
  });
  it("기간 빠른 선택", () => {
    expect(addMonths("2026-10-19", 1)).toBe("2026-11-18");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-27");
    expect(addMonths("2026-10-19", 12)).toBe("2027-10-18");
  });
  it("사진·영상 한도", () => {
    expect(mediaLimit(false, "image")).toBe(3);
    expect(mediaLimit(false, "video")).toBe(1);
    expect(mediaLimit(true, "video")).toBe(10);
    const items: Array<{ kind: "image" | "video"; i: number }> = [...[...Array(5)].map((_, i) => ({ kind: "image" as const, i })), ...[...Array(3)].map((_, i) => ({ kind: "video" as const, i: 10 + i }))];
    expect(visibleMedia(items, false).map((m) => m.i)).toEqual([0, 1, 2, 10]);
    expect(visibleMedia(items, true)).toHaveLength(8);
  });
  it("프리미엄 테마 — 흰 글자 대비", () => {
    for (const t of PREMIUM_THEMES) for (const c of [t.bg, t.box, t.card, t.head]) expect(contrastRatio("#ffffff", c)).toBeGreaterThanOrEqual(4.5);
    expect(premiumTheme("nope").key).toBe("black");
    expect(premiumTheme("teal").name).toBe("딥틸");
  });
});
