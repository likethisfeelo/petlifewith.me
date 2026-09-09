// 일반 게시판 목록 — 회원이 직접 쓴 글 (노견생활은 "일반 - 노령견 생활 공유 게시판", lib/boards.ts).
// 큐레이션 페이지 하단과 /topic/[토픽]/challenge 가 같이 쓴다.
// 큐레이션은 이 목록에서 운영진이 대표를 골라 위에 세워 둔 것이라, 큐레이션에 올라간 글에는 "큐레이션 선정" 칩이 붙는다.
// 순위·추천 없이 최신순. 회원 글은 승인(published) 뒤에만 보인다.
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { GuideListItem } from "@/lib/queries/guides";

export function ChallengeBoardList({
  posts,
  commentCounts,
  categoryName,
}: {
  posts: GuideListItem[];
  commentCounts: Map<number, number>;
  categoryName: (slug: string | null) => string | null;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
        아직 글이 없습니다. 첫 글을 남겨 주세요.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {posts.map(({ guide, authorName }) => {
        const comments = commentCounts.get(guide.id) ?? 0;
        const category = categoryName(guide.category);
        return (
          <li key={guide.id}>
            <Link href={`/guide/${guide.slug}`} className="group flex flex-col gap-1 px-5 py-4 hover:bg-sand/50">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {category && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">{category}</span>}
                {guide.curated && <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">큐레이션 선정</span>}
                <span className="text-ink-faint">{authorName ?? "회원"}</span>
              </div>
              <h3 className="text-base font-bold leading-snug text-ink group-hover:underline">{guide.title}</h3>
              {guide.summary && <p className="line-clamp-2 text-sm text-ink-soft">{guide.summary}</p>}
              <p className="text-xs text-ink-faint">
                {formatDate(guide.publishedAt)} · 댓글 {comments}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
