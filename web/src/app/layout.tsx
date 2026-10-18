import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TopicTaglineProvider } from "@/components/site-tagline";
import { JsonLd } from "@/components/jsonld";
import { AdSense, Analytics, GtmNoScript } from "@/components/analytics";
import { Tracker } from "@/components/tracker";
import { OnboardingModal } from "@/components/onboarding-modal";
import {
  adsenseClientId,
  apexDomain,
  defaultOgImageUrl,
  gaMeasurementId,
  googleSiteVerification,
  gtmContainerId,
  isProductionSite,
  siteName,
  siteUrl,
} from "@/lib/config";
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
    // Google Search Console 소유 확인 (공개 토큰)
    ...(googleSiteVerification() ? { verification: { google: googleSiteVerification()! } } : {}),
    // AdSense 사이트 소유 확인 메타 — 크롤러가 서버 HTML 에서 읽는다 (광고 스크립트는 클라이언트에서 뒤늦게 붙어 검출이 안 된다)
    ...(adsenseClientId() ? { other: { "google-adsense-account": adsenseClientId()! } } : {}),
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
  // 통계는 운영에서만 수집한다 — dev(preview)·로컬 트래픽이 섞이지 않게.
  const analytics = isProductionSite();
  const gtmId = analytics ? gtmContainerId() : undefined;
  const gaId = analytics ? gaMeasurementId() : undefined;
  // 광고도 운영에서만 — 승인되지 않은 dev 도메인에서 요청을 보내지 않는다
  const adsId = analytics ? adsenseClientId() : undefined;

  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col">
        {gtmId && <GtmNoScript gtmId={gtmId} />}
        {/* 태그라인 토픽 공유 — 글 페이지가 머리글·푸터에 토픽(놀이 → "즐거운 삶")을 알려 준다 */}
        <TopicTaglineProvider>
          {/* data-site-chrome — 업체 링크 페이지(/l)처럼 한 장짜리 화면은 CSS 로 머리글·푸터를 감춘다 (globals.css) */}
          <div data-site-chrome className="contents">
            <SiteHeader />
          </div>
          <main className="flex-1">{children}</main>
          <div data-site-chrome className="contents">
            <SiteFooter />
          </div>
        </TopicTaglineProvider>
        <JsonLd data={websiteLd()} />
        {/* 측정 이벤트(dataLayer) — GTM 이 없는 환경에서는 쌓이기만 하고 어디로도 가지 않는다 */}
        <Tracker />
        {/* 첫 로그인 닉네임 정하기 팝업 — 흐름 쿠키가 있을 때만 뜬다 */}
        <OnboardingModal />
        {analytics && <Analytics gtmId={gtmId} gaId={gaId} apexDomain={apexDomain()} />}
        {adsId && <AdSense clientId={adsId} apexDomain={apexDomain()} />}
      </body>
    </html>
  );
}
