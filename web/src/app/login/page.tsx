import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, safeNextPath } from "@/lib/member";
import { MemberLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);
  if (await getCurrentMember()) redirect(target);
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">로그인</h1>
      <p className="mt-2 text-sm text-ink-soft">글과 댓글은 회원만 쓸 수 있습니다. 읽는 데는 로그인이 필요 없습니다.</p>
      <MemberLoginForm next={target} />
    </div>
  );
}
