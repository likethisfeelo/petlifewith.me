// 섹션별 사이트맵 — noindex 게이트를 통과한 URL 만 내보낸다 (lib/queries/sitemap.ts)
import { notFound } from "next/navigation";
import { siteUrl } from "@/lib/config";
import {
  sitemapCurations,
  sitemapGuides,
  sitemapItems,
  sitemapMakers,
  sitemapPlaces,
  sitemapRegions,
  sitemapTopics,
  type SitemapEntry,
} from "@/lib/queries/sitemap";

export const revalidate = 3600; // REVALIDATE.sitemap

export function generateStaticParams() {
  return [];
}

async function entriesFor(section: string): Promise<SitemapEntry[] | null> {
  switch (section) {
    case "core": {
      const topics = await sitemapTopics();
      return [{ path: "/" }, { path: "/maker" }, { path: "/curation" }, ...topics];
    }
    case "guides":
      return sitemapGuides();
    case "spots":
      return sitemapRegions();
    case "places":
      return sitemapPlaces();
    case "makers":
      return sitemapMakers();
    case "items":
      return sitemapItems();
    case "curations":
      return sitemapCurations();
    default:
      return null;
  }
}

function xmlEscape(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function GET(_req: Request, ctx: { params: Promise<{ section: string }> }) {
  const { section } = await ctx.params;
  if (!section.endsWith(".xml")) notFound();
  const entries = await entriesFor(section.slice(0, -4));
  if (!entries) notFound();

  const base = siteUrl().replace(/\/$/, "");
  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map((e) => {
      const lastmod = e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "";
      return `<url><loc>${xmlEscape(base + e.path)}</loc>${lastmod}</url>`;
    }),
    `</urlset>`,
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
