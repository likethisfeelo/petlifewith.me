// 내 페이지 개요 — 숫자 요약 + 바로가기 + 최근 글 + 내 업체·브랜드 + 저장.
import Link from "next/link";
import { GUIDE_STATUS_LABEL, formatDate } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listMeetupsForUser } from "@/lib/queries/meetups";
import { listMyPosts } from "@/lib/queries/members";
import { countMyPosts, listOwnedMakers, listOwnedSpots } from "@/lib/queries/owner";
import { countSavedByUser, listSaved } from "@/lib/queries/reactions";
import { listMyServiceRequests } from "@/lib/queries/requests";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from "@/lib/requests";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-sage-soft text-sage-deep",
  pending: "bg-honey-soft text-honey",
};

export default async function MeOverviewPage({ searchParams }: { searchParams: Promise<{ submitted?: string; deleted?: string; published?: string }> }) {
  const member = (await getCurrentMember())!;
  const { submitted, deleted, published } = await searchParams;
  const [postCounts, posts, spots, makers, savedCount, saved, requests, meetups] = await Promise.all([
    countMyPosts(member.id),
    listMyPosts(member.id),
    listOwnedSpots(member.id),
    listOwnedMakers(member.id),
    countSavedByUser(member.id),
    listSaved(member.id),
    listMyServiceRequests(member.id),
    listMeetupsForUser(member.id),
  ]);
  const openRequests = requests.filter((r) => r.status === "new" || r.status === "in_progress");
  const itemCount = makers.reduce((a, m) => a + m.itemCount, 0);

  const stats: Array<{ label: string; value: number; href: string }> = [
    { label: "내 글", value: postCounts.total, href: "/me/posts" },
    { label: "내 업체·브랜드", value: spots.length + makers.length, href: "/me/business" },
    { label: "내 상품", value: itemCount, href: "/me/business" },
    { label: "저장", value: savedCount, href: "/me/saved" },
    { label: "진행 중 신청", value: openRequests.length, href: "/me/requests" },
    { label: "참여 모임", value: meetups.joined.length, href: "/me/meetups" },
  ];

  return (
    <div className="space-y-8">
      {submitted && <p className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">글을 받았습니다. 관리자가 확인한 뒤 공개됩니다 — 보통 며칠 안에 처리됩니다.</p>}
      {deleted && <p className="rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">글을 삭제했습니다.</p>}
      {published && <p className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">글이 게시되었습니다. 내 글에서 바로 볼 수 있습니다.</p>}

      <section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-xl border border-line bg-surface px-3 py-3 hover:border-sea/60">
              <p className="text-[11px] font-medium text-ink-faint">{s.label}</p>
              <p className="mt-0.5 text-xl font-extrabold text-ink">{s.value.toLocaleString("ko-KR")}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/write" className="rounded-full bg-ink px-4 py-1.5 font-medium text-cream hover:opacity-90">
            + 새 글
          </Link>
          <Link href="/me/business#add" className="rounded-full border border-line bg-surface px-4 py-1.5 font-medium text-ink hover:bg-sand">
            업체·브랜드 등록
          </Link>
          <Link href="/meetup" className="rounded-full border border-line bg-surface px-4 py-1.5 font-medium text-ink hover:bg-sand">
            펫모임
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink">최근 글</h2>
          <Link href="/me/posts" className="text-xs font-medium text-sea hover:underline">
            전체 보기 →
          </Link>
        </div>
        {posts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 쓴 글이 없습니다. 우리 개의 변화, 해봤던 것, 도움이 됐던 것을 나눠 주세요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {posts.slice(0, 4).map(({ guide, topicName }) => (
              <li key={guide.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[guide.status] ?? "bg-sand text-ink-soft"}`}>{GUIDE_STATUS_LABEL[guide.status] ?? guide.status}</span>
                <span className="font-medium text-ink">{guide.title}</span>
                <span className="text-xs text-ink-faint">
                  {topicName} · {formatDate(guide.updatedAt)}
                </span>
                <span className="ml-auto text-xs">
                  {guide.status === "published" && (
                    <Link href={`/guide/${guide.slug}`} className="text-sea hover:underline">
                      보기
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink">내 업체·브랜드</h2>
          <Link href="/me/business" className="text-xs font-medium text-sea hover:underline">
            관리 →
          </Link>
        </div>
        {spots.length + makers.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            아직 소유 확인된 업체·브랜드가 없어요.{" "}
            <Link href="/me/business#add" className="font-medium text-sea hover:underline">
              등록·소유 확인 요청하기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {spots.map((s) => (
              <li key={`s${s.id}`}>
                <Link href={`/me/business/spot/${s.id}`} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-sea/60">
                  <p className="text-xs text-ink-faint">
                    {s.typeName} · {s.regionLabel}
                  </p>
                  <p className="mt-0.5 font-bold text-ink">{s.name}</p>
                </Link>
              </li>
            ))}
            {makers.map((m) => (
              <li key={`m${m.id}`}>
                <Link href={`/me/business/maker/${m.id}`} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-sea/60">
                  <p className="text-xs text-ink-faint">브랜드 · 상품 {m.itemCount}개 · {m.status === "published" ? "공개" : "비공개"}</p>
                  <p className="mt-0.5 font-bold text-ink">{m.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openRequests.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-ink">진행 중인 신청</h2>
            <Link href="/me/requests" className="text-xs font-medium text-sea hover:underline">
              전체 보기 →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {openRequests.slice(0, 3).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea">{REQUEST_KIND_LABEL[r.kind]}</span>
                <span className="text-ink">{r.summary}</span>
                <span className="ml-auto text-xs text-ink-faint">
                  {REQUEST_STATUS_LABEL[r.status]} · {formatDate(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-ink">최근 저장</h2>
            <Link href="/me/saved" className="text-xs font-medium text-sea hover:underline">
              전체 보기 →
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {saved.slice(0, 8).map((s) => (
              <li key={`${s.target}-${s.id}`}>
                <Link href={s.path} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink hover:bg-sand">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
