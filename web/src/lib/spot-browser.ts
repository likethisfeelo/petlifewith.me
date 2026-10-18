// ============================================================
// 스팟 목록 브라우저 — 서버 목록을 브라우저용 가벼운 항목으로 바꾸고, 필터·정렬한다 (순수 함수, 테스트 대상)
// 화면: components/spot/spot-browser.tsx (카드·목록·지도 보기 + 미리보기 창)
// ============================================================
import type { SpotTier } from "./spot-pages";

export interface BrowserSpot {
  id: number;
  name: string;
  href: string;
  typeName: string;
  typeSlug: string;
  regionLabel: string;
  address: string | null;
  status: string;
  hours: string | null;
  parking: string | null;
  price: string | null;
  tier: SpotTier;
  /** 광고 없는 유형(장묘·약국·B2B) — 등급 배지·광고 표시를 붙이지 않는다 */
  monetizable: boolean;
  heroUrl: string | null;
  lat: number | null;
  lng: number | null;
  /** 카카오톡·예약 링크가 있거나 사이트 예약 요청을 받는 곳 */
  booking: boolean;
  /** 사장님이 소유 확인한 곳 */
  claimed: boolean;
}

export interface BrowserFilters {
  open: boolean;
  hours: boolean;
  parking: boolean;
  booking: boolean;
  registered: boolean;
}

export type BrowserSort = "default" | "name";

export const EMPTY_FILTERS: BrowserFilters = { open: false, hours: false, parking: false, booking: false, registered: false };

export const FILTER_LABEL: Record<keyof BrowserFilters, string> = {
  open: "영업 중",
  hours: "운영시간 정보 있음",
  parking: "주차 정보 있음",
  booking: "예약·상담 가능",
  registered: "등록 업체만",
};

export function filterSpots(items: BrowserSpot[], f: BrowserFilters, sort: BrowserSort = "default"): BrowserSpot[] {
  const out = items.filter(
    (s) =>
      (!f.open || s.status === "operating") &&
      (!f.hours || !!s.hours) &&
      (!f.parking || !!s.parking) &&
      (!f.booking || s.booking) &&
      (!f.registered || s.tier !== "unlisted"),
  );
  // 기본 순서는 서버 순서(상단 노출 → 프리미엄 → 등록 → 미등록, 같은 등급은 가나다)를 그대로 쓴다
  return sort === "name" ? [...out].sort((a, b) => a.name.localeCompare(b.name, "ko")) : out;
}

export function countActiveFilters(f: BrowserFilters): number {
  return Object.values(f).filter(Boolean).length;
}

/** 지도 범위 안의 항목만 ("이 지역 다시 검색") */
export function withinBounds(items: BrowserSpot[], b: { south: number; west: number; north: number; east: number } | null): BrowserSpot[] {
  if (!b) return items;
  return items.filter((s) => s.lat != null && s.lng != null && s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east);
}

export type BrowserView = "card" | "list" | "map";

export function parseView(v: string | null | undefined): BrowserView | null {
  return v === "card" || v === "list" || v === "map" ? v : null;
}

/** /place/123-slug → 123 */
export function placeIdFromPath(pathname: string): number | null {
  const m = /^\/place\/(\d+)(?:-|$)/.exec(pathname);
  return m ? Number(m[1]) : null;
}

/** 처음 화면 맞출 핀 — 가운데(중앙값)에서 40km 넘게 떨어진 튀는 좌표는 빼고 맞춘다 (전부 빠지면 전체) */
export function fitPins<T extends { lat: number; lng: number }>(pins: T[]): T[] {
  if (pins.length < 3) return pins;
  const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const lat = mid(pins.map((p) => p.lat));
  const lng = mid(pins.map((p) => p.lng));
  const km = (p: T) => Math.hypot((p.lat - lat) * 111, (p.lng - lng) * 88);
  const near = pins.filter((p) => km(p) <= 40);
  return near.length ? near : pins;
}
