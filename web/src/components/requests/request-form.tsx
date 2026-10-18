"use client";

// 요청함 공개 폼의 공통 껍데기 — 종류(hidden)·봇 함정·종류별 칸(children)·담당자 칸·동의·전송·접수 안내.
// 서버 액션 하나(createServiceRequestAction)로 모든 종류가 들어간다. 에러가 나면 입력값을 되돌려 채운다.
import type { ReactNode } from "react";
import { startTransition, useActionState, useEffect } from "react";
import { track } from "@/components/tracker";
import { createServiceRequestAction, type RequestActionState } from "@/app/request-actions";
import { REQUEST_LIMITS, type RequestKind } from "@/lib/requests";
import type { OwnerSearchHit } from "@/lib/queries/spot-register";

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
  requesterFirst = false,
  requesterExtra,
  onPickDuplicate,
  children,
}: {
  /** 업체 등록에서 "혹시 이 업체인가요?" 카드의 "이 업체가 맞아요" — 고른 업체로 정보 관리 요청을 이어 간다 */
  onPickDuplicate?: (hit: OwnerSearchHit) => void;
  kind: RequestKind;
  /** 함께 보낼 값 (대상 id 등) */
  hidden?: Record<string, string | number>;
  submitLabel: string;
  doneTitle?: string;
  doneBody: ReactNode;
  requesterLabel?: string;
  showBizNo?: boolean;
  messagePlaceholder?: string;
  /** 연락받을 분을 맨 위에 — 종류별 칸이 모두 선택일 때 (요청 내용·동의는 맨 아래로) */
  requesterFirst?: boolean;
  /** 연락받을 분 칸에 덧붙일 선택 칸 (예: 업체명) — 사업자등록번호 옆에 놓인다 */
  requesterExtra?: (v: Record<string, string>) => ReactNode;
  /** 종류별 입력 칸 — 에러 뒤 되돌려 받은 값(v)으로 defaultValue 를 채운다 */
  children: (v: Record<string, string>) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(createServiceRequestAction, {});
  // 측정: 요청함 접수 (종류만)
  useEffect(() => {
    if (state.savedId) track("request_submit", { request_kind: kind });
  }, [state.savedId, kind]);
  const v = state.values ?? {};

  const messageAndConsent = (
    <>
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
    </>
  );

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
    <form
      // action={...} 대신 onSubmit — 서버 액션 뒤 React 가 폼을 비우지 않게 한다
      // ("혹시 이 업체인가요?"·오류 뒤에도 고른 지역·업종·체크가 그대로 남아야 다시 보내기 쉽다)
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
      className="mt-6 space-y-5"
    >
      <input type="hidden" name="kind" value={kind} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      {/* 봇 함정 — 사람은 보지 못한다 */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {!requesterFirst && children(v)}

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
        {(showBizNo || requesterExtra) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {showBizNo && (
              <div>
                <label htmlFor="bizRegistrationNo" className={labelClass}>
                  사업자등록번호 (선택)
                </label>
                <input id="bizRegistrationNo" name="bizRegistrationNo" maxLength={REQUEST_LIMITS.bizNo} defaultValue={v.bizRegistrationNo} placeholder="000-00-00000" className={inputClass} />
                <p className="mt-1 text-xs text-ink-faint">운영자 확인이 빨라집니다. 공개되지 않습니다.</p>
              </div>
            )}
            {requesterExtra?.(v)}
          </div>
        )}
        {!requesterFirst && messageAndConsent}
      </fieldset>

      {requesterFirst && (
        <>
          {children(v)}
          <div className="space-y-4 rounded-2xl border border-line bg-sand/40 p-4">{messageAndConsent}</div>
        </>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {state.error}
        </p>
      )}

      {state.duplicates && state.duplicates.length > 0 ? (
        <div role="alert" className="space-y-3 rounded-2xl border-2 border-honey/50 bg-honey-soft p-4">
          <p className="font-bold text-ink">혹시 이 업체인가요?</p>
          <p className="text-sm text-ink-soft">이미 소개 중인 업체 같아요. 맞다면 새로 등록하지 않고 정보 관리 요청으로 바로 넘어갈 수 있어요.</p>
          <ul className="space-y-2">
            {state.duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{d.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {d.typeName} · {d.address ?? d.regionLabel}
                  </span>
                </span>
                {d.owner === "mine" ? (
                  <a href={`/me/business/spot/${d.id}`} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-cream">
                    내 업체 관리하기
                  </a>
                ) : d.owner === "other" ? (
                  <span className="text-xs text-ink-faint">다른 회원이 관리 중</span>
                ) : onPickDuplicate ? (
                  <button type="button" onClick={() => onPickDuplicate(d)} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-cream">
                    이 업체가 맞아요
                  </button>
                ) : (
                  <a href={`/portal/spot?spot=${d.id}#register`} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-cream">
                    이 업체가 맞아요
                  </a>
                )}
              </li>
            ))}
          </ul>
          <button type="submit" name="confirmNew" value="1" disabled={pending} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-sand disabled:opacity-50">
            {pending ? "보내는 중..." : "아니요, 다른 업체예요 — 새로 등록할게요"}
          </button>
        </div>
      ) : (
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
          {pending ? "보내는 중..." : submitLabel}
        </button>
      )}
    </form>
  );
}
