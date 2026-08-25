// ============================================================
// 마크다운 렌더링
//  - 원문 HTML 은 통과시키지 않는다 (전부 이스케이프) — 본문은 마크다운만.
//  - 임베드는 숏코드로만 삽입한다. 창작자명·원본 링크가 없으면 렌더하지 않는다.
//    (기획서 3-2·3-4: 공식 임베드만, 출처는 본문 내 해당 위치에 표기)
//      {{youtube:VIDEO_ID|창작자명|원본URL}}
//      {{instagram:게시물URL|창작자명|원본URL}}
//  - 직접 올린 미디어도 숏코드로 넣는다 — 본문에는 오브젝트 키만 저장되고
//    URL 은 렌더 시점에 조립된다 (claude.md 10-1):
//      {{image:오브젝트키|대체텍스트|캡션(선택)}}
//      {{video:오브젝트키|캡션(선택)}}
//  - 쿠팡 계열 링크는 rel="sponsored" + 감지 플래그 → 페이지가 수수료 고지를 띄운다.
// ============================================================
import { Marked } from "marked";
import { assetUrl, isValidObjectKey } from "./assets";

export interface RenderedMarkdown {
  html: string;
  hasAffiliateLinks: boolean;
  hasInstagramEmbed: boolean;
  hasYoutubeEmbed: boolean;
}

const AFFILIATE_HOSTS = ["link.coupang.com", "coupa.ng"];

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function isAffiliateUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname;
    return AFFILIATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

const YOUTUBE_ID_RE = /^[\w-]{5,20}$/;

function youtubeEmbedHtml(videoId: string, creator: string, originalUrl: string): string {
  // 공식 플레이어 임베드(iframe)만 허용. youtube-nocookie 는 공식 프라이버시 모드다.
  return [
    `<figure class="md-embed">`,
    `<div class="md-embed-frame"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" title="${escapeHtml(creator)} 영상" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`,
    `<figcaption>영상: ${escapeHtml(creator)} · <a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">원본 보기</a></figcaption>`,
    `</figure>`,
  ].join("");
}

function instagramEmbedHtml(postUrl: string, creator: string, originalUrl: string): string {
  // 공식 임베드 코드 형식(blockquote + embed.js). 막히면 그 콘텐츠는 포기한다 — 우회 없음.
  return [
    `<figure class="md-embed">`,
    `<blockquote class="instagram-media" data-instgrm-permalink="${escapeHtml(postUrl)}" data-instgrm-version="14"><a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener noreferrer">Instagram 게시물 보기</a></blockquote>`,
    `<figcaption>게시물: ${escapeHtml(creator)} · <a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">원본 보기</a></figcaption>`,
    `</figure>`,
  ].join("");
}

function imageHtml(key: string, alt: string, caption: string | undefined): string {
  const url = assetUrl(key);
  if (!url) return invalidEmbedHtml("NEXT_PUBLIC_ASSET_BASE_URL 미설정 — 미디어 URL 을 만들 수 없습니다");
  return [
    `<figure class="md-media">`,
    `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`,
    caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "",
    `</figure>`,
  ].join("");
}

function videoHtml(key: string, caption: string | undefined): string {
  const url = assetUrl(key);
  if (!url) return invalidEmbedHtml("NEXT_PUBLIC_ASSET_BASE_URL 미설정 — 미디어 URL 을 만들 수 없습니다");
  return [
    `<figure class="md-media">`,
    `<video controls playsinline preload="metadata" src="${escapeHtml(url)}"></video>`,
    caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "",
    `</figure>`,
  ].join("");
}

function invalidEmbedHtml(reason: string): string {
  return `<div class="md-embed-invalid">임베드가 렌더되지 않았습니다 — ${escapeHtml(reason)}.</div>`;
}

const EMBED_RE = /^\{\{(youtube|instagram|image|video):([^|{}]+)(?:\|([^|{}]*))?(?:\|([^|{}]*))?\}\}\s*$/gm;

export function renderMarkdown(md: string): RenderedMarkdown {
  let hasInstagramEmbed = false;
  let hasYoutubeEmbed = false;

  // 1) 숏코드를 플레이스홀더로 치환 (마크다운 파서·이스케이프를 우회해 원 위치에 삽입)
  const embeds: string[] = [];
  const withPlaceholders = md.replace(EMBED_RE, (_m, kind: string, ref: string, creator?: string, url?: string) => {
    const creatorName = creator?.trim();
    const originalUrl = url?.trim();
    let html: string;
    if (kind === "image" || kind === "video") {
      // 직접 올린 미디어 — 두 번째 인자는 alt(이미지)/캡션(영상), 세 번째는 이미지 캡션
      const key = ref.trim();
      if (!isValidObjectKey(key)) {
        html = invalidEmbedHtml("유효하지 않은 오브젝트 키");
      } else if (kind === "image") {
        html = imageHtml(key, creatorName ?? "", originalUrl || undefined);
      } else {
        html = videoHtml(key, creatorName || undefined);
      }
    } else if (!creatorName || !originalUrl) {
      html = invalidEmbedHtml("창작자명 또는 원본 링크 누락 — 출처 표기 없이는 게시할 수 없습니다 (운영 규칙 3-4)");
    } else if (kind === "youtube") {
      const id = ref.trim();
      html = YOUTUBE_ID_RE.test(id) ? youtubeEmbedHtml(id, creatorName, originalUrl) : invalidEmbedHtml("유효하지 않은 YouTube ID");
      if (YOUTUBE_ID_RE.test(id)) hasYoutubeEmbed = true;
    } else {
      const postUrl = ref.trim();
      const ok = /^https:\/\/(www\.)?instagram\.com\//.test(postUrl);
      html = ok ? instagramEmbedHtml(postUrl, creatorName, originalUrl) : invalidEmbedHtml("유효하지 않은 Instagram URL");
      if (ok) hasInstagramEmbed = true;
    }
    const idx = embeds.push(html) - 1;
    return `\n\n<!--EMBED:${idx}-->\n\n`;
  });

  // 2) 마크다운 → HTML (원문 HTML 은 이스케이프, 링크 rel 처리, 헤딩 id)
  let hasAffiliateLinks = false;
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      html(token) {
        // 플레이스홀더 주석만 통과, 그 외 원문 HTML 은 텍스트로 강등
        if (/^<!--EMBED:\d+-->$/.test(token.raw.trim())) return token.raw;
        return escapeHtml(token.raw);
      },
      heading(token) {
        const text = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${headingId(token.text)}">${text}</h${token.depth}>\n`;
      },
      link(token) {
        const text = this.parser.parseInline(token.tokens);
        const href = token.href;
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        if (!isExternalUrl(href)) {
          return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
        }
        const affiliate = isAffiliateUrl(href);
        if (affiliate) hasAffiliateLinks = true;
        const rel = affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer";
        return `<a href="${escapeHtml(href)}"${title} target="_blank" rel="${rel}">${text}</a>`;
      },
    },
  });

  let html = marked.parse(withPlaceholders, { async: false }) as string;

  // 3) 플레이스홀더 → 임베드 HTML
  html = html.replace(/<!--EMBED:(\d+)-->/g, (_m, i: string) => embeds[Number(i)] ?? "");

  return { html, hasAffiliateLinks, hasInstagramEmbed, hasYoutubeEmbed };
}
