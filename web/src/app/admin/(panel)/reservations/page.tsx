import Link from "next/link";
import { saveReservationNoteAction } from "@/app/reservation-actions";
import { StatusActions, StatusChip } from "@/components/reservation/reservation-status";
import { slackRequestsWebhookUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { listReservationsAdmin } from "@/lib/queries/reservations";
import { RESERVATION_KIND_LABEL, RESERVATION_STATUSES, RESERVATION_STATUS_LABEL, chatOpen, isExpertKind, slotLabel, EXPERT_KIND_LABEL } from "@/lib/reservations";
import { AdminPageHeader } from "../../_components/fields";

// 예약·상담 — 업체·돌봄 파트너 예약 요청과 전문가 상담 신청. 제공자 계정이 없으면 운영자가 확인·결제 확인·채팅을 대신한다.

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = (RESERVATION_STATUSES as readonly string[]).includes(status ?? "") ? (status as (typeof RESERVATION_STATUSES)[number]) : null;
  const rows = await listReservationsAdmin(filter);
  const slackOn = Boolean(slackRequestsWebhookUrl());

  return (
    <div>
      <AdminPageHeader
        title="예약·상담"
        description="흐름: 요청 → 확인(결제 안내) → 결제 확인(제공자 또는 운영자, 수동) → 채팅 → 완료. 신청자 이름·연락처는 이 화면과 슬랙에만. PG 연동 전까지 결제는 계좌·링크 안내로."
      />
      <p className="mt-3 text-xs text-ink-faint">
        표시 {rows.length}건 · 슬랙 알림 {slackOn ? "켜짐" : "꺼짐 (웹훅 미설정 — 저장만 됨)"}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <Link href="/admin/reservations" className={`rounded-full px-3 py-1 font-medium ${!filter ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
          전체
        </Link>
        {RESERVATION_STATUSES.map((s) => (
          <Link key={s} href={`/admin/reservations?status=${s}`} className={`rounded-full px-3 py-1 font-medium ${filter === s ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {RESERVATION_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">해당하는 요청이 없습니다.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map(({ r, requesterNickname, providerNickname, targetPath, hasConversation }) => (
            <li key={r.id} className={`rounded-xl border p-4 text-sm ${r.status === "new" ? "border-accent/30 bg-surface" : "border-line bg-surface"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">#{r.id}</span>
                <StatusChip status={r.status} />
                <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{RESERVATION_KIND_LABEL[r.kind]}</span>
                {r.serviceKind && isExpertKind(r.serviceKind) && <span>{EXPERT_KIND_LABEL[r.serviceKind]}</span>}
                <span>{formatDateTime(r.createdAt)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.slackSentAt ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>{r.slackSentAt ? "슬랙 전송됨" : "슬랙 미전송"}</span>
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
                <span className="font-normal text-ink-soft">
                  {" "}
                  ← {requesterNickname ?? "(비회원)"} · 담당 {providerNickname ?? "운영자"}
                </span>
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-ink-faint">신청자 (비공개)</dt>
                  <dd className="text-ink">
                    {r.requesterName} · {r.contact}
                  </dd>
                </div>
                {(r.slotStart || r.preferredText) && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">일정</dt>
                    <dd className="text-ink">{r.slotStart && r.slotEnd ? slotLabel({ start: r.slotStart, end: r.slotEnd }) : r.preferredText}</dd>
                  </div>
                )}
                {r.topic && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">주제</dt>
                    <dd className="text-ink">{r.topic}</dd>
                  </div>
                )}
                {r.petNote && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">반려동물</dt>
                    <dd className="text-ink">{r.petNote}</dd>
                  </div>
                )}
                {r.paidAt && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-faint">결제 확인</dt>
                    <dd className="text-ink">
                      {formatDateTime(r.paidAt)} · {r.paidBy === "admin" ? "운영자" : "제공자"}
                    </dd>
                  </div>
                )}
              </dl>
              {r.message && <p className="mt-2 whitespace-pre-line rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">{r.message}</p>}
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <StatusActions id={r.id} status={r.status} role="admin" compact />
                <form action={saveReservationNoteAction} className="ml-auto flex w-full items-start gap-1.5 sm:w-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <textarea name="adminNote" rows={1} defaultValue={r.adminNote ?? ""} placeholder="운영 메모 (안내한 결제 방법 등)" className="w-full min-w-[14rem] rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-ink" />
                  <button type="submit" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-sand">
                    메모
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
