// 로그아웃 완료 — 관리자 화면에서 로그아웃하면 여기로 온다 (app/admin/actions.ts logoutAction).
// 몇 초 뒤 메인으로 옮겨 간다. 색인하지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { SignedOutRedirect } from "./redirect";

export const metadata: Metadata = {
  title: "로그아웃되었습니다",
  robots: { index: false, follow: false },
};

export default function SignedOutPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <p className="text-4xl" aria-hidden>
        🐾
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">로그아웃되었습니다</h1>
      <p className="mt-2 text-sm text-ink-soft">
        <SignedOutRedirect seconds={5} />
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <Link href="/" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream hover:opacity-90">
          메인으로
        </Link>
        <Link href="/login" className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:bg-sand">
          다시 로그인
        </Link>
        <Link href="/admin/login" className="mt-2 text-xs text-ink-faint hover:text-ink hover:underline">
          관리자 로그인
        </Link>
      </div>
    </div>
  );
}
