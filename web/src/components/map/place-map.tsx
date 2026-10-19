"use client";

// 장소 하나 지도 — 링크 페이지·미리보기·장소 페이지의 "위치".
// 순서: 위경도(인허가 좌표 변환) → 없으면 주소로 카카오 지오코딩 → 키가 없거나 실패하면 "지도에서 보기" 링크만.
import { useEffect, useRef, useState } from "react";
import { externalMapUrl, kakaoMapKey } from "@/lib/map";
import { loadKakaoMaps } from "./kakao-sdk";

export function PlaceMap({
  name,
  lat,
  lng,
  address,
  height = 180,
  dark = false,
  preferAddress = false,
}: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  height?: number;
  dark?: boolean;
  /** 사장님이 확인한 주소가 있으면 주소 검색을 먼저 (인허가 좌표보다 정확) */
  preferAddress?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "fallback">(kakaoMapKey() ? "idle" : "fallback");

  useEffect(() => {
    if (!kakaoMapKey() || !ref.current) return;
    let alive = true;
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !ref.current) return;
        const draw = (la: number, ln: number) => {
          if (!alive || !ref.current) return;
          const pos = new kakao.maps.LatLng(la, ln);
          const map = new kakao.maps.Map(ref.current, { center: pos, level: 4 });
          new kakao.maps.Marker({ map, position: pos, title: name });
          map.setZoomable(false);
          setState("ready");
        };
        const byCoords = () => (lat != null && lng != null ? (draw(lat, lng), true) : false);
        if ((preferAddress || lat == null || lng == null) && address) {
          new kakao.maps.services.Geocoder().addressSearch(address, (res: Array<{ x: string; y: string }>, status: string) => {
            if (status === kakao.maps.services.Status.OK && res[0]) draw(Number(res[0].y), Number(res[0].x));
            else if (!byCoords()) setState("fallback");
          });
        } else if (!byCoords()) setState("fallback");
      })
      .catch(() => alive && setState("fallback"));
    return () => {
      alive = false;
    };
  }, [name, lat, lng, address, preferAddress]);

  const link = externalMapUrl({ name, lat, lng, address });
  return (
    <div>
      <div
        ref={ref}
        style={{ height }}
        className={`w-full overflow-hidden rounded-xl ${state === "fallback" ? "hidden" : ""} ${dark ? "bg-white/10" : "bg-sand"}`}
        aria-label={`${name} 위치 지도`}
        role="img"
      />
      {state === "fallback" && (
        <div style={{ height: Math.min(height, 120) }} className={`flex flex-col items-center justify-center gap-2 rounded-xl text-sm ${dark ? "bg-white/10 text-white/70" : "bg-sand text-ink-soft"}`}>
          <span>{address || "주소 정보가 없습니다"}</span>
        </div>
      )}
      <a href={link} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-block text-xs font-medium hover:underline ${dark ? "text-white/80" : "text-sea"}`}>
        카카오맵에서 크게 보기 ↗
      </a>
    </div>
  );
}
