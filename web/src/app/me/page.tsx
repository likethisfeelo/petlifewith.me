import type { Metadata } from "next";
import Link from "next/link";
import { deleteMemberPostAction } from "@/app/member-actions";
import { MeetupCard } from "@/components/meetup/meetup-card";
import { MyRegionsForm } from "@/components/meetup/my-regions-form";
import { MEETUP_LIMITS } from "@/lib/meetups";
import { listMeetupsForUser } from "@/lib/queries/meetups";
import { listMyPosts } from "@/lib/queries/members";
import { listRegionOptions } from "@/lib/queries/requests";
import { GUIDE_STATUS_LABEL, formatDate } from "@/lib/format";
import { requireMember } from "@/lib/member";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 정보",
  robots: { index: false, follow: false },
};

const STATUS_STYLE: Record<string, string> = {
  published: "bg-sage-soft text-sage-deep",
  pending: "bg-honey-soft text-honey",
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ submitted?: string; deleted?: string; published?: string }> }) {
  const member = await requireMember("/me");
  const { submitted, deleted, published } = await searchParams;
  const [posts, mine, regionOptions] = await Promise.all([listMyPosts(member.id), listMeetupsForUser(member.id), listRegionOptions()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{member.displayName}</h1>
      <p className="mt-1 text-sm text-ink-soft">{member.email}</p>

      {submitted && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">
          글을 받았습니다. 관리자가 확인한 뒤 공개됩니다 — 보통 며칠 안에 처리됩니다.
        </p>
      )}
      {deleted && <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">글을 삭제했습니다.</p>}
      {published && <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">글이 게시되었습니다. 아래 목록에서 바로 볼 수 있습니다.</p>}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink">내 글 {posts.length > 0 ? `${posts.length}편` : ""}</h2>
          <Link href="/write" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
            + 새 글
          </Link>
        </div>
        {posts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            아직 쓴 글이 없습니다. 우리 개의 변화, 해봤던 것, 도움이 됐던 것을 나눠 주세요.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {posts.map(({ guide, topicName }) => (
              <li key={guide.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[guide.status] ?? "bg-sand text-ink-soft"}`}>
                  {GUIDE_STATUS_LABEL[guide.status] ?? guide.status}
                </span>
                <span className="font-medium text-ink">{guide.title}</span>
                <span className="text-xs text-ink-faint">
                  {topicName} · {formatDate(guide.updatedAt)}
                </span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  {guide.status === "published" && (
                    <Link href={`/guide/${guide.slug}`} className="text-sea hover:underline">
                      보기
                    </Link>
                  )}
                  {(guide.status === "pending" || guide.status === "published") && (
                    <Link href={`/write/${guide.id}`} className="text-ink-soft hover:underline">
                      수정
                    </Link>
                  )}
                  {guide.status === "pending" && (
                    <form action={deleteMemberPostAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button type="submit" className="text-ink-faint hover:text-accent-deep">
                        삭제
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="regions" className="mt-10 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">내 지역 (펫모임, 최대 {MEETUP_LIMITS.regions}곳)</h2>
          <Link href="/meetup" className="text-xs font-medium text-sea hover:underline">
            펫모임으로 →
          </Link>
        </div>
        <div className="mt-3">
          <MyRegionsForm regions={regionOptions} current={mine.regionIds} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-ink">참여 중인 모임 {mine.joined.length > 0 ? `${mine.joined.length}개` : ""}</h2>
        {mine.joined.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            아직 참여한 모임이 없어요.{" "}
            <Link href="/meetup" className="font-medium text-sea hover:underline">
              내 지역의 모임 보기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.joined.map((m) => (
              <MeetupCard key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">닉네임</h2>
          <div className="mt-3">
            <ProfileForm displayName={member.displayName} />
          </div>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">비밀번호</h2>
          <div className="mt-3">
            <PasswordForm />
          </div>
        </section>
      </div>
    </div>
  );
}
