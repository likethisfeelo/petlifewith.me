"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthActionState } from "@/app/auth-actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";
import { ConfirmCodeStep, PasswordInput } from "@/app/login/login-form";

export function SignupForm({ next, kakao = false }: { next: string; kakao?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signupAction, {});
  if (state.step === "confirm" && state.values?.email) return <ConfirmCodeStep email={state.values.email} next={next} notice={state.notice} />;
  return (
    <>
    {kakao && (
      <div className="mt-6 space-y-4">
        <a
          href={`/api/auth/kakao?next=${encodeURIComponent(next)}`}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-5 py-2.5 text-sm font-semibold text-[#191919] hover:opacity-90"
        >
          <span aria-hidden>💬</span> 카카오로 시작하기
        </a>
        <p className="text-center text-xs text-ink-faint">카카오는 회원번호와 (동의하면) 닉네임만 받습니다. 이메일·전화번호는 받지 않습니다.</p>
        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-line" /> 또는 이메일로 가입 <span className="h-px flex-1 bg-line" />
        </div>
      </div>
    )}
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="이메일" type="text" required placeholder="you@example.com" defaultValue={state.values?.email} hint="로그인과 계정 안내에만 쓰고 공개하지 않습니다." />
      <PasswordInput name="password" label="비밀번호" autoComplete="new-password" hint="8자 이상, 숫자 1개 이상. 다른 사이트와 같은 비밀번호는 피하세요." />
      <PasswordInput name="passwordConfirm" label="비밀번호 확인" autoComplete="new-password" />
      <div className="rounded-lg border border-line bg-sand px-4 py-3 text-xs leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">글·댓글 안내</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>회원이 쓴 글은 관리자 확인 후 공개됩니다. 댓글은 바로 보이며, 규칙에 어긋나면 숨김 처리됩니다.</li>
          <li>경험 공유는 환영하지만 진단·처방을 단정하거나 특정 병원·상품을 광고하는 글은 승인되지 않습니다.</li>
          <li>다른 사람의 개인정보(연락처·주소)를 올리지 마세요.</li>
        </ul>
      </div>
      <CheckboxField name="agree" label="위 안내를 확인했고, 이메일·닉네임을 위 용도로 쓰는 데 동의합니다." defaultChecked={state.values?.agree === "on"} />
      <FormMessage error={state.error} />
      <SubmitButton pending={pending} label="가입하고 확인 코드 받기" pendingLabel="가입 중..." />
      <p className="text-sm text-ink-soft">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-sea underline">
          로그인
        </Link>
      </p>
    </form>
    </>
  );
}
