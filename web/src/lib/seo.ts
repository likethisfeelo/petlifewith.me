// ============================================================
// SEO — noindex 게이트(코드로 강제, claude.md 5-3), canonical, JSON-LD
// ============================================================
import type { Metadata } from "next";
import { defaultOgImageUrl, isProductionSite, siteName, siteUrl } from "./config";

// ---------- 얇은 콘텐츠 방지 게이트 ----------

/** 스팟 3개 미만 지역 페이지 → noindex */
export const MIN_SPOTS_FOR_INDEX = 3;
/** 정보 3항목 미만 개별 장소 → noindex */
export const MIN_PLACE_INFO_ITEMS = 3;

export function shouldIndexRegionPage(spotCount: number): boolean {
  return spotCount >= MIN_SPOTS_FOR_INDEX;
}

export interface PlaceInfoFields {
  addressRoad: string | null;
  phone: string | null;
  descriptionMd: string | null;
  hoursText: string | null;
  priceText: string | null;
  parkingText: string | null;
}

/**
 * 개별 장소가 가진 "정보 항목" 수 — noindex 게이트 판정 기준.
 * 외부 링크(홈페이지·카카오톡·예약 등)도 하나씩 정보 항목으로 센다.
 */
export function placeInfoItemCount(spot: PlaceInfoFields, linkCount = 0): number {
  const fields = [
    spot.addressRoad,
    spot.phone,
    spot.descriptionMd,
    spot.hoursText,
    spot.priceText,
    spot.parkingText,
  ];
  const filled = fields.filter((f) => typeof f === "string" && f.trim().length > 0).length;
  return filled + Math.max(0, linkCount);
}

export function shouldIndexPlace(
  spot: PlaceInfoFields & { status: string; source: string },
  linkCount = 0,
): boolean {
  if (spot.source === "sample") return false; // 개발 픽스처는 절대 색인하지 않는다
  if (spot.status !== "operating") return false;
  return placeInfoItemCount(spot, linkCount) >= MIN_PLACE_INFO_ITEMS;
}

// ---------- 메타데이터 헬퍼 ----------

/**
 * robots 메타. 프로덕션 URL 이 설정되지 않은 환경(로컬·프리뷰)에서는
 * 무조건 noindex — 실수로 색인되는 사고를 막는다.
 */
export function robotsMeta(indexable: boolean): Metadata["robots"] {
  if (!isProductionSite()) return { index: false, follow: false };
  return indexable ? { index: true, follow: true } : { index: false, follow: true };
}

export function canonicalUrl(path: string): string {
  return `${siteUrl().replace(/\/$/, "")}${path}`;
}

export function pageTitle(title?: string): string {
  return title ? `${title} | ${siteName()}` : siteName();
}

// ---------- 페이지 메타 빌더 ----------
// 모든 공개 페이지가 이 헬퍼로 title/description/canonical/robots +
// Open Graph + Twitter 카드를 한 번에 만든다. 페이지별 오버라이드(seo_title 등)는
// 호출부에서 우선 적용해 넘긴다. 이미지가 없으면 사이트 기본 OG 이미지로 폴백.

export interface PageMetaInput {
  /** 순수 제목 — "| 사이트명" 은 레이아웃 템플릿이 붙인다 */
  title: string;
  description?: string | null;
  path: string;
  indexable: boolean;
  /** 완성 URL (assetUrl 로 조립해 넘길 것). 없으면 기본 OG 이미지 폴백 */
  ogImageUrl?: string | null;
  type?: "website" | "article";
  publishedAt?: Date | null;
  modifiedAt?: Date | null;
}

export function buildMeta(input: PageMetaInput): Metadata {
  const description = input.description?.trim() || undefined;
  const url = canonicalUrl(input.path);
  const imageUrl = input.ogImageUrl ?? defaultOgImageUrl();
  const images = imageUrl ? [{ url: imageUrl }] : undefined;

  const common = {
    title: input.title,
    description,
    url,
    siteName: siteName(),
    locale: "ko_KR",
    ...(images ? { images } : {}),
  };
  const openGraph: Metadata["openGraph"] =
    (input.type ?? "website") === "article"
      ? {
          ...common,
          type: "article",
          ...(input.publishedAt ? { publishedTime: input.publishedAt.toISOString() } : {}),
          ...(input.modifiedAt ? { modifiedTime: input.modifiedAt.toISOString() } : {}),
        }
      : { ...common, type: "website" };

  return {
    title: input.title,
    description,
    alternates: { canonical: url },
    robots: robotsMeta(input.indexable),
    openGraph,
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: input.title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

// ---------- JSON-LD ----------
// 스키마: Article / LocalBusiness / ItemList / BreadcrumbList (+ WebSite)

type JsonLd = Record<string, unknown>;

export function websiteLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName(),
    url: siteUrl(),
    inLanguage: "ko",
  };
}

export function articleLd(opts: {
  title: string;
  description?: string | null;
  path: string;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  reviewedByVet?: string | null;
  imageUrl?: string | null;
}): JsonLd {
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    inLanguage: "ko",
    mainEntityOfPage: canonicalUrl(opts.path),
    publisher: { "@type": "Organization", name: siteName() },
  };
  if (opts.description) ld.description = opts.description;
  if (opts.imageUrl) ld.image = [opts.imageUrl];
  if (opts.publishedAt) ld.datePublished = opts.publishedAt.toISOString();
  if (opts.updatedAt) ld.dateModified = opts.updatedAt.toISOString();
  // 감수 표기는 사실일 때만 넣는다
  if (opts.reviewedByVet) {
    ld.reviewedBy = { "@type": "Person", name: opts.reviewedByVet, jobTitle: "수의사" };
  }
  return ld;
}

export function localBusinessLd(opts: {
  name: string;
  path: string;
  addressRegion: string; // 시도
  addressLocality: string; // 시군구
  streetAddress?: string | null;
  telephone?: string | null;
}): JsonLd {
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: opts.name,
    url: canonicalUrl(opts.path),
    address: {
      "@type": "PostalAddress",
      addressCountry: "KR",
      addressRegion: opts.addressRegion,
      addressLocality: opts.addressLocality,
      ...(opts.streetAddress ? { streetAddress: opts.streetAddress } : {}),
    },
  };
  if (opts.telephone) ld.telephone = opts.telephone;
  return ld;
}

export function itemListLd(opts: { name: string; items: Array<{ name: string; path: string }> }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    itemListElement: opts.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: canonicalUrl(it.path),
    })),
  };
}

export function breadcrumbLd(crumbs: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: canonicalUrl(c.path),
    })),
  };
}
