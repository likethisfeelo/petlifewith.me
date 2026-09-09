import { beforeEach, describe, expect, it } from "vitest";
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
    const ok = renderMarkdown("{{instagram:https://www.instagram.com/p/C1a2B3c4D5e/|작가|https://www.instagram.com/p/C1a2B3c4D5e/}}");
    expect(ok.hasInstagramEmbed).toBe(true);
    expect(ok.html).toContain("instagram-media");

    const bad = renderMarkdown("{{instagram:https://evil.example.com/p/C1a2B3c4D5e/|작가|https://a.b}}");
    expect(bad.hasInstagramEmbed).toBe(false);
    expect(bad.html).toContain("md-embed-invalid");

    // 릴스는 되고 스토리는 안 된다. 주소는 정규화된 퍼머링크로 들어간다
    const reel = renderMarkdown("{{instagram:https://instagram.com/reels/C1a2B3c4D5e?igsh=1|작가|https://www.instagram.com/reel/C1a2B3c4D5e/}}");
    expect(reel.hasInstagramEmbed).toBe(true);
    expect(reel.html).toContain('data-instgrm-permalink="https://www.instagram.com/reel/C1a2B3c4D5e/"');
    const story = renderMarkdown("{{instagram:https://www.instagram.com/stories/someone/123/|작가|https://www.instagram.com/stories/someone/123/}}");
    expect(story.hasInstagramEmbed).toBe(false);
    expect(story.html).toContain("스토리 불가");
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

describe("renderMarkdown — 업로드 미디어 숏코드 (키만 저장, URL 은 렌더 시 조립)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ASSET_BASE_URL = "https://assets.example.com/bucket";
  });

  it("이미지: alt 와 캡션이 붙는다", () => {
    const { html } = renderMarkdown("{{image:media/image/123-photo.jpg|목욕하는 강아지|직접 촬영}}");
    expect(html).toContain('src="https://assets.example.com/bucket/media/image/123-photo.jpg"');
    expect(html).toContain('alt="목욕하는 강아지"');
    expect(html).toContain("직접 촬영");
    expect(html).toContain('loading="lazy"');
  });

  it("영상: video 태그로 렌더된다", () => {
    const { html } = renderMarkdown("{{video:media/video/123-clip.mp4|노즈워크 시연}}");
    expect(html).toContain("<video controls");
    expect(html).toContain("media/video/123-clip.mp4");
    expect(html).toContain("노즈워크 시연");
  });

  it("자산 베이스 URL 미설정이면 렌더하지 않고 사유를 보여준다", () => {
    delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
    const { html } = renderMarkdown("{{image:media/image/123-photo.jpg|alt}}");
    expect(html).toContain("md-embed-invalid");
    expect(html).not.toContain("<img");
  });

  it("경로 탈출 등 이상한 키는 거부한다", () => {
    const { html } = renderMarkdown("{{image:../../etc/passwd|x}}");
    expect(html).toContain("md-embed-invalid");
    expect(html).not.toContain("<img");
  });
});

describe("renderMarkdown — #태그", () => {
  it("본문의 #태그 는 /tag/ 링크(md-tag)가 되고 제목·주소 속 # 은 그대로", () => {
    const { html } = renderMarkdown("## 제목 #아님\n\n오늘 #노즈워크 했다. https://a.b/#frag");
    expect(html).toContain('<a href="/tag/%EB%85%B8%EC%A6%88%EC%9B%8C%ED%81%AC" class="md-tag">#노즈워크</a>');
    expect(html).toContain("제목 #아님");
    expect(html).toContain("https://a.b/#frag");
  });
});
