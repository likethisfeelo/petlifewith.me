"use client";

// 설정 — 2단계 인증(인증 앱) 켜기/끄기 · 탈퇴. 서버 액션은 app/auth-actions.ts.
import { useActionState } from "react";
import { deleteAccountAction, totpConfirmAction, totpDisableAction, totpStartAction, type AuthActionState } from "@/app/auth-actions";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";
import { CodeInput, PasswordInput } from "@/app/login/login-form";

function Notice({ state }: { state: AuthActionState }) {
  if (!state.notice) return null;
  return <p className="rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">{state.notice}</p>;
}

export function TotpForm({ enabled }: { enabled: boolean }) {
  const [start, startAction, starting] = useActionState<AuthActionState, FormData>(totpStartAction, {});
  const [confirm, confirmAction, confirming] = useActionState<AuthActionState, FormData>(totpConfirmAction, {});
  const [off, offAction, turningOff] = useActionState<AuthActionState, FormData>(totpDisableAction, {});

  if (confirm.saved) return <Notice state={confirm} />;
  if (off.saved) return <Notice state={off} />;

  if (enabled) {
    return (
      <form action={offAction} className="space-y-3">
        <p className="text-sm text-sage-deep">켜져 있습니다. 로그인할 때 인증 앱 코드를 함께 입력합니다.</p>
        <PasswordInput name="password" label="끄려면 비밀번호 입력" autoComplete="current-password" />
        <FormMessage error={off.error} />
        <SubmitButton pending={turningOff} label="2단계 인증 끄기" pendingLabel="처리 중..." />
      </form>
    );
  }

  const totp = start.totp ?? confirm.totp;
  if (totp) {
    return (
      <form action={confirmAction} className="space-y-3">
        <p className="text-sm text-ink-soft">인증 앱(Google Authenticator, Microsoft Authenticator 등)으로 QR 을 찍거나 키를 직접 입력하세요.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={totp.qr} alt="인증 앱 등록 QR" width={200} height={200} className="rounded-lg border border-line bg-white p-2" />
        <p className="break-all rounded bg-sand px-2 py-1 font-mono text-xs text-ink">{totp.secret}</p>
        <CodeInput label="앱에 표시된 6자리" />
        <FormMessage error={confirm.error} />
        <SubmitButton pending={confirming} label="확인하고 켜기" pendingLabel="확인 중..." />
      </form>
    );
  }

  return (
    <form action={startAction} className="space-y-3">
      <p className="text-sm text-ink-soft">비밀번호 외에 휴대폰 인증 앱의 6자리 코드를 한 번 더 확인합니다. 관리자 계정은 켜 두기를 권합니다.</p>
      <PasswordInput name="password" label="비밀번호 확인" autoComplete="current-password" />
      <FormMessage error={start.error} />
      <SubmitButton pending={starting} label="인증 앱 등록 시작" pendingLabel="준비 중..." />
    </form>
  );
}

export function DeleteAccountForm({ needsPassword }: { needsPassword: boolean }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(deleteAccountAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-soft">
        탈퇴하면 계정과 로그인 정보가 지워지고 되돌릴 수 없습니다. 이미 쓴 글·댓글은 &quot;탈퇴회원&quot; 이름으로 남습니다 — 지우려면 탈퇴 전에
        직접 삭제하거나 문의해 주세요.
      </p>
      {needsPassword && <PasswordInput name="password" label="비밀번호" autoComplete="current-password" />}
      <TextField name="confirm" label="확인 — '탈퇴' 입력" required />
      <FormMessage error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-accent/40 bg-accent-soft px-5 py-2.5 text-sm font-medium text-accent-deep hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "처리 중..." : "탈퇴하기"}
      </button>
    </form>
  );
}
