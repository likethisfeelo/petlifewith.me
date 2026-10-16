import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isKakaoEnabled } from "@/lib/cognito";
import { getCurrentMember, safeNextPath } from "@/lib/member";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  confirmed: "이메일 확인이 끝났습니다. 로그인해 주세요.",
  reset: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.",
  kakao_failed: "카카오 로그인을 마치지 못했습니다. 다시 시도해 주세요.",
  kakao_cancelled: "카카오 로그인을 취소했습니다.",
  expired: "로그인 시간이 지났습니다. 다시 시도해 주세요.",
  blocked: "이용이 제한된 계정입니다. 문의해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; confirmed?: string; reset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const target = safeNextPath(sp.next);
  if (await getCurrentMember()) redirect(target);
  const notice = sp.confirmed ? NOTICES.confirmed : sp.reset ? NOTICES.reset : sp.error ? NOTICES[sp.error] : undefined;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">로그인</h1>
      <p className="mt-2 text-sm text-ink-soft">글과 댓글은 회원만 쓸 수 있습니다. 읽는 데는 로그인이 필요 없습니다.</p>
      <LoginForm next={target} initialEmail={sp.email} notice={notice} kakao={isKakaoEnabled()} />
    </div>
  );
}
