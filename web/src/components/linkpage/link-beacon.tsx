"use client";

// 링크 페이지 비콘 — 조회 1회(탭당), data-link-click 이 붙은 채널·상담 버튼 클릭
import { useEffect } from "react";

function send(spotId: number, kind: "view" | "click") {
  const body = JSON.stringify({ spotId, kind });
  try {
    if (navigator.sendBeacon?.("/api/l/stat", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // 아래 fetch 로
  }
  fetch("/api/l/stat", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

export function LinkBeacon({ spotId }: { spotId: number }) {
  useEffect(() => {
    const key = `lp-view-${spotId}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // 저장소를 못 쓰면 매번 센다
    }
    if (!seen) send(spotId, "view");
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("[data-link-click]");
      if (a) send(spotId, "click");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [spotId]);
  return null;
}
