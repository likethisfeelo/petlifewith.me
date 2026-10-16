"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotConfirmAction, forgotStartAction, type AuthActionState } from "@/app/auth-actions";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";
import { CodeInput, PasswordInput } from "../login-form";

export function ForgotForm() {
  const [start, startAction, starting] = useActionState<AuthActionState, FormData>(forgotStartAction, {});
  const [confirm, confirmAction, confirming] = useActionState<AuthActionState, FormData>(forgotConfirmAction, {});
  const email = confirm.values?.email ?? start.values?.email ?? "";

  if (start.step === "forgot_confirm" || confirm.step === "forgot_confirm") {
    return (
      <form action={confirmAction} className="mt-6 space-y-4">
        {start.notice && <p className="rounded-lg border border-line bg-sand px-3 py-2 text-sm text-ink-soft">{start.notice}</p>}
        <input type="hidden" name="email" value={email} />
        <CodeInput label="메일로 받은 코드" />
        <PasswordInput name="password" label="새 비밀번호" autoComplete="new-password" hint="8자 이상, 숫자 1개 이상." />
        <PasswordInput name="passwordConfirm" label="새 비밀번호 확인" autoComplete="new-password" />
        <FormMessage error={confirm.error} />
        <SubmitButton pending={confirming} label="비밀번호 바꾸기" pendingLabel="저장 중..." />
      </form>
    );
  }
  return (
    <form action={startAction} className="mt-6 space-y-4">
      <TextField name="email" label="이메일" type="text" required placeholder="you@example.com" defaultValue={email} />
      <FormMessage error={start.error} />
      <SubmitButton pending={starting} label="코드 받기" pendingLabel="보내는 중..." />
      <p className="text-sm text-ink-soft">
        <Link href="/login" className="text-sea underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </form>
  );
}
