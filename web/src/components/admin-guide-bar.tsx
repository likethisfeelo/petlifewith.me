"use client";

// 글 페이지의 관리자 버튼 줄 — 관리자 세션이 있을 때만 보인다 (마운트 후 /api/me 로 판단해 ISR 유지).
// 편집(관리자 편집기) · 보관 · 반려(회원 글만) · 삭제. 처리 규칙은 app/admin/guide-moderation-actions.ts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { moderateGuideAction, type GuideModerationOp } from "@/app/admin/guide-moderation-actions";

const CONFIRM: Record<GuideModerationOp, string> = {
  archive: "이 글을 보관할까요? 공개 페이지에서 내려가고, 관리자 게시글에서 다시 발행할 수 있습니다.",
  reject: "이 회원 글을 반려할까요? 공개에서 내려가고, 작성자는 내 글에서 '반려됨'으로 보고 고쳐 다시 올릴 수 있습니다.",
  delete: "이 글을 삭제할까요? 댓글·좋아요·태그 연결까지 함께 지워지고 되돌릴 수 없습니다.",
};

const btn = "rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50";

export function AdminGuideBar({ guideId, isMemberPost }: { guideId: number; isMemberPost: boolean }) {
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ admin?: boolean }>) : { admin: false }))
      .then((d) => alive && setAdmin(Boolean(d.admin)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!admin) return null;

  const run = (op: GuideModerationOp) => {
    if (!window.confirm(CONFIRM[op])) return;
    setError(null);
    startTransition(async () => {
      const res = await moderateGuideAction(guideId, op);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(res.redirectTo ?? "/");
      router.refresh();
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ink/30 bg-sand/60 px-3 py-2">
      <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">ADMIN</span>
      <span className="text-xs text-ink-soft">{isMemberPost ? "회원 글" : "운영진 글"} · 발행됨</span>
      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        <Link href={`/admin/guides/${guideId}`} className={`${btn} border-line bg-surface text-ink hover:bg-cream`}>
          편집
        </Link>
        <button type="button" disabled={pending} onClick={() => run("archive")} className={`${btn} border-line bg-surface text-ink hover:bg-cream`}>
          보관
        </button>
        {isMemberPost && (
          <button type="button" disabled={pending} onClick={() => run("reject")} className={`${btn} border-honey/40 bg-honey-soft text-honey hover:opacity-90`}>
            반려
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => run("delete")} className={`${btn} border-accent/30 bg-accent-soft text-accent-deep hover:opacity-90`}>
          삭제
        </button>
      </span>
      {error && <p className="w-full text-xs text-accent-deep">{error}</p>}
    </div>
  );
}
