// 모임 페이지 — 비회원: 지역 집계와 안내만. 회원: 소개·참여. 참여 회원: 게시판. 주최자: 열기/마감·수정.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { joinMeetupAction, leaveMeetupAction, setMeetupStatusAction, deleteOwnMeetupPostAction } from "@/app/meetup-actions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MeetupPostForm } from "@/components/meetup/meetup-post-form";
import { ReactionButtons } from "@/components/reactions/reaction-buttons";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { getCurrentMember } from "@/lib/member";
import { capacityText, isFull, regionSummaryText } from "@/lib/meetups";
import { getMeetupBySlug, isMeetupMember, listMeetupCountsByRegion, listMeetupMembers, listMeetupPosts } from "@/lib/queries/meetups";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  // 회원 전용 화면 — 제목도 내보내지 않는다
  return { title: "펫모임", robots: robotsMeta(false) };
}

export default async function MeetupPage({ params, searchParams }: Props) {
  // 한글 슬러그는 퍼센트 인코딩된 채 들어온다
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const { created, updated } = await searchParams;
  const [meetup, member, admin] = await Promise.all([getMeetupBySlug(slug), getCurrentMember(), getSession()]);
  if (!meetup) notFound();
  if (meetup.hiddenAt && !admin) notFound();

  const crumbs = [
    { name: "홈", path: "/" },
    { name: "펫모임", path: "/meetup" },
    { name: `${meetup.regionLabel}`, path: `/meetup?region=${meetup.regionId}` },
  ];

  if (!member) {
    const counts = (await listMeetupCountsByRegion())[meetup.regionId] ?? { meetups: 0, participants: 0 };
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{meetup.regionLabel}의 펫모임</h1>
        <p className="mt-2 text-sm font-medium text-sea">{regionSummaryText(counts.meetups, counts.participants)}</p>
        <div className="mt-6 rounded-xl border border-line bg-sand/60 p-5 text-sm">
          <p className="font-semibold text-ink">이 모임은 회원에게만 보여요</p>
          <p className="mt-1 text-ink-soft">로그인하면 모임 소개를 보고 참여할 수 있어요. 게시판은 참여 회원에게만 열립니다.</p>
          <div className="mt-3 flex gap-2">
            <Link href={`/login?next=${encodeURIComponent(`/meetup/${slug}`)}`} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
              로그인
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(`/meetup/${slug}`)}`} className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink hover:bg-sand">
              가입하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [joined, members] = await Promise.all([isMeetupMember(meetup.id, member.id), listMeetupMembers(meetup.id)]);
  const isHost = meetup.hostUserId === member.id;
  const posts = joined ? await listMeetupPosts(meetup.id) : [];
  const full = isFull(meetup.memberCount, meetup.capacity);
  const closed = meetup.status === "closed";
  const description = meetup.descriptionMd ? renderMarkdown(meetup.descriptionMd, { ugc: true }) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={crumbs} />
      {created && <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">모임을 열었어요. 게시판에 첫 약속을 남겨 보세요.</p>}
      {updated && <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">저장했어요.</p>}
      {meetup.hiddenAt && <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-deep">관리자가 숨긴 모임입니다 (관리자에게만 보임).</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className={`rounded-full px-2 py-0.5 font-medium ${closed ? "bg-sand text-ink-faint" : full ? "bg-honey-soft text-honey" : "bg-sage-soft text-sage-deep"}`}>{closed ? "마감" : full ? "정원 참" : "모집 중"}</span>
        <Link href={`/meetup?region=${meetup.regionId}`} className="hover:underline">
          {meetup.regionLabel}
        </Link>
        <span>참여 {capacityText(meetup.memberCount, meetup.capacity)}</span>
        {meetup.hostName && <span>주최 {meetup.hostName}</span>}
        <span className="ml-auto">
          <ReactionButtons target="meetup" id={meetup.id} kinds={["save"]} nextPath={`/meetup/${slug}`} size="sm" />
        </span>
      </div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{meetup.title}</h1>
      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">다음 모임</dt>
          <dd className="text-ink">{meetup.meetingAt ? formatDateTime(meetup.meetingAt) : "아직 정하지 않음"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">만나는 곳</dt>
          <dd className="text-ink">{meetup.placeText ?? "게시판에서 정해요"}</dd>
        </div>
      </dl>
      {description && <div className="guide-prose prose prose-neutral mt-5 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: description.html }} />}

      {/* 참여 · 주최자 도구 */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {joined ? (
          <span className="rounded-full bg-sea-soft px-3 py-1.5 text-xs font-semibold text-sea">참여 중</span>
        ) : closed || full ? (
          <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-faint">{closed ? "마감된 모임" : "정원이 찼어요"}</span>
        ) : (
          <form action={joinMeetupAction}>
            <input type="hidden" name="id" value={meetup.id} />
            <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
              참여하기
            </button>
          </form>
        )}
        {joined && !isHost && (
          <form action={leaveMeetupAction}>
            <input type="hidden" name="id" value={meetup.id} />
            <button type="submit" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand">
              나가기
            </button>
          </form>
        )}
        {isHost && (
          <>
            <form action={setMeetupStatusAction}>
              <input type="hidden" name="id" value={meetup.id} />
              <input type="hidden" name="status" value={closed ? "open" : "closed"} />
              <button type="submit" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand">
                {closed ? "다시 열기" : "마감하기"}
              </button>
            </form>
            <Link href={`/meetup/${slug}/edit`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand">
              수정
            </Link>
          </>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold text-ink">참여 회원 {members.length}명</h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {members.map((m) => (
            <li key={m.userId} className={`rounded-full px-2.5 py-1 text-xs ${m.userId === meetup.hostUserId ? "bg-ink text-cream" : "bg-sand text-ink-soft"}`}>
              {m.name}
              {m.userId === meetup.hostUserId && " · 주최"}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">모임 게시판</h2>
        {joined ? (
          <>
            <p className="mt-1 text-xs text-ink-faint">참여 회원에게만 보입니다. 약속·후기·질문을 자유롭게 남기세요.</p>
            <div className="mt-3">
              <MeetupPostForm meetupId={meetup.id} />
            </div>
            {posts.length === 0 ? (
              <p className="mt-4 text-sm text-ink-faint">아직 글이 없어요.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
                {posts.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span className="font-semibold text-ink">{p.authorName}</span>
                      <span>{formatDateTime(p.createdAt)}</span>
                      {p.userId === member.id && (
                        <form action={deleteOwnMeetupPostAction} className="ml-auto">
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="text-ink-faint hover:text-accent-deep">
                            삭제
                          </button>
                        </form>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">{p.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line p-5 text-sm text-ink-faint">게시판은 참여 회원에게만 보여요. 참여하면 약속과 후기를 볼 수 있어요.</p>
        )}
      </section>
    </div>
  );
}
