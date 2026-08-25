// 사이트맵 인덱스 — 섹션별 분할 (기획서 D13)
import { siteUrl } from "@/lib/config";

export const revalidate = 3600; // REVALIDATE.sitemap

const SECTIONS = ["core", "guides", "spots", "places", "makers", "items", "curations"] as const;

export async function GET() {
  const base = siteUrl().replace(/\/$/, "");
  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...SECTIONS.map((s) => `<sitemap><loc>${base}/sitemaps/${s}.xml</loc></sitemap>`),
    `</sitemapindex>`,
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
