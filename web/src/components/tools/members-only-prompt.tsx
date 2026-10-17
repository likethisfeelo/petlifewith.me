"use client";

// 회원 전용 기능 안내 팝업 — 도구의 인쇄·파일 저장·안내판 저장 등을 손님이 누르면 띄운다.
// 가입·로그인 뒤 지금 페이지로 돌아온다 (?next=).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function MembersOnlyPrompt({ feature, onClose }: { feature: string; onClose: () => void }) {
  const pathname = usePathname() || "/";
  const next = encodeURIComponent(pathname);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 도구(iframe) 안을 누른 뒤에도 Esc 가 먹도록 포커스를 팝업으로 가져온다
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-only-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl bg-surface p-6 text-center shadow-2xl outline-none sm:rounded-2xl"
      >
        <p className="text-3xl" aria-hidden>
          🐾
        </p>
        <h2 id="members-only-title" className="mt-2 text-lg font-extrabold tracking-tight text-ink">
          회원가입 후 이용할 수 있어요
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">{feature}</strong>은(는) 회원 전용입니다. 가입은 무료이고, 이메일이나 카카오로 1분이면 끝납니다.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={`/signup?next=${next}`} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream hover:opacity-90">
            회원가입
          </Link>
          <Link href={`/login?next=${next}`} className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:bg-sand">
            로그인
          </Link>
          <button type="button" onClick={onClose} className="mt-1 text-xs text-ink-faint hover:text-ink">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
