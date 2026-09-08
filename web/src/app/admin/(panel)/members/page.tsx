import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";
import { toggleUserBlockAction } from "../../actions";

const { users, guides, comments } = schema;

export default async function AdminMembersPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const rows = await db
    .select({
      user: users,
      // 서브쿼리 안에서 ${users.id} 는 테이블 접두사 없이 "id" 로 찍혀 g.id 로 풀린다 — 명시적으로 쓴다
      postCount: sql<number>`(select count(*) from ${guides} g where g.author_user_id = "users"."id")`.mapWith(Number),
      commentCount: sql<number>`(select count(*) from ${comments} c where c.user_id = "users"."id")`.mapWith(Number),
    })
    .from(users)
    .where(eq(users.role, "member"))
    .orderBy(desc(users.createdAt))
    .limit(500);

  return (
    <div>
      <AdminPageHeader
        title={`회원 ${rows.length}명`}
        description="이메일은 관리 화면에서만 보입니다 — 공개 페이지에는 닉네임만 나갑니다. 차단하면 로그인이 즉시 끊기고 글·댓글을 쓸 수 없습니다 (이미 공개된 글은 게시글 화면에서 따로 처리)."
      />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">닉네임</th>
              <th className="px-4 py-2.5 font-medium">이메일</th>
              <th className="px-4 py-2.5 font-medium">글 / 댓글</th>
              <th className="px-4 py-2.5 font-medium">가입 · 최근 로그인</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-faint">
                  아직 가입한 회원이 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ user, postCount, commentCount }) => (
              <tr key={user.id} className={`hover:bg-sand/50 ${user.blockedAt ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5 font-medium text-ink">{user.displayName ?? "-"}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">{user.email ?? "-"}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">
                  {postCount} / {commentCount}
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">
                  {formatDate(user.createdAt)}
                  {user.lastLoginAt ? ` · ${formatDate(user.lastLoginAt)}` : ""}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {user.blockedAt ? <span className="text-accent-deep">차단 ({formatDate(user.blockedAt)})</span> : <span className="text-sage-deep">정상</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <form action={toggleUserBlockAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <button type="submit" className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:bg-sand hover:text-ink">
                      {user.blockedAt ? "차단 해제" : "차단"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
