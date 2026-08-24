"use client";

import { useActionState } from "react";
import { submitClaim, type ClaimFormState } from "../../actions";

const initialState: ClaimFormState = {};

export function ClaimForm({ targetType, targetId }: { targetType: "spot" | "maker"; targetId: number }) {
  const [state, formAction, pending] = useActionState(submitClaim, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <div>
        <label htmlFor="claimantName" className="block text-sm font-medium text-ink">
          성함 (담당자명) <span className="text-accent">*</span>
        </label>
        <input
          id="claimantName"
          name="claimantName"
          required
          minLength={2}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>

      <div>
        <label htmlFor="contact" className="block text-sm font-medium text-ink">
          회신받을 연락처 (이메일 또는 전화) <span className="text-accent">*</span>
        </label>
        <input
          id="contact"
          name="contact"
          required
          minLength={5}
          placeholder="owner@example.com"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1 text-xs text-ink-faint">확인 연락에만 사용하며 페이지에 공개되지 않습니다.</p>
      </div>

      <div>
        <label htmlFor="bizRegistrationNo" className="block text-sm font-medium text-ink">
          사업자등록번호 (선택)
        </label>
        <input
          id="bizRegistrationNo"
          name="bizRegistrationNo"
          placeholder="000-00-00000"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1 text-xs text-ink-faint">운영자 확인이 빨라집니다. 공개되지 않습니다.</p>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-ink">
          요청 내용
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="수정할 정보(운영시간·요금·예약 링크 등)나 요청 사항을 적어주세요."
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>

      {state.error && (
        <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "접수 중..." : "무료로 요청하기"}
      </button>
    </form>
  );
}
