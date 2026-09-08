import Link from "next/link";
import { desc } from "drizzle-orm";
import { carePersonLabel } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { slackBookingWebhookUrl } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";
import { toggleBookingHandledAction } from "../../actions";

const { bookingRequests } = schema;

// 예약 신청 목록 — 프로세스는 최소: 슬랙으로 받은 것을 여기서 다시 보고 "처리됨"만 표시한다.
// 신청자 이름·연락처는 개인정보: 이 화면(관리자)에만 보인다.

export default async function AdminBookingsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const rows = await getDb().select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt)).limit(200);
  const open = rows.filter((r) => !r.handledAt).length;
  const slackOn = Boolean(slackBookingWebhookUrl());

  return (
    <div>
      <AdminPageHeader
        title="예약 신청"
        description="돌봄 파트너 카드의 '예약 신청'으로 들어온 요청입니다. 슬랙 알림을 받은 뒤 파트너에게 연결하고 처리됨으로 표시하세요. 연락처는 연결 목적으로만 씁니다."
      />
      <p className="mt-3 text-xs text-ink-faint">
        미처리 {open}건 · 최근 {rows.length}건 표시 · 슬랙 알림 {slackOn ? "켜짐" : "꺼짐 (SLACK_BOOKING_WEBHOOK_URL 미설정 — 저장만 됨)"}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 들어온 신청이 없습니다.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border p-4 text-sm ${r.handledAt ? "border-line bg-surface/60" : "border-accent/30 bg-surface"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">#{r.id}</span>
                <span>{formatDate(r.createdAt)}</span>
                <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{carePersonLabel(r.serviceKind)}</span>
                {r.spotId ? (
                  <Link href={`/admin/spots/${r.spotId}`} className="font-medium text-ink hover:underline">
                    {r.spotName}
                  </Link>
                ) : (
                  <span className="text-ink">{r.spotName} (삭제됨)</span>
                )}
                {r.areaLabel && <span>· {r.areaLabel}</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.slackSentAt ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>
                  {r.slackSentAt ? "슬랙 전송됨" : "슬랙 미전송"}
                </span>
                <form action={toggleBookingHandledAction} className="ml-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={`rounded-full px-3 py-1 text-xs font-semibold ${r.handledAt ? "bg-sand text-ink-soft" : "bg-ink text-white"}`}>
                    {r.handledAt ? "처리됨 · 되돌리기" : "처리됨으로 표시"}
                  </button>
                </form>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div className="flex gap-2"><dt className="shrink-0 text-ink-faint">신청자</dt><dd className="text-ink">{r.requesterName}</dd></div>
                <div className="flex gap-2"><dt className="shrink-0 text-ink-faint">연락처</dt><dd className="text-ink">{r.contact}</dd></div>
                {r.petNote && <div className="flex gap-2"><dt className="shrink-0 text-ink-faint">반려견</dt><dd className="text-ink">{r.petNote}</dd></div>}
                {r.preferredDate && <div className="flex gap-2"><dt className="shrink-0 text-ink-faint">희망 일정</dt><dd className="text-ink">{r.preferredDate}</dd></div>}
                {r.message && <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 text-ink-faint">요청</dt><dd className="whitespace-pre-wrap text-ink">{r.message}</dd></div>}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
