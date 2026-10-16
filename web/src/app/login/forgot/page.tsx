import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  robots: { index: false, follow: false },
};

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">비밀번호 찾기</h1>
      <p className="mt-2 text-sm text-ink-soft">가입한 이메일로 6자리 코드를 보내 드립니다. 카카오로 가입했다면 카카오로 로그인하세요.</p>
      <ForgotForm />
    </div>
  );
}
