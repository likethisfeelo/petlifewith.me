// 모임 요약 카드 — 회원 화면(지역 목록·내 모임). 링크는 모임 페이지.
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { capacityText, isFull } from "@/lib/meetups";
import type { MeetupSummary } from "@/lib/queries/meetups";

export function MeetupCard({ m, showRegion = true }: { m: MeetupSummary; showRegion?: boolean }) {
  const closed = m.status === "closed";
  const full = isFull(m.memberCount, m.capacity);
  return (
    <li>
      <Link href={`/meetup/${m.slug}`} className={`block rounded-xl border p-4 transition-colors hover:border-sea/60 ${closed ? "border-line bg-surface/60" : "border-line bg-surface"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className={`rounded-full px-2 py-0.5 font-medium ${closed ? "bg-sand text-ink-faint" : full ? "bg-honey-soft text-honey" : "bg-sage-soft text-sage-deep"}`}>{closed ? "마감" : full ? "정원 참" : "모집 중"}</span>
          {showRegion && <span>{m.regionLabel}</span>}
          <span>참여 {capacityText(m.memberCount, m.capacity)}</span>
          {m.hostName && <span>주최 {m.hostName}</span>}
        </div>
        <p className="mt-1.5 text-base font-bold text-ink">{m.title}</p>
        {(m.meetingAt || m.placeText) && (
          <p className="mt-1 text-xs text-ink-soft">
            {m.meetingAt && <span>{formatDateTime(m.meetingAt)}</span>}
            {m.meetingAt && m.placeText && " · "}
            {m.placeText && <span>{m.placeText}</span>}
          </p>
        )}
      </Link>
    </li>
  );
}
