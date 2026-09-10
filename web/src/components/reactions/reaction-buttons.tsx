"use client";

// 저장·좋아요 버튼 — 공개 페이지는 ISR 이라 서버 렌더에서 회원을 모른다. 마운트 뒤 내 상태를 RPC 로 받고, 누르면 토글한다.
// 비회원이 누르면 로그인으로 보낸다(돌아올 경로 포함). 좋아요 수는 게시글에만 보인다.
import { useEffect, useState, useTransition } from "react";
import { getReactionStateAction, toggleReactionAction } from "@/app/reaction-actions";
import { reactionKey, type ReactionKind, type ReactionTarget } from "@/lib/reactions";

export function ReactionButtons({
  target,
  id,
  kinds,
  nextPath,
  size = "md",
}: {
  target: ReactionTarget;
  id: number;
  /** 보여 줄 버튼 — 게시글은 ["like","save"], 나머지는 ["save"] */
  kinds: ReactionKind[];
  /** 로그인 뒤 돌아올 경로 */
  nextPath: string;
  size?: "sm" | "md";
}) {
  const key = reactionKey(target, id);
  const [mine, setMine] = useState<Partial<Record<ReactionKind, boolean>>>({});
  const [likes, setLikes] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getReactionStateAction([key])
      .then((s) => {
        if (!alive) return;
        setMine(s.mine[key] ?? {});
        setLikes(s.likes[key] ?? 0);
        setLoggedIn(s.loggedIn);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const click = (kind: ReactionKind) => {
    if (loggedIn === false) {
      window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
      return;
    }
    startTransition(async () => {
      const r = await toggleReactionAction(key, kind);
      if (!r.ok) {
        if (r.error === "login") window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
        return;
      }
      setMine((m) => ({ ...m, [kind]: r.active }));
      if (kind === "like") setLikes(r.likes);
    });
  };

  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {kinds.includes("like") && (
        <button
          type="button"
          onClick={() => click("like")}
          disabled={pending}
          aria-pressed={Boolean(mine.like)}
          className={`inline-flex items-center gap-1 rounded-full border font-medium transition-colors ${pad} ${mine.like ? "border-accent bg-accent-soft text-accent-deep" : "border-line bg-surface text-ink-soft hover:border-accent/50 hover:text-accent-deep"}`}
        >
          <span aria-hidden="true">{mine.like ? "♥" : "♡"}</span>
          좋아요{likes !== null && likes > 0 ? ` ${likes.toLocaleString("ko-KR")}` : ""}
        </button>
      )}
      {kinds.includes("save") && (
        <button
          type="button"
          onClick={() => click("save")}
          disabled={pending}
          aria-pressed={Boolean(mine.save)}
          className={`inline-flex items-center gap-1 rounded-full border font-medium transition-colors ${pad} ${mine.save ? "border-sea bg-sea-soft text-sea" : "border-line bg-surface text-ink-soft hover:border-sea/50 hover:text-sea"}`}
        >
          <span aria-hidden="true">{mine.save ? "★" : "☆"}</span>
          {mine.save ? "저장됨" : "저장"}
        </button>
      )}
    </span>
  );
}
