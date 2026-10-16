import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { isAdmin } from "@/lib/auth";
import { cognitoConfig, siteUrl } from "@/lib/config";
import { TokenLoginForm } from "./token-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 로그인",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const cognito = Boolean(cognitoConfig());
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">관리자</h1>
      {cognito ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            사이트 회원 계정으로 로그인합니다. 관리자 그룹에 속하고 <b>2단계 인증</b>을 켠 계정만 들어올 수 있습니다.
          </p>
          <LoginForm next="/admin" admin forgotHref={`${siteUrl()}/login/forgot`} />
          <details className="mt-10 rounded-lg border border-dashed border-line p-3">
            <summary className="cursor-pointer text-xs text-ink-faint">비상 로그인 (관리자 토큰)</summary>
            <TokenLoginForm />
          </details>
        </>
      ) : (
        <TokenLoginForm />
      )}
    </div>
  );
}
