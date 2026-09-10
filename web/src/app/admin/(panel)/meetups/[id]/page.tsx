import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { getMeetupById, listMeetupMembers, listMeetupPosts } from "@/lib/queries/meetups";
import { AdminPageHeader } from "../../../_components/fields";
import { toggleMeetupHiddenAction, toggleMeetupPostHiddenAction } from "../../../meetup-actions";

export default async function AdminMeetupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meetupId = Number(id);
  if (!Number.isSafeInteger(meetupId)) notFound();
  const meetup = await getMeetupById(meetupId);
  if (!meetup) notFound();
  const [members, posts] = await Promise.all([listMeetupMembers(meetupId), listMeetupPosts(meetupId, { includeHidden: true })]);

  return (
    <div>
      <AdminPageHeader
        title={meetup.title}
        description={`${meetup.regionLabel} · 주최 ${meetup.hostName ?? "(탈퇴)"} · ${meetup.status === "open" ? "열림" : "마감"}${meetup.hiddenAt ? " · 숨김" : ""}`}
        right={
          <Link href={`/meetup/${meetup.slug}`} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        }
      />
      <form action={toggleMeetupHiddenAction} className="mt-4">
        <input type="hidden" name="id" value={meetup.id} />
        <button type="submit" className={`rounded-full px-4 py-1.5 text-xs font-semibold ${meetup.hiddenAt ? "bg-sand text-ink-soft" : "bg-ink text-white"}`}>
          {meetup.hiddenAt ? "모임 숨김 해제" : "모임 숨기기"}
        </button>
      </form>
      {meetup.descriptionMd && <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 text-sm text-ink">{meetup.descriptionMd}</pre>}

      <h2 className="mt-6 text-sm font-bold text-ink">참여 회원 {members.length}명</h2>
      <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {members.map((m) => (
          <li key={m.userId} className="rounded-full bg-sand px-2.5 py-1 text-ink-soft">
            {m.name}
            {m.userId === meetup.hostUserId && " · 주최"}
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-sm font-bold text-ink">게시판 {posts.length}건</h2>
      {posts.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">글이 없습니다.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
          {posts.map((p) => (
            <li key={p.id} className={`px-4 py-3 text-sm ${p.hiddenAt ? "bg-accent-soft/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">{p.authorName}</span>
                <span>{formatDateTime(p.createdAt)}</span>
                {p.hiddenAt && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-deep">숨김</span>}
                <form action={toggleMeetupPostHiddenAction} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs font-medium text-ink-soft hover:text-ink">
                    {p.hiddenAt ? "숨김 해제" : "숨기기"}
                  </button>
                </form>
              </div>
              <p className="mt-1 whitespace-pre-line text-ink">{p.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
