"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "../actions";

// 비상 로그인 — 전환 기간에만 남기는 ADMIN_TOKEN 경로 (Cognito 장애·설정 실수 대비). 안정화 후 제거한다.
export function TokenLoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-ink">
          관리자 토큰
        </label>
        <input
          id="token"
          name="token"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1 text-xs text-ink-faint">
          .env.deploy.&lt;스테이지&gt; 의 ADMIN_TOKEN. Cognito 로그인을 쓸 수 없을 때만 쓰는 비상 경로입니다.
        </p>
      </div>
      {state.error && (
        <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "확인 중..." : "토큰으로 로그인"}
      </button>
    </form>
  );
}
