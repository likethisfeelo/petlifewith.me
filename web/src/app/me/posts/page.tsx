// 내 글 — 전체 목록, 상태 필터, 보기·수정·삭제, 연결된 업체·상품 칩
import Link from "next/link";
import { deleteMemberPostAction } from "@/app/member-actions";
import { GUIDE_STATUS_LABEL, formatDate } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listMyPosts } from "@/lib/queries/members";
import { listGuideLinkNames } from "@/lib/queries/owner";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-sage-soft text-sage-deep",
  pending: "bg-honey-soft text-honey",
  draft: "bg-accent-soft text-accent-deep",
};
// 회원 글의 draft 는 관리자가 반려한 글이다 (회원은 draft 를 만들지 않는다)
const MEMBER_STATUS_LABEL: Record<string, string> = { ...GUIDE_STATUS_LABEL, draft: "반려됨 — 고쳐서 다시 올려 주세요", pending: "승인 대기" };
const FILTERS = [
  { key: "", label: "전체" },
  { key: "published", label: "발행됨" },
  { key: "pending", label: "승인 대기" },
  { key: "draft", label: "반려됨" },
  { key: "archived", label: "보관" },
];

export default async function MePostsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const member = (await getCurrentMember())!;
  const { status } = await searchParams;
  const all = await listMyPosts(member.id);
  const posts = status ? all.filter((p) => p.guide.status === status) : all;
  const links = await listGuideLinkNames(posts.map((p) => p.guide.id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">내 글 {all.length > 0 ? `${all.length}편` : ""}</h2>
        <Link href="/write" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
          + 새 글
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key ? `/me/posts?status=${f.key}` : "/me/posts"} className={`rounded-full px-3 py-1 font-medium ${(status ?? "") === f.key ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {f.label}
          </Link>
        ))}
      </div>
      {posts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">{status ? "해당 상태의 글이 없습니다." : "아직 쓴 글이 없습니다. 우리 개의 변화, 해봤던 것, 도움이 됐던 것을 나눠 주세요."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {posts.map(({ guide, topicName }) => (
            <li key={guide.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[guide.status] ?? "bg-sand text-ink-soft"}`}>{MEMBER_STATUS_LABEL[guide.status] ?? guide.status}</span>
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
                  {(guide.status === "pending" || guide.status === "published" || guide.status === "draft") && (
                    <Link href={`/write/${guide.id}`} className="text-ink-soft hover:underline">
                      수정
                    </Link>
                  )}
                  {(guide.status === "pending" || guide.status === "draft") && (
                    <form action={deleteMemberPostAction}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button type="submit" className="text-ink-faint hover:text-accent-deep">
                        삭제
                      </button>
                    </form>
                  )}
                </span>
              </div>
              {(links[guide.id]?.length ?? 0) > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-faint">
                  연결:
                  {links[guide.id]!.map((n) => (
                    <span key={n} className="rounded-full bg-sand px-2 py-0.5 text-ink-soft">
                      {n}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-faint">글 수정 화면의 &quot;내 업체·상품 연결&quot;에서 소유한 업체·브랜드·상품을 붙이면 글 옆에 링크가 함께 보입니다.</p>
    </div>
  );
}
