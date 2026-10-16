// 첫 로그인 닉네임 정하기 — 카카오처럼 닉네임이 없거나(동의 안 함) 이미 쓰이는 경우 여기로 온다.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthFlow } from "@/lib/auth";
import { ProfileStepForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "닉네임 정하기",
  robots: { index: false, follow: false },
};

export default async function ProfileStepPage() {
  if (!(await getAuthFlow("profile"))) redirect("/login?error=expired");
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">닉네임 정하기</h1>
      <p className="mt-2 text-sm text-ink-soft">글·댓글·모임에 공개되는 이름입니다. 실명을 쓸 필요는 없고, 나중에 설정에서 바꿀 수 있습니다.</p>
      <ProfileStepForm />
    </div>
  );
}
