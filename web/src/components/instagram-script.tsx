"use client";

// 인스타그램 공식 임베드 스크립트 — 공식 임베드 코드의 일부다 (기획서 3-2).
// blockquote.instagram-media 가 있는 페이지에서만 로드한다.
import Script from "next/script";

export function InstagramEmbedScript() {
  return <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />;
}
