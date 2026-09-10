"use client";

// 내 지역(최대 3곳) 고르기 — /me 와 펫모임 화면에서 같이 쓴다.
import { useActionState } from "react";
import { saveMyRegionsAction, type MeetupActionState } from "@/app/meetup-actions";
import { RegionMultiPicker } from "@/components/requests/region-picker";
import { MEETUP_LIMITS } from "@/lib/meetups";
import type { RegionOption } from "@/lib/queries/requests";

export function MyRegionsForm({ regions, current, compact }: { regions: RegionOption[]; current: number[]; compact?: boolean }) {
  const [state, formAction, pending] = useActionState<MeetupActionState, FormData>(saveMyRegionsAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <RegionMultiPicker name="regionIds" options={regions} defaultIds={current} max={MEETUP_LIMITS.regions} />
      {!compact && <p className="text-xs text-ink-faint">고른 지역의 모임이 펫모임 첫 화면에 보이고, 모임은 내 지역에서만 만들 수 있어요.</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
          {pending ? "저장 중..." : "내 지역 저장"}
        </button>
        {state.saved && <span className="text-xs font-medium text-sage-deep">저장했습니다</span>}
        {state.error && <span className="text-xs font-medium text-accent-deep">{state.error}</span>}
      </div>
    </form>
  );
}
