"use client";

// 요청함 공개 폼의 공통 껍데기 — 종류(hidden)·봇 함정·종류별 칸(children)·담당자 칸·동의·전송·접수 안내.
// 서버 액션 하나(createServiceRequestAction)로 모든 종류가 들어간다. 에러가 나면 입력값을 되돌려 채운다.
import type { ReactNode } from "react";
import { useActionState, useEffect } from "react";
import { track } from "@/components/tracker";
import { createServiceRequestAction, type RequestActionState } from "@/app/request-actions";
import { REQUEST_LIMITS, type RequestKind } from "@/lib/requests";

export const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
export const labelClass = "block text-sm font-medium text-ink";

export function Req() {
  return <span className="text-accent"> *</span>;
}

export function RequestForm({
  kind,
  hidden = {},
  submitLabel,
  doneTitle = "접수되었습니다",
  doneBody,
  requesterLabel = "담당자 이름",
  showBizNo = true,
  messagePlaceholder = "덧붙일 내용이 있으면 적어 주세요.",
  children,
}: {
  kind: RequestKind;
  /** 함께 보낼 값 (대상 id 등) */
  hidden?: Record<string, string | number>;
  submitLabel: string;
  doneTitle?: string;
  doneBody: ReactNode;
  requesterLabel?: string;
  showBizNo?: boolean;
  messagePlaceholder?: string;
  /** 종류별 입력 칸 — 에러 뒤 되돌려 받은 값(v)으로 defaultValue 를 채운다 */
  children: (v: Record<string, string>) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(createServiceRequestAction, {});
  // 측정: 요청함 접수 (종류만)
  useEffect(() => {
    if (state.savedId) track("request_submit", { request_kind: kind });
  }, [state.savedId, kind]);
  const v = state.values ?? {};

  if (state.savedId) {
    return (
      <div className="mt-8 rounded-2xl border border-sage/30 bg-sage-soft p-6" role="status">
        <p className="font-bold text-sage-deep">
          {doneTitle} <span className="text-xs font-medium">(접수 번호 {state.savedId})</span>
        </p>
        <div className="mt-2 text-sm leading-relaxed text-sage-deep/90">{doneBody}</div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="kind" value={kind} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      {/* 봇 함정 — 사람은 보지 못한다 */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {children(v)}

      <fieldset className="space-y-4 rounded-2xl border border-line bg-sand/40 p-4">
        <legend className="px-1 text-sm font-bold text-ink">연락받을 분</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="requesterName" className={labelClass}>
              {requesterLabel}
              <Req />
            </label>
            <input id="requesterName" name="requesterName" required maxLength={REQUEST_LIMITS.name} defaultValue={v.requesterName} className={inputClass} />
          </div>
          <div>
            <label htmlFor="contact" className={labelClass}>
              연락처 (전화 · 카카오톡 ID · 이메일)
              <Req />
            </label>
            <input id="contact" name="contact" required minLength={5} maxLength={REQUEST_LIMITS.contact} defaultValue={v.contact} placeholder="010-0000-0000" className={inputClass} />
          </div>
        </div>
        {showBizNo && (
          <div>
            <label htmlFor="bizRegistrationNo" className={labelClass}>
              사업자등록번호 (선택)
            </label>
            <input id="bizRegistrationNo" name="bizRegistrationNo" maxLength={REQUEST_LIMITS.bizNo} defaultValue={v.bizRegistrationNo} placeholder="000-00-00000" className={inputClass} />
            <p className="mt-1 text-xs text-ink-faint">운영자 확인이 빨라집니다. 공개되지 않습니다.</p>
          </div>
        )}
        <div>
          <label htmlFor="message" className={labelClass}>
            요청 내용 (선택)
          </label>
          <textarea id="message" name="message" rows={4} maxLength={REQUEST_LIMITS.message} defaultValue={v.message} placeholder={messagePlaceholder} className={inputClass} />
        </div>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-0.5" />
          <span>이름·연락처·사업자번호는 요청 확인과 회신에만 쓰고 페이지에 공개하지 않는 데 동의합니다.</span>
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
        {pending ? "보내는 중..." : submitLabel}
      </button>
    </form>
  );
}
