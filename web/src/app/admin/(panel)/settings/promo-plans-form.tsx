"use client";

// 지역 상단 노출 A·B·C 형 안내문 — /portal/promo 의 형 카드에 그대로 보인다. 비우면 "요청 후 안내".

import { PROMO_PLANS, PROMO_PLAN_LABEL } from "@/lib/requests";
import { useKeptForm } from "../../_components/use-kept-form";
import type { PromoPlanSettings } from "@/lib/settings";
import { savePromoPlansAction } from "../../settings-actions";
import type { ActionState } from "../../actions";
import { FormMessage, SubmitButton, TextField } from "../../_components/fields";

export function PromoPlansForm({ current }: { current: PromoPlanSettings }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<ActionState>(savePromoPlansAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">
          지역 상단 노출 형 안내 <span className="font-normal text-ink-faint">— 요청 페이지(/portal/promo)에 보이는 문구. 비우면 &quot;요청 후 안내&quot;</span>
        </h2>
        {PROMO_PLANS.map((p) => (
          <div key={p} className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
            <p className="pt-7 text-sm font-bold text-ink">{PROMO_PLAN_LABEL[p]}</p>
            <TextField name={`${p}_description`} label="설명 한 줄" defaultValue={current[p].description} placeholder="예: 지역 페이지 상단 1자리, 광고 표기" />
            <TextField name={`${p}_priceText`} label="요금 문구" defaultValue={current[p].priceText} placeholder="예: 월 30,000원 (부가세 별도)" />
          </div>
        ))}
        <p className="text-xs text-ink-faint">결제는 수동입니다 — 요청이 오면 슬랙·요청함에서 보고 계좌나 결제 링크를 안내한 뒤, 입금 확인 → 노출 켜기 순서로 처리합니다.</p>
      </section>
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label="형 안내 저장" />
    </form>
  );
}
