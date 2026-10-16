import { describe, expect, it } from "vitest";
import { NEWS_BANNER_SLOTS, normalizeNewsBanners, visibleNewsBanners } from "./news-banners";

describe("뉴스 배너", () => {
  it("항상 2칸으로 맞추고 이상한 값은 버린다", () => {
    const out = normalizeNewsBanners([{ active: true, href: "javascript:alert(1)", alt: 3, pcImageKey: "../x" }]);
    expect(out).toHaveLength(NEWS_BANNER_SLOTS);
    expect(out[0]).toMatchObject({ active: true, href: null, alt: "", pcImageKey: null });
    expect(out[1]?.active).toBe(false);
  });

  it("사이트 경로와 http(s) 링크는 받는다 (// 로 시작하는 주소는 거부)", () => {
    const [a, b] = normalizeNewsBanners([{ href: "/news/cctv-sign" }, { href: "https://example.com/a" }]);
    expect(a?.href).toBe("/news/cctv-sign");
    expect(b?.href).toBe("https://example.com/a");
    expect(normalizeNewsBanners([{ href: "//evil.example" }])[0]?.href).toBeNull();
  });

  it("켜져 있고 이미지가 있는 배너만 보인다", () => {
    const list = normalizeNewsBanners([{ active: true }, { active: false }]);
    expect(visibleNewsBanners(list)).toHaveLength(0);
  });
});
