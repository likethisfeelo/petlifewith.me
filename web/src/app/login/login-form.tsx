"use client";

// 로그인 — 이메일·비밀번호 → (2단계 인증 코드) → (첫 로그인 새 비밀번호) → (이메일 미확인이면 확인 코드).
// 같은 폼을 관리자 로그인(admin)에도 쓴다. 단계 상태는 서버 액션이 돌려주고, Cognito 세션 문자열은 서명 쿠키에 있다.
import Link from "next/link";
import { useActionState } from "react";
import {
  confirmSignupAction,
  loginAction,
  mfaCodeAction,
  newPasswordAction,
  resendCodeAction,
  type AuthActionState,
} from "@/app/auth-actions";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";

export const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function PasswordInput({ name, label, autoComplete, hint }: { name: string; label: string; autoComplete: string; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="password" required minLength={8} autoComplete={autoComplete} className={inputClass} />
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function CodeInput({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor="code">
        {label}
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        className={`${inputClass} tracking-[0.3em]`}
      />
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="rounded-lg border border-line bg-sand px-3 py-2 text-sm text-ink-soft">{text}</p>;
}

/** 가입 확인 코드 단계 — 로그인·가입 화면 공용 */
export function ConfirmCodeStep({ email, next, notice }: { email: string; next: string; notice?: string }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(confirmSignupAction, {});
  const [resent, resendAction, resending] = useActionState<AuthActionState, FormData>(resendCodeAction, {});
  return (
    <div className="mt-6 space-y-4">
      <Notice text={resent.notice ?? notice} />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <CodeInput label="이메일 확인 코드" hint={`${email} 로 받은 6자리 숫자`} />
        <FormMessage error={state.error ?? resent.error} />
        <SubmitButton pending={pending} label="확인" pendingLabel="확인 중..." />
      </form>
      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={resending} className="text-sm text-sea underline disabled:opacity-50">
          코드 다시 받기
        </button>
      </form>
    </div>
  );
}

export function LoginForm({
  next,
  admin = false,
  initialEmail,
  notice,
  kakao = false,
  forgotHref = "/login/forgot",
}: {
  next: string;
  admin?: boolean;
  initialEmail?: string;
  notice?: string;
  kakao?: boolean;
  /** admin. 호스트에서는 /login/forgot 이 /admin 아래로 바뀌므로 메인 사이트 주소를 넘긴다 */
  forgotHref?: string;
}) {
  const [login, loginFormAction, loginPending] = useActionState<AuthActionState, FormData>(loginAction, {});
  const [mfa, mfaFormAction, mfaPending] = useActionState<AuthActionState, FormData>(mfaCodeAction, {});
  const [newPw, newPwFormAction, newPwPending] = useActionState<AuthActionState, FormData>(newPasswordAction, {});

  // 가장 최근 단계: 새 비밀번호 → MFA 로 이어질 수 있다
  const latest = newPw.step || newPw.error ? newPw : mfa.step || mfa.error ? mfa : login;
  const step = latest.step;
  const email = latest.values?.email ?? login.values?.email ?? initialEmail ?? "";

  if (step === "confirm") return <ConfirmCodeStep email={email} next={next} notice={latest.notice} />;

  if (step === "mfa") {
    return (
      <form action={mfaFormAction} className="mt-6 space-y-4">
        <Notice text="인증 앱(Google Authenticator 등)에 표시된 6자리 코드를 입력해 주세요." />
        <CodeInput label="2단계 인증 코드" />
        <FormMessage error={mfa.error} />
        <SubmitButton pending={mfaPending} label="확인" pendingLabel="확인 중..." />
      </form>
    );
  }

  if (step === "new_password") {
    return (
      <form action={newPwFormAction} className="mt-6 space-y-4">
        <Notice text={latest.notice ?? "새 비밀번호를 정해 주세요."} />
        <PasswordInput name="password" label="새 비밀번호" autoComplete="new-password" hint="8자 이상, 숫자 1개 이상." />
        <PasswordInput name="passwordConfirm" label="새 비밀번호 확인" autoComplete="new-password" />
        <FormMessage error={newPw.error} />
        <SubmitButton pending={newPwPending} label="저장하고 로그인" pendingLabel="저장 중..." />
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <Notice text={notice} />
      {kakao && !admin && (
        <>
          <a
            href={`/api/auth/kakao?next=${encodeURIComponent(next)}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-5 py-2.5 text-sm font-semibold text-[#191919] hover:opacity-90"
          >
            <span aria-hidden>💬</span> 카카오로 시작하기
          </a>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" /> 또는 이메일로 <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form action={loginFormAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {admin && <input type="hidden" name="admin" value="1" />}
        <TextField name="email" label="이메일" type="text" required placeholder="you@example.com" defaultValue={email} />
        <PasswordInput name="password" label="비밀번호" autoComplete="current-password" />
        <FormMessage error={latest.error} />
        <SubmitButton pending={loginPending} label="로그인" pendingLabel="확인 중..." />
      </form>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        <Link href={forgotHref} className="text-sea underline">
          비밀번호 찾기
        </Link>
        {!admin && (
          <span>
            아직 계정이 없나요?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-sea underline">
              가입하기
            </Link>
          </span>
        )}
      </p>
    </div>
  );
}
