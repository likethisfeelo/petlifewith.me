"use client";

// Google Tag Manager / GA4 로더.
// - production 에서만 마운트된다 (app/layout.tsx 가 env 로 판단)
// - 관리자 화면은 제외한다. admin.<apex> 는 브라우저 경로가 "/" 라서 호스트도 본다
//   (lib/analytics.ts). 판정 전에는 아무것도 렌더하지 않는다.
// - GA4 는 GTM 컨테이너 안에서 태그로 설정한다. gaId 직접 로드는 GTM 을 끈 경우의 폴백.
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAnalyticsExcluded } from "@/lib/analytics";

interface Props {
  gtmId?: string;
  gaId?: string;
  apexDomain: string;
}

export function Analytics({ gtmId, gaId, apexDomain }: Props) {
  const pathname = usePathname();
  // 호스트는 클라이언트에서만 안다. 서버에서 headers() 를 읽으면 전 페이지가
  // 동적 렌더로 바뀌어 ISR 이 깨지므로 마운트 후에 판정한다.
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(window.location.host), []);

  if (!host || isAnalyticsExcluded(pathname, host, apexDomain)) return null;

  if (gtmId) {
    return (
      <Script id="gtm-loader" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
    );
  }

  if (gaId) {
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
        <Script id="ga-loader" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${gaId}');`}
        </Script>
      </>
    );
  }

  return null;
}

/** JS 미사용 방문자용 GTM 폴백 — body 최상단에 둔다 (Google 설치 안내 2번). */
export function GtmNoScript({ gtmId }: { gtmId: string }) {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
