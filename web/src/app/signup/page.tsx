import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isKakaoEnabled } from "@/lib/cognito";
import { getCurrentMember, safeNextPath } from "@/lib/member";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "회원 가입",
  robots: { index: false, follow: false },
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);
  if (await getCurrentMember()) redirect(target);
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">회원 가입</h1>
      <p className="mt-2 text-sm text-ink-soft">우리 개 이야기를 쓰고, 다른 보호자의 글에 댓글을 남길 수 있습니다.</p>
      <SignupForm next={target} kakao={isKakaoEnabled()} />
    </div>
  );
}
