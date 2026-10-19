"use client";

// 카카오 지도 SDK 를 한 번만 불러온다 (autoload=false → kakao.maps.load 로 준비 완료를 기다린다).
import { kakaoMapKey } from "@/lib/map";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

let loading: Promise<any> | null = null;

export function loadKakaoMaps(): Promise<any> {
  const key = kakaoMapKey();
  if (!key) return Promise.reject(new Error("no-key"));
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services,clusterer`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => {
      loading = null;
      reject(new Error("load-failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}
