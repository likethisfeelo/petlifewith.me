"use client";

import Link from "next/link";
import { useActionState } from "react";
import { memberLoginAction, type MemberActionState } from "@/app/member-actions";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";

export function MemberLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(memberLoginAction, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="이메일" type="text" required placeholder="you@example.com" defaultValue={state.values?.email} />
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton pending={pending} label="로그인" pendingLabel="확인 중..." />
      <p className="text-sm text-ink-soft">
        아직 계정이 없나요?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-sea underline">
          가입하기
        </Link>
      </p>
    </form>
  );
}
