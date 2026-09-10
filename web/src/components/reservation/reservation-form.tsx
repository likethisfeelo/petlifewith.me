"use client";

// 예약·상담 요청 폼 — 업체·돌봄 파트너(spotId) 또는 전문가(expertId). 로그인 회원만 (서버 액션이 다시 확인한다).
// 전문가는 시간 예약(빈 슬롯 고르기) 또는 연락받기(희망 시간대 적기).
import { useActionState, useState } from "react";
import { createReservationAction, type ReservationActionState } from "@/app/reservation-actions";
import { RESERVATION_LIMITS, slotLabel, type SlotWindow } from "@/lib/reservations";

const inputClass = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
const labelClass = "block text-sm font-medium text-ink";

export interface SlotOption {
  startMs: number;
  endMs: number;
}

export function ReservationForm({
  target,
  defaultName,
  nextPath,
  slots,
  consult = false,
}: {
  target: { spotId?: number; expertId?: number; name: string };
  defaultName: string;
  nextPath: string;
  /** 전문가: 고를 수 있는 시간 창 */
  slots?: SlotOption[];
  consult?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ReservationActionState, FormData>(createReservationAction, {});
  const v = state.values ?? {};
  const [mode, setMode] = useState<"slot" | "callback">(v.mode === "callback" || !(slots && slots.length > 0) ? "callback" : "slot");
  const windows: SlotWindow[] = (slots ?? []).map((s) => ({ start: new Date(s.startMs), end: new Date(s.endMs) }));

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {target.spotId && <input type="hidden" name="spotId" value={target.spotId} />}
      {target.expertId && <input type="hidden" name="expertId" value={target.expertId} />}
      <input type="hidden" name="nextPath" value={nextPath} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {consult && (
        <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-bold text-ink">상담 방식</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${mode === "slot" ? "border-ink bg-sand" : "border-line bg-cream/40"} ${windows.length === 0 ? "opacity-50" : ""}`}>
              <input type="radio" name="mode" value="slot" checked={mode === "slot"} disabled={windows.length === 0} onChange={() => setMode("slot")} className="mt-0.5" />
              <span>
                <span className="font-bold text-ink">상담 시간 예약</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{windows.length > 0 ? "앞으로 2주 안의 빈 시간을 고릅니다" : "지금은 열린 시간이 없어요"}</span>
              </span>
            </label>
            <label className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${mode === "callback" ? "border-ink bg-sand" : "border-line bg-cream/40"}`}>
              <input type="radio" name="mode" value="callback" checked={mode === "callback"} onChange={() => setMode("callback")} className="mt-0.5" />
              <span>
                <span className="font-bold text-ink">연락받기</span>
                <span className="mt-0.5 block text-xs text-ink-soft">편한 시간대를 적으면 확인 뒤 연락드려요</span>
              </span>
            </label>
          </div>
          {mode === "slot" && windows.length > 0 && (
            <div>
              <label htmlFor="slotStart" className={labelClass}>
                시간 고르기 <span className="text-accent">*</span>
              </label>
              <select id="slotStart" name="slotStart" required defaultValue={v.slotStart ?? ""} className={inputClass}>
                <option value="">선택하세요</option>
                {windows.map((w) => (
                  <option key={w.start.getTime()} value={w.start.getTime()}>
                    {slotLabel(w)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="topic" className={labelClass}>
              상담 주제
            </label>
            <input id="topic" name="topic" maxLength={RESERVATION_LIMITS.topic} defaultValue={v.topic} placeholder="예: 밤에 자꾸 깨서 짖어요 · 관절이 약한 아이 산책" className={inputClass} />
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-bold text-ink">{consult ? "우리 아이와 희망 일정" : "예약 내용"}</legend>
        <div>
          <label htmlFor="petNote" className={labelClass}>
            반려동물 정보
          </label>
          <input id="petNote" name="petNote" maxLength={RESERVATION_LIMITS.petNote} defaultValue={v.petNote} placeholder="이름·나이·특이사항 (예: 몽이, 13살, 관절이 약해요)" className={inputClass} />
        </div>
        {(!consult || mode === "callback") && (
          <div>
            <label htmlFor="preferredText" className={labelClass}>
              희망 일정{consult ? " (연락받기)" : ""} {consult && mode === "callback" && <span className="text-accent">*</span>}
            </label>
            <input id="preferredText" name="preferredText" required={consult && mode === "callback"} maxLength={RESERVATION_LIMITS.preferred} defaultValue={v.preferredText} placeholder="예: 9/15 오후, 매주 화·목 저녁" className={inputClass} />
          </div>
        )}
        <div>
          <label htmlFor="message" className={labelClass}>
            요청 내용
          </label>
          <textarea id="message" name="message" rows={4} maxLength={RESERVATION_LIMITS.message} defaultValue={v.message} placeholder={consult ? "지금 상황, 궁금한 점. 진단·처방은 상담 범위가 아니며 응급 상황은 병원으로 가세요." : "원하는 서비스, 아이가 힘들어하는 것 등"} className={inputClass} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-line bg-sand/40 p-4">
        <legend className="px-1 text-sm font-bold text-ink">연락받을 분</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="requesterName" className={labelClass}>
              이름 <span className="text-accent">*</span>
            </label>
            <input id="requesterName" name="requesterName" required maxLength={RESERVATION_LIMITS.name} defaultValue={v.requesterName ?? defaultName} className={inputClass} />
          </div>
          <div>
            <label htmlFor="contact" className={labelClass}>
              연락처 (전화 · 카카오톡 ID) <span className="text-accent">*</span>
            </label>
            <input id="contact" name="contact" required minLength={5} maxLength={RESERVATION_LIMITS.contact} defaultValue={v.contact} placeholder="010-0000-0000" className={inputClass} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-0.5" />
          <span>이름·연락처를 운영자와 {target.name}에게 예약·상담 연결 목적으로만 전달하는 데 동의합니다. 결제는 확인 뒤 안내하며, 결제 확인 뒤 서비스 안 채팅이 열립니다.</span>
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
        {pending ? "보내는 중..." : consult ? "상담 신청 보내기" : "예약 요청 보내기"}
      </button>
    </form>
  );
}
