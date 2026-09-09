"use client";

// 모임 만들기·수정 폼. 지역은 만들 때만 고른다(내 지역 가운데). 장소는 짧은 문구만 — 집 주소를 받지 않는다.
import { useActionState } from "react";
import { createMeetupAction, updateMeetupAction, type MeetupActionState } from "@/app/meetup-actions";
import { MEETUP_LIMITS, toMeetingInput } from "@/lib/meetups";
import type { RegionOption } from "@/lib/queries/requests";

const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
const labelClass = "block text-sm font-medium text-ink";

export interface MeetupFormValues {
  id?: number;
  title: string;
  regionId?: number | null;
  descriptionMd: string | null;
  placeText: string | null;
  meetingAt: Date | null;
  capacity: number | null;
}

export function MeetupForm({ mode, regions, initial }: { mode: "create" | "edit"; regions: RegionOption[]; initial: MeetupFormValues }) {
  const [state, formAction, pending] = useActionState<MeetupActionState, FormData>(mode === "create" ? createMeetupAction : updateMeetupAction, {});
  const v = state.values ?? {};
  return (
    <form action={formAction} className="mt-6 space-y-4">
      {initial.id !== undefined && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelClass}>
            모임 이름 <span className="text-accent">*</span>
          </label>
          <input id="title" name="title" required minLength={2} maxLength={MEETUP_LIMITS.title} defaultValue={v.title ?? initial.title} placeholder="예: 마포 아침 산책 모임" className={inputClass} />
        </div>
        {mode === "create" ? (
          <div>
            <label htmlFor="regionId" className={labelClass}>
              지역 (내 지역 가운데) <span className="text-accent">*</span>
            </label>
            <select key={v.regionId ?? ""} id="regionId" name="regionId" required defaultValue={v.regionId ?? (initial.regionId ? String(initial.regionId) : "")} className={inputClass}>
              <option value="">선택하세요</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.sidoName} {r.sigunguName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <span className={labelClass}>지역</span>
            <p className="mt-2 text-sm text-ink-soft">{regions.map((r) => `${r.sidoName} ${r.sigunguName}`).join(", ") || "-"} (지역은 바꿀 수 없어요)</p>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="meetingAt" className={labelClass}>
            다음 모임 일시
          </label>
          <input id="meetingAt" name="meetingAt" type="datetime-local" defaultValue={v.meetingAt ?? toMeetingInput(initial.meetingAt)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="placeText" className={labelClass}>
            만나는 곳
          </label>
          <input id="placeText" name="placeText" maxLength={MEETUP_LIMITS.place} defaultValue={v.placeText ?? initial.placeText ?? ""} placeholder="예: 월드컵공원 평화의 광장 (주소 대신 장소 이름)" className={inputClass} />
        </div>
        <div>
          <label htmlFor="capacity" className={labelClass}>
            정원
          </label>
          <input id="capacity" name="capacity" type="number" min={MEETUP_LIMITS.capacityMin} max={MEETUP_LIMITS.capacityMax} defaultValue={v.capacity ?? (initial.capacity ?? "")} placeholder="비우면 제한 없음" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="descriptionMd" className={labelClass}>
          소개
        </label>
        <textarea id="descriptionMd" name="descriptionMd" rows={6} maxLength={MEETUP_LIMITS.description} defaultValue={v.descriptionMd ?? initial.descriptionMd ?? ""} placeholder="어떤 모임인지, 어떤 아이들과 어울리는지, 준비물 등" className={inputClass} />
        <p className="mt-1 text-xs text-ink-faint">전화번호·집 주소 같은 개인정보는 적지 마세요. 약속은 참여 회원만 보는 게시판에서 잡으면 됩니다.</p>
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
        {pending ? "저장 중..." : mode === "create" ? "모임 만들기" : "저장"}
      </button>
    </form>
  );
}
