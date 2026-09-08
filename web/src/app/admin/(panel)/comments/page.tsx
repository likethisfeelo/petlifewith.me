import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";
import { deleteCommentAction, toggleCommentHiddenAction } from "../../actions";

const { comments, users, guides } = schema;

export default async function AdminCommentsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const rows = await db
    .select({ comment: comments, authorName: users.displayName, guideTitle: guides.title, guideSlug: guides.slug })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .innerJoin(guides, eq(comments.guideId, guides.id))
    .orderBy(desc(comments.createdAt))
    .limit(300);

  return (
    <div>
      <AdminPageHeader
        title={`댓글 ${rows.length}건`}
        description="최근 300건. 숨기면 공개 페이지에서 사라지고(작성자에게도 보이지 않음), 삭제는 되돌릴 수 없습니다. 진단·처방 단정, 광고, 개인정보가 있으면 숨기세요."
      />
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-faint">아직 댓글이 없습니다.</li>}
        {rows.map(({ comment, authorName, guideTitle, guideSlug }) => (
          <li key={comment.id} className={`px-4 py-3 ${comment.hiddenAt ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-faint">
              <span className="font-semibold text-ink">{authorName ?? "-"}</span>
              <span>{formatDate(comment.createdAt)}</span>
              <Link href={`/guide/${guideSlug}#comments`} className="text-sea hover:underline">
                {guideTitle}
              </Link>
              {comment.hiddenAt && <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-ink-soft">숨김</span>}
              <span className="ml-auto flex items-center gap-2">
                <form action={toggleCommentHiddenAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button type="submit" className="rounded-full border border-line px-2.5 py-0.5 text-ink-soft hover:bg-sand hover:text-ink">
                    {comment.hiddenAt ? "숨김 해제" : "숨기기"}
                  </button>
                </form>
                <form action={deleteCommentAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button type="submit" className="text-ink-faint hover:text-accent-deep">
                    삭제
                  </button>
                </form>
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{comment.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
