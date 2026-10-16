"use client";

// 측정 — dataLayer 로 page_context·page_view·이벤트를 보낸다 (docs/측정기획_GA4_GTM.md 3장, 규약 lib/tracking.ts).
//  - 페이지: 주소가 바뀔 때마다 page_context(주소 + <TrackContext> 가 넘긴 개체 정보) → page_view.
//    GA4 의 "기록 기반 페이지 변경" 자동 측정은 꺼야 한다(중복). GTM 의 Google 태그는 send_page_view=false.
//  - 클릭: data-track="이벤트" 가 붙은 요소를 눌렀을 때 data-track-* 를 파라미터로 (서버 컴포넌트도 속성만 달면 된다).
//  - 노출: data-track-impression="promo_impression" 요소가 절반 이상 보이면 한 번.
//  - 서버 액션 결과(가입·요청 접수 등): 서버가 남긴 pl_evt 쿠키를 다음 페이지에서 읽어 보내고 지운다 (lib/client-events.ts).
// GTM 이 로드되지 않는 곳(로컬·dev·관리자)에서도 dataLayer 에 쌓기만 하고 아무 데도 보내지 않는다.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  EVENT_PARAM_KEYS,
  PAGE_CONTEXT_KEYS,
  cleanParams,
  isTrackEvent,
  pageContextForPath,
  paramsFromDataset,
  resetKeys,
  type PageContext,
  type TrackEvent,
  type TrackParams,
} from "@/lib/tracking";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    __plPageCtx?: { path: string; ctx: Partial<PageContext> };
  }
}

export const CLIENT_EVENT_COOKIE = "pl_evt";

function push(obj: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(obj);
}

/** 이벤트 하나 보내기 — 클라이언트 컴포넌트에서 직접 부를 때 */
export function track(event: TrackEvent, params: TrackParams = {}) {
  if (typeof window === "undefined") return;
  // 이벤트 전용 값은 매번 비우고 다시 쓴다 (페이지 문맥 값은 이벤트 쪽 값이 있을 때만 덮는다)
  push({ ...resetKeys(EVENT_PARAM_KEYS), event, ...cleanParams(params) });
}

function readClientEvents(): Array<{ e: string; p?: TrackParams }> {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CLIENT_EVENT_COOKIE}=`));
  if (!raw) return [];
  document.cookie = `${CLIENT_EVENT_COOKIE}=; path=/; max-age=0`;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CLIENT_EVENT_COOKIE.length + 1))) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<{ e: string; p?: TrackParams }>) : [];
  } catch {
    return [];
  }
}

export function Tracker() {
  const pathname = usePathname();

  // 페이지뷰 — 자식 페이지의 <TrackContext> effect 가 먼저 돌아 문맥을 남긴 뒤 실행된다
  useEffect(() => {
    const id = window.setTimeout(() => {
      const base = pageContextForPath(pathname);
      const extra = window.__plPageCtx?.path === pathname ? window.__plPageCtx.ctx : {};
      // 이전 페이지의 문맥 값(spot_type 등)이 남지 않게 전 키를 비우고 다시 쓴다
      push({ ...resetKeys(PAGE_CONTEXT_KEYS), ...resetKeys(EVENT_PARAM_KEYS), event: "page_context", ...cleanParams({ ...base, ...extra }) });
      push({ event: "page_view", page_location: window.location.href, page_path: pathname, page_title: document.title });
      for (const { e, p } of readClientEvents()) if (isTrackEvent(e)) track(e, p ?? {});
    }, 0); // 제목(document.title)이 새 페이지 것으로 바뀐 뒤
    return () => window.clearTimeout(id);
  }, [pathname]);

  // 클릭 위임 — data-track
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as Element | null)?.closest?.("[data-track]") as HTMLElement | null;
      const name = el?.dataset.track;
      if (!el || !name || !isTrackEvent(name)) return;
      track(name, { ...paramsFromDataset(el.dataset), page_type: pageContextForPath(window.location.pathname).page_type });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // 노출 — data-track-impression (페이지마다 다시 찾는다, 같은 요소는 한 번만)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          io.unobserve(entry.target);
          const el = entry.target as HTMLElement;
          const name = el.dataset.trackImpression;
          if (name && isTrackEvent(name)) track(name, paramsFromDataset(el.dataset));
        }
      },
      { threshold: 0.5 },
    );
    const id = window.setTimeout(() => document.querySelectorAll("[data-track-impression]").forEach((el) => io.observe(el)), 300);
    return () => {
      window.clearTimeout(id);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}

/** 상세 페이지가 개체 정보를 페이지 문맥에 더한다 — 렌더 결과 없음 */
export function TrackContext(ctx: Partial<PageContext>) {
  const pathname = usePathname();
  const key = JSON.stringify(ctx);
  useEffect(() => {
    window.__plPageCtx = { path: pathname, ctx: JSON.parse(key) as Partial<PageContext> };
  }, [pathname, key]);
  return null;
}
