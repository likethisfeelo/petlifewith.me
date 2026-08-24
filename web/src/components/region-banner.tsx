"use client";

// 위치 감지는 UX 레이어에만 둔다 (claude.md 5-1).
// - 강제 리다이렉트 없음. 배너 제안만.
// - 크롤러에는 아무 분기도 없다: 이 컴포넌트는 클라이언트에서만 동작하고
//   서버 렌더 결과(HTML·색인 대상)는 위치와 무관하게 동일하다.
// - 현재 구현은 "최근 본 지역" 기억. IP 기반 제안은 이후 CloudFront 헤더로
//   같은 UX 레이어에 붙인다.
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "recent-region";

export interface RecentRegion {
  sidoSlug: string;
  sigunguSlug: string;
  label: string;
}

export function rememberRegion(region: RecentRegion) {
  try {
    localStorage.setItem(KEY, JSON.stringify(region));
  } catch {
    // 저장 불가 환경(시크릿 모드 등)은 조용히 무시
  }
}

/** 지역 페이지 방문을 기억해두는 훅 컴포넌트 — 지역 페이지에 삽입 */
export function RememberRegion({ region }: { region: RecentRegion }) {
  useEffect(() => {
    rememberRegion(region);
  }, [region]);
  return null;
}

/** /spot 진입점에서 최근 본 지역으로 가는 제안 배너 */
export function RegionSuggestBanner() {
  const [recent, setRecent] = useState<RecentRegion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRecent(JSON.parse(raw) as RecentRegion);
    } catch {
      // 파싱 실패 시 무시
    }
  }, []);

  if (!recent || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sea/20 bg-sea-soft px-4 py-3 text-sm text-sea">
      <p>
        최근 본 지역: <span className="font-semibold">{recent.label}</span> — 이어서 볼까요?
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/spot/${recent.sidoSlug}/${recent.sigunguSlug}`}
          className="rounded-full bg-sea px-3 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          바로 가기
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full px-2 py-1 text-xs text-sea/70 hover:bg-sea/10"
          aria-label="배너 닫기"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
