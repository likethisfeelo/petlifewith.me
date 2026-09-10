"use client";

// 업체·브랜드 "연락하기" 줄 — 등록된 외부 채널(홈페이지·카카오톡·인스타그램·예약 …)을 버튼으로. 예약·문의는 업체 채널에서 한다.
// 로그인 회원이 누르면 연락 기록을 남겨 /me/requests 에서 다시 찾을 수 있다 (실패해도 이동은 그대로).
import { logContactAction } from "@/app/reaction-actions";

export interface ContactLink {
  kind: string;
  url: string;
  label: string;
}

const KAKAO = "bg-[#fae100] text-[#3c1e1e] hover:bg-[#f2d900]";

export function ContactRow({ links, spotId, makerId, compact = false }: { links: ContactLink[]; spotId?: number; makerId?: number; compact?: boolean }) {
  if (links.length === 0) return null;
  const pad = compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={`${l.kind}-${l.url}`}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => {
            void logContactAction({ spotId, makerId, channel: l.kind }).catch(() => {});
          }}
          className={`rounded-full font-semibold transition-colors ${pad} ${l.kind === "kakao" ? KAKAO : "border border-line bg-surface text-ink hover:bg-sand"}`}
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
