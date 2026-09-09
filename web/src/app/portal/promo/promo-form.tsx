"use client";

// 지역 상단 노출(유료) 요청 폼 — promo_slot. 결제는 수동: 운영자가 안내하고 입금 확인 후 노출을 켠다.
import Link from "next/link";
import { RegionSelect } from "@/components/requests/region-picker";
import { Req, RequestForm, inputClass, labelClass } from "@/components/requests/request-form";
import type { RegionOption } from "@/lib/queries/requests";
import { PROMO_PLANS, PROMO_PLAN_LABEL, REQUEST_LIMITS } from "@/lib/requests";
import type { PromoPlanSettings } from "@/lib/settings";

export interface PromoSpot {
  id: number;
  name: string;
  path: string;
  regionLabel: string;
  regionId: number;
}

export function PromoForm({ spot, regions, plans }: { spot: PromoSpot | null; regions: RegionOption[]; plans: PromoPlanSettings }) {
  return (
    <RequestForm
      kind="promo_slot"
      hidden={spot ? { spotId: spot.id, regionId: spot.regionId } : {}}
      submitLabel="상단 노출 요청 보내기"
      doneBody={
        <>
          <p>운영자가 남겨 주신 연락처로 형별 내용과 결제 방법을 안내해 드립니다. 확인이 끝나면 지역 페이지 상단 노출을 켭니다.</p>
          {spot && (
            <p className="mt-2">
              <Link href={spot.path} className="font-medium underline">
                업체 페이지로 돌아가기
              </Link>
            </p>
          )}
        </>
      }
      messagePlaceholder="원하는 시작 시기, 노출 기간, 궁금한 점을 적어 주세요."
    >
      {(v) => (
        <>
          <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 text-sm font-bold text-ink">
              노출 형<Req />
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROMO_PLANS.map((p) => {
                const info = plans[p];
                return (
                  <label key={p} className="flex cursor-pointer gap-2 rounded-xl border border-line bg-cream/40 p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-sand">
                    <input type="radio" name="plan" value={p} required defaultChecked={v.plan === p} className="mt-0.5" />
                    <span>
                      <span className="font-bold text-ink">{PROMO_PLAN_LABEL[p]}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{info.description || "내용은 요청 후 안내"}</span>
                      <span className="mt-1 block text-xs font-medium text-ink">{info.priceText || "요금은 요청 후 안내"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              상품은 지역 페이지 상단 노출 하나이며 형은 A·B·C 로만 나눕니다. 결제는 운영자가 안내하는 계좌·결제 링크로 진행하고, 확인 후
              노출을 켭니다. 노출 중인 업체에는 &quot;광고&quot; 표기가 붙습니다.
            </p>
          </fieldset>

          <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 text-sm font-bold text-ink">업체</legend>
            {spot ? (
              <div className="text-sm">
                <p className="font-bold text-ink">{spot.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  노출 지역: {spot.regionLabel} ·{" "}
                  <Link href={spot.path} className="text-sea hover:underline">
                    업체 페이지
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="businessName" className={labelClass}>
                    업체명
                    <Req />
                  </label>
                  <input id="businessName" name="businessName" required minLength={2} maxLength={REQUEST_LIMITS.businessName} defaultValue={v.businessName} className={inputClass} />
                  <p className="mt-1 text-xs text-ink-faint">
                    디렉토리에 아직 없는 업체라면{" "}
                    <Link href="/portal/spot" className="text-sea underline">
                      등록 요청
                    </Link>
                    도 함께 처리해 드립니다.
                  </p>
                </div>
                <div>
                  <span className={labelClass}>
                    노출할 지역 (시·군·구)
                    <Req />
                  </span>
                  <div className="mt-1">
                    <RegionSelect name="regionId" options={regions} defaultRegionId={v.regionId ? Number(v.regionId) : null} required />
                  </div>
                </div>
              </>
            )}
          </fieldset>
        </>
      )}
    </RequestForm>
  );
}
