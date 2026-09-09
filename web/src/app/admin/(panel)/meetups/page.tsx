import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { listMeetupsAdmin } from "@/lib/queries/meetups";
import { AdminPageHeader } from "../../_components/fields";
import { toggleMeetupHiddenAction } from "../../meetup-actions";

// 펫모임 — 승인 없이 열리므로 여기서는 보고 숨길 뿐이다. 모임 안 게시글은 [id] 에서.

export default async function AdminMeetupsPage() {
  const rows = await listMeetupsAdmin();
  const open = rows.filter((r) => r.status === "open" && !r.hiddenAt).length;
  return (
    <div>
      <AdminPageHeader
        title="펫모임"
        description="회원이 직접 여는 모임입니다 (승인 없음, 새 모임은 슬랙 알림). 문제가 있는 모임·게시글은 숨기세요 — 숨기면 참여 회원에게도 보이지 않습니다."
      />
      <p className="mt-3 text-xs text-ink-faint">
        전체 {rows.length}개 · 열림 {open}개
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 모임이 없습니다.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((m) => (
            <li key={m.id} className={`rounded-xl border p-4 text-sm ${m.hiddenAt ? "border-accent/30 bg-accent-soft/40" : "border-line bg-surface"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">#{m.id}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${m.status === "open" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>{m.status === "open" ? "열림" : "마감"}</span>
                {m.hiddenAt && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-deep">숨김 {formatDate(m.hiddenAt)}</span>}
                <span>{m.regionLabel}</span>
                <span>주최 {m.hostName ?? "(탈퇴)"}</span>
                <span>참여 {m.memberCount}명 · 글 {m.postCount}건</span>
                <span>{formatDate(m.createdAt)}</span>
                <form action={toggleMeetupHiddenAction} className="ml-auto">
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className={`rounded-full px-3 py-1 text-xs font-semibold ${m.hiddenAt ? "bg-sand text-ink-soft" : "bg-ink text-white"}`}>
                    {m.hiddenAt ? "숨김 해제" : "숨기기"}
                  </button>
                </form>
              </div>
              <p className="mt-2 font-bold text-ink">
                <Link href={`/admin/meetups/${m.id}`} className="hover:underline">
                  {m.title}
                </Link>
                <Link href={`/meetup/${m.slug}`} className="ml-2 text-xs font-medium text-sea hover:underline">
                  공개 페이지 →
                </Link>
              </p>
              {(m.meetingAt || m.placeText) && (
                <p className="mt-1 text-xs text-ink-soft">
                  {m.meetingAt ? formatDateTime(m.meetingAt) : ""}
                  {m.meetingAt && m.placeText ? " · " : ""}
                  {m.placeText ?? ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
