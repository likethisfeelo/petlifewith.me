// 뉴스 우측 이미지 배너 — site_settings(key = news_banners) 에 2칸.
// PC 는 오른쪽 세로형(1:2), 모바일은 목록 아래 가로형(3:1). 한쪽 이미지만 있으면 둘 다 그 이미지를 쓴다.
// 업체 광고면 "광고" 표기를 붙인다 (표시광고법 — claude.md 광고 규칙).
import { isValidObjectKey } from "./assets";
import { isSafeHttpUrl } from "./links";

export const NEWS_BANNERS_KEY = "news_banners";
export const NEWS_BANNER_SLOTS = 2;

export interface NewsBanner {
  active: boolean;
  /** PC 세로형 이미지 (권장 600×1200) */
  pcImageKey: string | null;
  /** 모바일 가로형 이미지 (권장 1200×400) */
  mobileImageKey: string | null;
  /** 누르면 갈 곳 — 사이트 안 경로(/...) 또는 http(s) 주소. 비우면 링크 없음 */
  href: string | null;
  alt: string;
  /** 광고·협찬 — 배너에 "광고" 표기, 외부 링크에 rel=sponsored */
  sponsored: boolean;
}

export const EMPTY_NEWS_BANNER: NewsBanner = { active: false, pcImageKey: null, mobileImageKey: null, href: null, alt: "", sponsored: false };

export function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function normalizeOne(raw: unknown): NewsBanner {
  if (!raw || typeof raw !== "object") return { ...EMPTY_NEWS_BANNER };
  const r = raw as Record<string, unknown>;
  const key = (v: unknown) => (typeof v === "string" && v && isValidObjectKey(v) ? v : null);
  const hrefRaw = typeof r.href === "string" ? r.href.trim() : "";
  const href = hrefRaw && (isInternalPath(hrefRaw) || isSafeHttpUrl(hrefRaw)) ? hrefRaw : null;
  return {
    active: r.active === true,
    pcImageKey: key(r.pcImageKey),
    mobileImageKey: key(r.mobileImageKey),
    href,
    alt: typeof r.alt === "string" ? r.alt.trim().slice(0, 100) : "",
    sponsored: r.sponsored === true,
  };
}

/** 항상 NEWS_BANNER_SLOTS 칸으로 맞춘다 */
export function normalizeNewsBanners(raw: unknown): NewsBanner[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: NEWS_BANNER_SLOTS }, (_, i) => normalizeOne(list[i]));
}

/** 공개 화면에 보일 배너 — 켜져 있고 이미지가 하나라도 있는 것 */
export function visibleNewsBanners(banners: NewsBanner[]): NewsBanner[] {
  return banners.filter((b) => b.active && (b.pcImageKey || b.mobileImageKey));
}
