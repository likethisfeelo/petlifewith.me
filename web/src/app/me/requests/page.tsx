// 신청·연락 내역 — 요청함에 보낸 요청(업체 등록·정보 관리·상단 노출·파트너 등록)과 연락한 업체.
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listContactLogs } from "@/lib/queries/reactions";
import { listMyReservations } from "@/lib/queries/reservations";
import { StatusActions, StatusChip } from "@/components/reservation/reservation-status";
import { RESERVATION_KIND_LABEL, chatOpen, slotLabel } from "@/lib/reservations";
import { listMyServiceRequests } from "@/lib/queries/requests";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, type RequestStatus } from "@/lib/requests";

const STATUS_CHIP: Record<RequestStatus, string> = {
  new: "bg-accent-soft text-accent-deep",
  in_progress: "bg-sea-soft text-sea",
  done: "bg-sage-soft text-sage-deep",
  rejected: "bg-sand text-ink-soft",
};

export default async function MeRequestsPage() {
  const member = (await getCurrentMember())!;
  const [requests, contacts, reservations] = await Promise.all([listMyServiceRequests(member.id), listContactLogs(member.id), listMyReservations(member.id)]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-ink">내 예약·상담 {reservations.length > 0 ? `${reservations.length}건` : ""}</h2>
        <p className="mt-1 text-xs text-ink-faint">업체·돌봄 파트너 예약 요청과 온라인 상담 신청입니다. 확인 → 결제 안내 → 결제 확인 → 채팅 → 완료 순서로 진행돼요.</p>
        {reservations.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            아직 예약·상담이 없어요.{" "}
            <Link href="/consult" className="font-medium text-sea hover:underline">
              온라인 상담 보기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reservations.map(({ r, providerNickname, targetPath, hasConversation }) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
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
                  {targetPath ? (
                    <Link href={targetPath} className="hover:underline">
                      {r.targetName}
                    </Link>
                  ) : (
                    r.targetName
                  )}
                  {providerNickname && <span className="font-normal text-ink-soft"> · 담당 {providerNickname}</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {r.slotStart && r.slotEnd ? slotLabel({ start: r.slotStart, end: r.slotEnd }) : r.preferredText ?? ""}
                  {r.topic ? ` · ${r.topic}` : ""}
                </p>
                <div className="mt-2">
                  <StatusActions id={r.id} status={r.status} role="requester" compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink">보낸 요청 {requests.length > 0 ? `${requests.length}건` : ""}</h2>
        <p className="mt-1 text-xs text-ink-faint">업체 등록·정보 관리·지역 상단 노출·돌봄 파트너 등록 요청의 처리 상태입니다. 운영자가 확인하면 남긴 연락처로 안내합니다.</p>
        {requests.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            보낸 요청이 없어요.{" "}
            <Link href="/me/business#add" className="font-medium text-sea hover:underline">
              업체·브랜드 등록하기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                <span className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea">{REQUEST_KIND_LABEL[r.kind]}</span>
                <span className="text-ink">{r.summary}</span>
                {r.targetPath && (
                  <Link href={r.targetPath} className="text-xs text-sea hover:underline">
                    페이지 →
                  </Link>
                )}
                <span className="ml-auto text-xs text-ink-faint">{formatDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink">연락한 업체·브랜드</h2>
        <p className="mt-1 text-xs text-ink-faint">업체 페이지의 연락하기(홈페이지·카카오톡·인스타그램)를 누른 기록입니다. 예약·문의는 업체 채널에서 이어 가세요.</p>
        {contacts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 연락한 업체가 없어요.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Link href={c.path} className="font-medium text-ink hover:underline">
                  {c.name}
                </Link>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-sand">
                    {c.channelLabel} 다시 열기 ↗
                  </a>
                ) : (
                  <span className="text-xs text-ink-faint">{c.channelLabel}</span>
                )}
                <span className="ml-auto text-xs text-ink-faint">{formatDateTime(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
