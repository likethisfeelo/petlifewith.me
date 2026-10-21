"use client";

// 여러 장소 지도 — 스팟 목록의 지도 보기. 핀(이름표) + 묶음(클러스터), 카드에 마우스를 올리면 핀 강조,
// 핀을 누르면 onSelect, 지도를 움직이면 "이 지역 다시 검색" 버튼.
// 공급자: 카카오 (lib/map.ts). 키가 없으면 안내만 보이고 목록은 그대로 쓴다.
import { useEffect, useRef, useState } from "react";
import { kakaoMapKey } from "@/lib/map";
import { fitPins } from "@/lib/spot-browser";
import { loadKakaoMaps } from "./kakao-sdk";

export interface MapPin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** 강조 핀 (프리미엄·광고) */
  strong?: boolean;
  /** 대표 사진 (프리미엄) — 핀에 동그란 사진이 붙는다 */
  photo?: string | null;
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function MultiMap({
  pins,
  hoverId,
  selectedId,
  onSelect,
  onSearchArea,
  className = "",
  overlay,
}: {
  /** 지도 위 왼쪽 위에 띄울 것 (유형 칩) */
  overlay?: React.ReactNode;
  pins: MapPin[];
  hoverId: number | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSearchArea: (b: MapBounds) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const els = useRef(new Map<number, HTMLElement>());
  const fitting = useRef(false);
  const [moved, setMoved] = useState(false);
  const [failed, setFailed] = useState(!kakaoMapKey());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 지도 만들기 (한 번)
  useEffect(() => {
    if (!kakaoMapKey() || !box.current) return;
    let alive = true;
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive || !box.current) return;
        const map = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(37.5665, 126.978), level: 7 });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        mapRef.current = map;
        clusterRef.current = new kakao.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 6, disableClickZoom: false, gridSize: 70 });
        kakao.maps.event.addListener(map, "dragend", () => setMoved(true));
        kakao.maps.event.addListener(map, "zoom_changed", () => {
          if (!fitting.current) setMoved(true);
        });
        setPinsVersion((v) => v + 1);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // 지도 칸 크기가 바뀌면(미리보기 창이 밀고 들어올 때) 다시 그린다
  useEffect(() => {
    if (!box.current || typeof ResizeObserver === "undefined") return;
    let wasEmpty = true;
    const ro = new ResizeObserver((entries) => {
      mapRef.current?.relayout();
      const r = entries[0]?.contentRect;
      const empty = !r || r.width < 10 || r.height < 10;
      // 숨어 있다가(크기 0) 처음 보이면 핀에 맞춰 다시 확대
      if (wasEmpty && !empty) setPinsVersion((v) => v + 1);
      wasEmpty = empty;
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const [pinsVersion, setPinsVersion] = useState(0);

  // 핀 다시 그리기
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!kakao || !map || !cluster) return;
    cluster.clear();
    els.current.clear();
    const overlays = pins.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      const label = p.name.length > 12 ? `${p.name.slice(0, 12)}…` : p.name;
      if (p.photo) {
        const img = document.createElement("img");
        img.src = p.photo;
        img.alt = "";
        img.className = "map-pin-photo";
        el.append(img, document.createTextNode(label));
      } else el.textContent = label;
      el.className = `map-pin${p.strong ? " map-pin-strong" : ""}${p.photo ? " map-pin-with-photo" : ""}`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(p.id);
      });
      els.current.set(p.id, el);
      return new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 1.2, clickable: true });
    });
    cluster.addMarkers(overlays);
    if (pins.length > 0) {
      // 지도 칸 크기를 다시 잰 뒤에 맞춘다 (크기 0 일 때 맞추면 아주 멀리서 시작한다)
      map.relayout();
      const fit = fitPins(pins);
      fitting.current = true;
      if (fit.length === 1) map.setCenter(new kakao.maps.LatLng(fit[0]!.lat, fit[0]!.lng)), map.setLevel(4);
      else {
        const bounds = new kakao.maps.LatLngBounds();
        for (const p of fit) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
        map.setBounds(bounds, 60, 40, 40, 40);
      }
      setTimeout(() => (fitting.current = false), 300);
    }
    setMoved(false);
  }, [pins, pinsVersion]);

  // 강조 (마우스 올린 카드·선택한 곳)
  useEffect(() => {
    for (const [id, el] of els.current) {
      el.classList.toggle("map-pin-hover", id === hoverId);
      el.classList.toggle("map-pin-active", id === selectedId);
      el.style.zIndex = id === hoverId || id === selectedId ? "10" : "";
    }
    if (selectedId != null) {
      const p = pins.find((x) => x.id === selectedId);
      if (p && mapRef.current && window.kakao) mapRef.current.panTo(new window.kakao.maps.LatLng(p.lat, p.lng));
    }
  }, [hoverId, selectedId, pins]);

  function searchHere() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onSearchArea({ south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() });
    setMoved(false);
  }

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line bg-sand p-6 text-center text-sm text-ink-soft ${className}`}>
        <p className="font-semibold text-ink">지도를 불러오지 못했습니다</p>
        <p className="text-xs">카드·목록 보기로 둘러보세요. 각 업체 미리보기에서 카카오맵으로 열 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-sand ${className}`}>
      <div ref={box} className="absolute inset-0" />
      {overlay && <div className="absolute inset-x-3 top-3 z-20 pr-12">{overlay}</div>}
      {moved && (
        <button type="button" onClick={searchHere} className="absolute left-1/2 bottom-6 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-cream shadow-lg hover:opacity-90">
          ↻ 이 지역 다시 검색
        </button>
      )}
      {pins.length === 0 && (
        <p className="absolute inset-x-0 bottom-3 z-20 mx-auto w-fit rounded-full bg-surface/95 px-3 py-1.5 text-xs text-ink-soft shadow">지도에 표시할 위치 정보가 없습니다</p>
      )}
    </div>
  );
}
