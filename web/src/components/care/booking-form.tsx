"use client";

// 돌봄 파트너 카드의 행동 줄 — [예약 신청] [카카오톡 상담] [자세히].
// 예약 신청은 같은 카드 안에서 펼쳐지는 짧은 폼 → 서버 액션(저장 + 슬랙 알림).
import Link from "next/link";
import { useActionState, useState } from "react";
import { createBookingRequestAction, type BookingActionState } from "@/app/booking-actions";
import { BOOKING_LIMITS } from "@/lib/booking";

const inputClass = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-ink";

export function CareActions({
  spotId,
  spotName,
  regionId,
  personLabel,
  kakaoUrl,
  detailHref,
}: {
  spotId: number;
  spotName: string;
  regionId: number | null;
  personLabel: string;
  kakaoUrl: string | null;
  detailHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<BookingActionState, FormData>(createBookingRequestAction, {});
  const v = state.values ?? {};

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {state.saved ? (
          <span className="rounded-full bg-sage-soft px-3 py-1.5 text-xs font-semibold text-sage-deep">예약 신청 접수됨</span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              open ? "bg-ink text-white" : "bg-accent text-white hover:bg-accent-deep"
            }`}
          >
            예약 신청
          </button>
        )}
        {kakaoUrl ? (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-full bg-[#fae100] px-3.5 py-1.5 text-xs font-semibold text-[#3c1e1e] hover:bg-[#f2d900]"
          >
            카카오톡 상담
          </a>
        ) : (
          <span className="rounded-full border border-dashed border-line px-3.5 py-1.5 text-xs text-ink-faint" title="카카오톡 채널이 아직 등록되지 않았습니다">
            카카오톡 상담 준비 중
          </span>
        )}
        {detailHref && (
          <Link href={detailHref} className="ml-auto text-xs font-medium text-sea hover:underline">
            자세히 →
          </Link>
        )}
      </div>

      {state.saved && (
        <p className="mt-2 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-xs leading-relaxed text-sage-deep">
          접수되었습니다. 운영자가 확인한 뒤 남겨 주신 연락처로 {personLabel} 예약을 연결해 드립니다.
        </p>
      )}

      {open && !state.saved && (
        <form action={formAction} className="mt-3 space-y-2.5 rounded-xl border border-line bg-sand/50 p-3">
          <input type="hidden" name="spotId" value={spotId} />
          {regionId && <input type="hidden" name="regionId" value={regionId} />}
          {/* 봇 함정 — 사람은 보지 못한다 */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <p className="text-xs font-semibold text-ink">
            {spotName} · {personLabel} 예약 신청
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-ink-soft">
              이름 <span className="text-accent">*</span>
              <input name="requesterName" required maxLength={BOOKING_LIMITS.name} defaultValue={v.requesterName} className={`${inputClass} mt-1`} />
            </label>
            <label className="text-xs text-ink-soft">
              연락처 (전화 또는 카카오톡 ID) <span className="text-accent">*</span>
              <input name="contact" required maxLength={BOOKING_LIMITS.contact} defaultValue={v.contact} placeholder="010-0000-0000" className={`${inputClass} mt-1`} />
            </label>
            <label className="text-xs text-ink-soft">
              반려견 정보
              <input name="petNote" maxLength={BOOKING_LIMITS.petNote} defaultValue={v.petNote} placeholder="이름·나이·특이사항 (예: 몽이, 13살, 관절이 약해요)" className={`${inputClass} mt-1`} />
            </label>
            <label className="text-xs text-ink-soft">
              희망 일정
              <input name="preferredDate" maxLength={BOOKING_LIMITS.preferredDate} defaultValue={v.preferredDate} placeholder="예: 9/15 오후, 매주 화·목 저녁" className={`${inputClass} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-ink-soft">
            요청 내용
            <textarea name="message" rows={3} maxLength={BOOKING_LIMITS.message} defaultValue={v.message} placeholder="원하는 돌봄 방식, 아이가 힘들어하는 것 등" className={`${inputClass} mt-1`} />
          </label>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft">
            <input type="checkbox" name="consent" required className="mt-0.5" />
            <span>
              이름·연락처를 펫라이프위드미 운영자와 이 {personLabel}에게 예약 연결 목적으로만 전달하는 데 동의합니다. 연결이 끝나면 별도로
              보관하지 않습니다.
            </span>
          </label>
          {state.error && <p className="text-xs font-medium text-accent-deep">{state.error}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {pending ? "보내는 중..." : "신청 보내기"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-faint hover:text-ink">
              닫기
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
