"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type MemberActionState } from "@/app/member-actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";

const pw = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(signupAction, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="이메일" type="text" required placeholder="you@example.com" defaultValue={state.values?.email} hint="로그인과 계정 안내에만 쓰고 공개하지 않습니다." />
      <TextField name="displayName" label="닉네임" required placeholder="2~20자" defaultValue={state.values?.displayName} hint="글과 댓글에 공개되는 이름입니다. 실명을 쓸 필요는 없습니다." />
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="password">
          비밀번호 <span className="text-accent">*</span>
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={pw} />
        <p className="mt-1 text-xs text-ink-faint">8자 이상. 다른 사이트와 같은 비밀번호는 피하세요.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="passwordConfirm">
          비밀번호 확인 <span className="text-accent">*</span>
        </label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className={pw} />
      </div>
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
      <SubmitButton pending={pending} label="가입하기" pendingLabel="가입 중..." />
      <p className="text-sm text-ink-soft">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-sea underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
