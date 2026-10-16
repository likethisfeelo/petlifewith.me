"use client";

import { useActionState } from "react";
import { profileAction, type AuthActionState } from "@/app/auth-actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";

export function ProfileStepForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(profileAction, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <TextField name="displayName" label="닉네임" required placeholder="2~20자" defaultValue={state.values?.displayName} />
      <div className="rounded-lg border border-line bg-sand px-4 py-3 text-xs leading-relaxed text-ink-soft">
        회원 글은 운영진 확인 후 공개되고, 댓글은 바로 보입니다. 진단·처방 단정이나 병원·상품 광고는 승인되지 않습니다.
      </div>
      <CheckboxField name="agree" label="위 안내를 확인했습니다." />
      <FormMessage error={state.error} />
      <SubmitButton pending={pending} label="시작하기" pendingLabel="저장 중..." />
    </form>
  );
}
