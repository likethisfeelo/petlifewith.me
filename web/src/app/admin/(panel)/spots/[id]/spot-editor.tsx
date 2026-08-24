"use client";

import { useActionState } from "react";
import { saveSpotAction, type ActionState } from "../../../actions";

interface SpotValues {
  id: number;
  typeId: number;
  status: string;
  phone: string | null;
  descriptionMd: string | null;
  hoursText: string | null;
  priceText: string | null;
  parkingText: string | null;
  reservationUrl: string | null;
  homepageUrl: string | null;
  instagramUrl: string | null;
}

const input = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function SpotEditor({ spot, types }: { spot: SpotValues; types: Array<{ id: number; name: string }> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSpotAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={spot.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="typeId">유형 (재분류)</label>
          <select id="typeId" name="typeId" defaultValue={spot.typeId} className={input}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="status">영업 상태</label>
          <select id="status" name="status" defaultValue={spot.status} className={input}>
            <option value="operating">영업 중</option>
            <option value="suspended">휴업</option>
            <option value="closed">폐업</option>
            <option value="unknown">확인 필요</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="phone">전화</label>
          <input id="phone" name="phone" defaultValue={spot.phone ?? ""} className={input} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="hoursText">운영시간</label>
          <input id="hoursText" name="hoursText" defaultValue={spot.hoursText ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="priceText">요금</label>
          <input id="priceText" name="priceText" defaultValue={spot.priceText ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="parkingText">주차</label>
          <input id="parkingText" name="parkingText" defaultValue={spot.parkingText ?? ""} className={input} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="reservationUrl">예약 URL</label>
          <input id="reservationUrl" name="reservationUrl" type="url" defaultValue={spot.reservationUrl ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="homepageUrl">홈페이지</label>
          <input id="homepageUrl" name="homepageUrl" type="url" defaultValue={spot.homepageUrl ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="instagramUrl">인스타그램</label>
          <input id="instagramUrl" name="instagramUrl" type="url" defaultValue={spot.instagramUrl ?? ""} className={input} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="descriptionMd">소개 (마크다운)</label>
        <textarea id="descriptionMd" name="descriptionMd" rows={8} defaultValue={spot.descriptionMd ?? ""} className={`${input} font-mono text-xs leading-relaxed`} />
      </div>

      {state.error && (
        <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>
      )}
      {state.saved && (
        <p className="rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">저장되었습니다.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
