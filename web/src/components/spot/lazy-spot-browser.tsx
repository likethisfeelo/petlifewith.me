"use client";

// 시도 전체 지도·목록 — 페이지가 뜬 뒤 /api/spots/browse 에서 불러와 SpotBrowser 로 그린다 (수천 곳을 HTML 에 싣지 않으려고)
import { useEffect, useState, type ComponentProps } from "react";
import { unpackSpots, type BrowserSpot, type PackedSpots } from "@/lib/spot-browser";
import { SpotBrowser } from "./spot-browser";

export function LazySpotBrowser({ sidoSlug, ...rest }: { sidoSlug: string } & Omit<ComponentProps<typeof SpotBrowser>, "items">) {
  const [items, setItems] = useState<BrowserSpot[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/spots/browse?sido=${encodeURIComponent(sidoSlug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((p: PackedSpots) => alive && setItems(unpackSpots(p)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [sidoSlug]);
  if (failed) return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">목록을 불러오지 못했습니다. 위 지역·유형을 눌러 들어가 보세요.</p>;
  if (!items)
    return (
      <div className="grid gap-3 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]" aria-busy="true">
        <div className="h-[60vh] animate-pulse rounded-2xl bg-sand/70" />
        <div className="hidden h-[60vh] animate-pulse rounded-2xl bg-sand/50 md:block" />
      </div>
    );
  return <SpotBrowser items={items} {...rest} />;
}
