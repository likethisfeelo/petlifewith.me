import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown — 임베드 규칙 (기획서 3-2·3-4)", () => {
  it("유튜브 숏코드는 공식 iframe + 창작자·원본 링크 표기로 렌더된다", () => {
    const { html, hasYoutubeEmbed } = renderMarkdown("{{youtube:abc12345|멍멍채널|https://youtube.com/watch?v=abc12345}}");
    expect(hasYoutubeEmbed).toBe(true);
    expect(html).toContain("youtube-nocookie.com/embed/abc12345");
    expect(html).toContain("멍멍채널");
    expect(html).toContain("원본 보기");
  });

  it("창작자명이나 원본 링크가 없으면 임베드를 렌더하지 않는다", () => {
    const { html, hasYoutubeEmbed } = renderMarkdown("{{youtube:abc12345|멍멍채널}}");
    expect(hasYoutubeEmbed).toBe(false);
    expect(html).toContain("md-embed-invalid");
    expect(html).not.toContain("iframe");
  });

  it("인스타그램은 공식 임베드 코드 형식만", () => {
    const ok = renderMarkdown("{{instagram:https://www.instagram.com/p/XYZ/|작가|https://www.instagram.com/p/XYZ/}}");
    expect(ok.hasInstagramEmbed).toBe(true);
    expect(ok.html).toContain("instagram-media");

    const bad = renderMarkdown("{{instagram:https://evil.example.com/p/XYZ/|작가|https://a.b}}");
    expect(bad.hasInstagramEmbed).toBe(false);
    expect(bad.html).toContain("md-embed-invalid");
  });
});

describe("renderMarkdown — 링크·안전성", () => {
  it("쿠팡 계열 링크는 sponsored + 고지 플래그", () => {
    const { html, hasAffiliateLinks } = renderMarkdown("[상품](https://link.coupang.com/a/xyz)");
    expect(hasAffiliateLinks).toBe(true);
    expect(html).toContain('rel="sponsored noopener noreferrer"');
  });

  it("일반 외부 링크는 noopener, 내부 링크는 그대로", () => {
    const ext = renderMarkdown("[글](https://example.com/post)");
    expect(ext.hasAffiliateLinks).toBe(false);
    expect(ext.html).toContain('rel="noopener noreferrer"');

    const int = renderMarkdown("[허브](/guide/senior-life-hub)");
    expect(int.html).not.toContain("noopener");
    expect(int.html).toContain('href="/guide/senior-life-hub"');
  });

  it("원문 HTML 은 이스케이프된다", () => {
    const { html } = renderMarkdown('본문 <script>alert(1)</script> 이후');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("헤딩에 앵커 id 가 붙는다", () => {
    const { html } = renderMarkdown("## 무엇을 살펴볼까");
    expect(html).toContain('<h2 id="무엇을-살펴볼까">');
  });
});
