"use client";

// 영상 카드 — 놀이 클러스터 첫 화면(/topic/play)의 목록 카드. 섬네일이 보이고 마우스를 올리면 짧게 미리 재생되며,
// 누르면 글로 간다. (유튜브식)
//  - 업로드 영상: 포스터 위에서 <video muted> 를 재생한다. 포스터가 없으면 브라우저 첫 프레임.
//  - 유튜브: 공식 섬네일(i.ytimg.com) → 호버 시 음소거 자동재생 공식 임베드(youtube-nocookie)로 바꾼다. iframe 은 클릭을 먹지 않는다.
//  - 인스타그램: 임베드를 미리 돌릴 수 없어 섬네일(대표·본문 사진)만 + 배지.
//  - 영상이 없는 글: 사진 카드 (호버 없음). 아무것도 없으면 발자국 자리표시.
// 터치 기기(hover 불가)에서는 호버 없이 탭 → 글.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface CardMediaProps {
  kind: "video" | "youtube" | "instagram" | "image" | "none";
  /** 업로드 영상 URL (kind=video) */
  videoSrc?: string | null;
  /** 유튜브 ID (kind=youtube) */
  youtubeId?: string | null;
  /** 섬네일 URL (포스터·대표 이미지·유튜브 섬네일) */
  thumbSrc?: string | null;
}

const HOVER_DELAY_MS = 300;

function PawPlaceholder() {
  return (
    <span className="flex h-full w-full items-center justify-center text-ink-faint/40" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-10 w-10 fill-current">
        <circle cx="14" cy="16" r="5" />
        <circle cx="24" cy="12" r="5" />
        <circle cx="34" cy="16" r="5" />
        <circle cx="10" cy="27" r="4" />
        <circle cx="38" cy="27" r="4" />
        <path d="M24 22c-7 0-13 6-13 12 0 4 3 6 6 6 3 0 5-2 7-2s4 2 7 2c3 0 6-2 6-6 0-6-6-12-13-12z" />
      </svg>
    </span>
  );
}

export function MediaCard({
  href,
  title,
  summary,
  authorName,
  dateLabel,
  badge,
  media,
}: {
  href: string;
  title: string;
  summary: string | null;
  authorName: string | null;
  /** 서버가 만든 날짜 문자열 (하이드레이션 안전) */
  dateLabel: string;
  badge?: string | null;
  media: CardMediaProps;
}) {
  const [hover, setHover] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const timer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    } catch {
      setCanHover(false);
    }
  }, []);

  const previewable = canHover && (media.kind === "video" || media.kind === "youtube");
  const enter = () => {
    if (!previewable) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(true), HOVER_DELAY_MS);
  };
  const leave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHover(false);
  };
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hover) v.play().catch(() => {});
    else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        // 아직 메타데이터 전이면 무시
      }
    }
  }, [hover]);

  const kindBadge = media.kind === "video" || media.kind === "youtube" ? "▶ 영상" : media.kind === "instagram" ? "◎ Instagram" : null;

  return (
    <Link
      href={href}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-md ${badge ? "border-honey/40" : "border-line"}`}
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-sand">
        {media.thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbSrc} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : media.kind === "video" && media.videoSrc ? null : (
          <PawPlaceholder />
        )}
        {media.kind === "video" && media.videoSrc && (
          <video
            ref={videoRef}
            src={hover || !media.thumbSrc ? media.videoSrc : undefined}
            poster={media.thumbSrc ?? undefined}
            muted
            loop
            playsInline
            preload={media.thumbSrc ? "none" : "metadata"}
            aria-hidden="true"
            tabIndex={-1}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity ${hover || !media.thumbSrc ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {media.kind === "youtube" && media.youtubeId && hover && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.youtubeId)}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1&loop=1&playlist=${encodeURIComponent(media.youtubeId)}`}
            title=""
            aria-hidden="true"
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
        {kindBadge && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-semibold text-cream backdrop-blur-sm">{kindBadge}</span>
        )}
        {badge && <span className="absolute right-2 top-2 rounded-full bg-honey px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="line-clamp-2 text-base font-bold leading-snug text-ink group-hover:underline">{title}</span>
        {summary && <span className="mt-1 line-clamp-2 text-sm text-ink-soft">{summary}</span>}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 pt-3 text-xs text-ink-faint">
          {authorName ? <span className="rounded-full bg-honey-soft px-2 py-0.5 font-medium text-honey">{authorName}</span> : <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">운영진</span>}
          <span>{dateLabel}</span>
        </span>
      </span>
    </Link>
  );
}
