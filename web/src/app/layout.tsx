import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { JsonLd } from "@/components/jsonld";
import { defaultOgImageUrl, siteName, siteUrl } from "@/lib/config";
import { robotsMeta, websiteLd } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${siteName()} — 반려동물의 즐거움을 다루는 미디어`,
      template: `%s | ${siteName()}`,
    },
    description:
      "어디에 데려갈 수 있는지가 아니라 무엇이 즐거운지를 다룹니다. 노견의 하루, 놀이, 케어 콘텐츠와 스팟·메이커 디렉토리.",
    // 기본값: 색인 허용. 단 프로덕션 URL 미설정(로컬·프리뷰)이면 전면 noindex 가드가 걸린다.
    // 개별 페이지의 게이트(robotsMeta)가 이 기본값을 덮어쓴다.
    robots: robotsMeta(true),
    openGraph: {
      siteName: siteName(),
      locale: "ko_KR",
      type: "website",
      ...(defaultOgImageUrl() ? { images: [{ url: defaultOgImageUrl()! }] } : {}),
    },
    twitter: { card: defaultOgImageUrl() ? "summary_large_image" : "summary" },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <JsonLd data={websiteLd()} />
      </body>
    </html>
  );
}
