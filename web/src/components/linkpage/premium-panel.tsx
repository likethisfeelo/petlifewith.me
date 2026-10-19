"use client";

// 유료 상품 (관리자) — 링크 페이지 내용 편집과 떼어 둔다. 두 상품은 서로 별개다.
//  ① 프리미엄 링크 페이지: 기간(시작~종료, 한국 날짜) + 짧은 주소 → 기간 안에만 어두운 디자인·사진·영상·짧은 주소
//  ② 지역 상단 노출: 켜기/끄기 (목록 맨 위 "광고")
import { useActionState, useState } from "react";
import { endPremiumAction, savePremiumAction, type SpotPageActionState } from "@/app/spot-page-actions";
import { togglePromotionAction } from "@/app/admin/actions";
import { PREMIUM_STATE_LABEL, addMonths, premiumStatus, todayKst } from "@/lib/spot-pages";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-sea focus:outline-none";

export function PremiumPanel({
  spotId,
  monetizable,
  page,
  promoted,
  linkUrl,
}: {
  spotId: number;
  monetizable: boolean;
  page: { paidFrom: string | null; paidUntil: string | null; handle: string | null } | null;
  promoted: boolean;
  linkUrl: string | null;
}) {
  const [state, action, pending] = useActionState<SpotPageActionState, FormData>(savePremiumAction, {});
  const status = premiumStatus(page);
  const today = todayKst();
  const [from, setFrom] = useState(page?.paidFrom ?? today);
  const [until, setUntil] = useState(page?.paidUntil ?? "");

  if (!monetizable) {
    return (
      <section className="rounded-2xl border border-line bg-sand/60 p-5 text-sm text-ink-soft">
        <h2 className="text-base font-bold text-ink">유료 상품</h2>
        <p className="mt-1">장묘·동물약국·B2B 유형에는 프리미엄 페이지·상단 노출을 붙이지 않습니다.</p>
      </section>
    );
  }

  const badge =
    status.state === "active"
      ? `진행 중 · ${status.days}일 남음`
      : status.state === "scheduled"
        ? `시작 예정 · ${status.days}일 뒤`
        : status.state === "expired"
          ? `끝남 · ${status.days}일 지남`
          : PREMIUM_STATE_LABEL.none;

  return (
    <section className="rounded-2xl border-2 border-honey/50 bg-honey-soft/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">💳 유료 상품</h2>
        <p className="text-xs text-ink-soft">두 상품은 따로 켜고 끕니다. 결제 확인 뒤 여기서 적용하세요.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ① 프리미엄 링크 페이지 */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">① 프리미엄 링크 페이지</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.state === "active" ? "bg-ink text-cream" : status.state === "scheduled" ? "bg-sea-soft text-sea" : "bg-sand text-ink-soft"}`}>{badge}</span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">기간 안에만 어두운 디자인·사진/영상(각 10개)·짧은 주소. 목록에서 &quot;프리미엄&quot; 자리.</p>

          <form action={action} className="mt-3 space-y-3">
            <input type="hidden" name="spotId" value={spotId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">시작일</span>
                <input type="date" name="paidFrom" value={from} onChange={(e) => setFrom(e.target.value)} className={input} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">종료일</span>
                <input type="date" name="paidUntil" value={until} onChange={(e) => setUntil(e.target.value)} className={input} required />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-faint">시작일부터</span>
              {[1, 3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => setUntil(addMonths(from || today, m))} className="rounded-full border border-line px-2.5 py-1 font-semibold text-ink hover:bg-sand">
                  {m}개월
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">짧은 주소 (선택)</span>
              <input name="handle" defaultValue={page?.handle ?? ""} placeholder="예: masterpet — 영문 소문자·숫자·하이픈 3~30자" className={input} />
            </label>
            {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
            {state.saved && <p className="rounded-lg bg-sage-soft px-3 py-2 text-sm text-sage-deep">적용했습니다.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-cream hover:opacity-90 disabled:opacity-50">
                {pending ? "적용 중…" : status.state === "none" ? "프리미엄 적용" : "기간·주소 저장"}
              </button>
              {linkUrl && status.state === "active" && (
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sea hover:underline">
                  {linkUrl.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
          </form>
          {status.state !== "none" && (
            <form
              action={endPremiumAction}
              className="mt-3 border-t border-line pt-3"
              onSubmit={(e) => {
                if (!confirm("프리미엄을 끝낼까요? 기간만 지우고 짧은 주소·사진은 남겨 둡니다.")) e.preventDefault();
              }}
            >
              <input type="hidden" name="spotId" value={spotId} />
              <button type="submit" className="text-xs font-medium text-rose-600 hover:underline">
                프리미엄 끝내기
              </button>
            </form>
          )}
        </div>

        {/* ② 지역 상단 노출 */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">② 지역 상단 노출</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${promoted ? "bg-accent-soft text-accent-deep" : "bg-sand text-ink-soft"}`}>{promoted ? "노출 중" : "꺼짐"}</span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">지역 목록 맨 위 &quot;광고&quot; 자리. 프리미엄과 별개 상품입니다.</p>
          <form action={togglePromotionAction} className="mt-3">
            <input type="hidden" name="spotId" value={spotId} />
            <button type="submit" className={`rounded-full px-5 py-2 text-sm font-bold ${promoted ? "border border-line text-ink hover:bg-sand" : "bg-ink text-cream hover:opacity-90"}`}>
              {promoted ? "상단 노출 끄기" : "상단 노출 켜기"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
