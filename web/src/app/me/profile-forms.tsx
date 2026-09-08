"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction, type MemberActionState } from "@/app/member-actions";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";

const pw = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(updateProfileAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <TextField name="displayName" label="닉네임" defaultValue={displayName} required hint="바꾸면 내 글·댓글의 이름도 함께 바뀝니다." />
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label="닉네임 저장" />
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(changePasswordAction, {});
  return (
    <form action={formAction} className="space-y-3">
      {[
        ["currentPassword", "현재 비밀번호", "current-password"],
        ["newPassword", "새 비밀번호", "new-password"],
        ["newPasswordConfirm", "새 비밀번호 확인", "new-password"],
      ].map(([name, label, ac]) => (
        <div key={name}>
          <label className="block text-sm font-medium text-ink" htmlFor={name}>
            {label}
          </label>
          <input id={name} name={name} type="password" required minLength={8} autoComplete={ac} className={pw} />
        </div>
      ))}
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label="비밀번호 변경" />
      <p className="text-xs text-ink-faint">변경하면 다른 기기의 로그인은 풀립니다.</p>
    </form>
  );
}
