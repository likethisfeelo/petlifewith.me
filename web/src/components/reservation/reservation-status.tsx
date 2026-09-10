// 예약·상담 상태 배지 + 역할별 상태 버튼 (서버 컴포넌트 — 폼은 서버 액션으로 바로 간다)
import { setReservationStatusAction } from "@/app/reservation-actions";
import { RESERVATION_STATUS_LABEL, type ReservationStatus } from "@/lib/reservations";
import type { ReservationRole } from "@/lib/queries/reservations";

const CHIP: Record<ReservationStatus, string> = {
  new: "bg-accent-soft text-accent-deep",
  confirmed: "bg-sea-soft text-sea",
  paid: "bg-sage-soft text-sage-deep",
  done: "bg-sand text-ink-soft",
  cancelled: "bg-sand text-ink-faint",
};

export function StatusChip({ status }: { status: ReservationStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[status]}`}>{RESERVATION_STATUS_LABEL[status]}</span>;
}

/** 역할에 따라 가능한 다음 단계 버튼 */
export function StatusActions({ id, status, role, compact = false }: { id: number; status: ReservationStatus; role: ReservationRole; compact?: boolean }) {
  const btn = (next: ReservationStatus, label: string, primary = false) => (
    <form key={next} action={setReservationStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button type="submit" className={`rounded-full font-semibold ${compact ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-xs"} ${primary ? "bg-ink text-cream hover:opacity-90" : "border border-line bg-surface text-ink-soft hover:bg-sand"}`}>
        {label}
      </button>
    </form>
  );
  const items: React.ReactNode[] = [];
  if (role === "requester") {
    if (status === "new" || status === "confirmed") items.push(btn("cancelled", "요청 취소"));
  } else {
    if (status === "new") items.push(btn("confirmed", "확인 · 결제 안내", true), btn("paid", "결제 확인 (바로)"), btn("cancelled", "거절"));
    if (status === "confirmed") items.push(btn("paid", "결제 확인 → 채팅 열기", true), btn("cancelled", "취소"));
    if (status === "paid") items.push(btn("done", "완료로 표시", true), btn("cancelled", "취소"));
  }
  if (items.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{items}</div>;
}
