// 받은 요청 — 내 업체·내 전문가 프로필로 들어온 예약·상담. 확인·결제 확인·완료·취소와 채팅.
import Link from "next/link";
import { StatusActions, StatusChip } from "@/components/reservation/reservation-status";
import { formatDateTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listReceivedReservations } from "@/lib/queries/reservations";
import { RESERVATION_KIND_LABEL, chatOpen, slotLabel } from "@/lib/reservations";

export default async function MeReceivedPage() {
  const member = (await getCurrentMember())!;
  const rows = await listReceivedReservations(member.id);
  const open = rows.filter((x) => x.r.status === "new" || x.r.status === "confirmed" || x.r.status === "paid");
  return (
    <div>
      <h2 className="text-lg font-bold text-ink">받은 요청 {rows.length > 0 ? `${rows.length}건` : ""}</h2>
      <p className="mt-1 text-xs text-ink-faint">
        내 업체·돌봄 파트너 프로필·상담 프로필로 들어온 예약·상담입니다. 흐름: 확인 → 결제 안내 → 결제 확인(내가 또는 운영자가) → 채팅 → 완료. 신청자 연락처는 여기서만 보이며 다른 곳에 옮기지 마세요.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 받은 요청이 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {[...open, ...rows.filter((x) => !open.includes(x))].map(({ r, requesterNickname, hasConversation }) => (
            <li key={r.id} className={`rounded-xl border p-4 text-sm ${r.status === "new" ? "border-accent/30 bg-surface" : "border-line bg-surface"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">#{r.id}</span>
                <StatusChip status={r.status} />
                <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{RESERVATION_KIND_LABEL[r.kind]}</span>
                <span>{formatDateTime(r.createdAt)}</span>
                <Link href={`/reservations/${r.id}`} className="ml-auto font-medium text-sea hover:underline">
                  {hasConversation && chatOpen(r.status) ? "채팅 열기 →" : "자세히 →"}
                </Link>
              </div>
              <p className="mt-1.5 font-bold text-ink">
                {r.targetName} <span className="font-normal text-ink-soft">← {requesterNickname ?? r.requesterName}</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {r.slotStart && r.slotEnd ? slotLabel({ start: r.slotStart, end: r.slotEnd }) : r.preferredText ?? ""}
                {r.topic ? ` · ${r.topic}` : ""}
                {r.petNote ? ` · ${r.petNote}` : ""}
              </p>
              <div className="mt-2">
                <StatusActions id={r.id} status={r.status} role="provider" compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
