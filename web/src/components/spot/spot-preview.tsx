"use client";

// 목록 미리보기 내용 — 카드 정보로 먼저 그리고, /api/spots/[id]/preview 로 채널·소개·사진을 채운다.
import { useEffect, useState } from "react";
import { PlaceMap } from "@/components/map/place-map";
import { TIER_LABEL } from "@/lib/spot-pages";
import type { BrowserSpot } from "@/lib/spot-browser";

interface PreviewData {
  id: number;
  name: string;
  href: string;
  typeName: string;
  regionLabel: string;
  status: string;
  operating: boolean;
  address: string | null;
  phone: string | null;
  hours: string | null;
  price: string | null;
  parking: string | null;
  intro: string | null;
  services: string[];
  tier: BrowserSpot["tier"];
  monetizable: boolean;
  heroUrl: string | null;
  images: string[];
  links: Array<{ id: number; kind: string; label: string; url: string }>;
  linkPageUrl: string | null;
  bookUrl: string | null;
  lat: number | null;
  lng: number | null;
  notice: string | null;
  dataReferenceDate: string | null;
}

const cache = new Map<number, PreviewData>();

export function SpotPreview({ item }: { item: BrowserSpot }) {
  const [data, setData] = useState<PreviewData | null>(cache.get(item.id) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const hit = cache.get(item.id);
    setData(hit ?? null);
    if (hit) return;
    let alive = true;
    fetch(`/api/spots/${item.id}/preview`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: PreviewData) => {
        cache.set(item.id, d);
        if (alive) setData(d);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [item.id]);

  const kakao = data?.links.find((l) => l.kind === "kakao");
  const rows: Array<[string, React.ReactNode]> = [];
  const address = data?.address ?? item.address;
  if (address) rows.push(["주소", address]);
  if (data?.phone)
    rows.push([
      "전화",
      <a key="tel" href={`tel:${data.phone}`} className="text-sea hover:underline">
        {data.phone}
      </a>,
    ]);
  if (data?.hours ?? item.hours) rows.push(["운영시간", data?.hours ?? item.hours]);
  if (data?.price ?? item.price) rows.push(["요금", data?.price ?? item.price]);
  if (data?.parking ?? item.parking) rows.push(["주차", data?.parking ?? item.parking]);
  const images = data?.images.length ? data.images : item.heroUrl ? [item.heroUrl] : [];

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className={`grid gap-1 overflow-hidden rounded-xl ${images.length > 1 ? "grid-cols-[2fr_1fr]" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt={`${item.name} 사진`} className="h-44 w-full bg-sand object-cover" />
          {images.length > 1 && (
            <div className="grid gap-1">
              {images.slice(1, 3).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-full min-h-0 w-full bg-sand object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{item.typeName}</span>
          <TierBadge tier={item.tier} monetizable={item.monetizable} />
          <span className="text-ink-faint">{item.regionLabel}</span>
        </div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">{item.name}</h2>
        <p className={`mt-0.5 text-xs font-medium ${item.status === "operating" ? "text-sage-deep" : "text-ink-faint"}`}>{data?.status ?? (item.status === "operating" ? "영업 중" : "확인 필요")}</p>
      </div>

      {data?.notice && <p className="rounded-lg border border-honey/40 bg-honey-soft px-3 py-2 text-xs leading-relaxed text-ink">{data.notice}</p>}

      {data?.intro && <p className="text-sm leading-relaxed text-ink-soft">{data.intro}</p>}

      {data && data.services.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {data.services.map((s) => (
            <li key={s} className="rounded-full bg-sand px-2.5 py-1 text-xs text-ink">
              {s}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[4.5rem_1fr] gap-2 px-3 py-2.5">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {data && data.links.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {data.links.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-2 py-2.5 text-center text-xs font-medium text-ink hover:bg-sand">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {kakao ? (
          <a href={kakao.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#FEE500] px-4 py-3 text-center text-sm font-bold text-[#191919]">
            카카오톡으로 상담하기
          </a>
        ) : data?.bookUrl ? (
          <a href={data.bookUrl} className="rounded-full bg-ink px-4 py-3 text-center text-sm font-bold text-cream hover:opacity-90">
            상담 / 예약 문의하기
          </a>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a href={item.href} className="rounded-full border border-line px-3 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand">
            자세히 보기
          </a>
          {data?.linkPageUrl ? (
            <a href={data.linkPageUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand">
              링크 페이지 ↗
            </a>
          ) : (
            <span />
          )}
        </div>
      </div>

      {(address || (item.lat != null && item.lng != null)) && (
        <PlaceMap name={item.name} lat={data?.lat ?? item.lat} lng={data?.lng ?? item.lng} address={address} height={170} preferAddress={item.claimed} />
      )}

      {failed && <p className="text-xs text-ink-faint">상세 정보를 불러오지 못했습니다. &quot;자세히 보기&quot;를 눌러 주세요.</p>}
      {data?.dataReferenceDate && <p className="text-[11px] text-ink-faint">데이터 기준일 {data.dataReferenceDate}</p>}
    </div>
  );
}

export function TierBadge({ tier, monetizable }: { tier: BrowserSpot["tier"]; monetizable: boolean }) {
  // 광고 없는 유형(장묘·약국·B2B)에는 등급 배지를 달지 않는다
  if (!monetizable) return null;
  const cls =
    tier === "promoted"
      ? "border border-honey/50 bg-honey-soft text-honey"
      : tier === "paid"
        ? "bg-ink text-cream"
        : tier === "free"
          ? "bg-sage-soft text-sage-deep"
          : "bg-sand text-ink-faint";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{TIER_LABEL[tier]}</span>;
}
