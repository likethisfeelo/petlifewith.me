import Link from "next/link";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { getGuideCategory } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { GUIDE_STATUS_LABEL } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";
import { publishGuideAction } from "../../actions";

const { guides, topics, users } = schema;

const STATUS_VALUES = ["draft", "review_pending", "pending", "published", "archived"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const STATUS_STYLE: Record<string, string> = {
  published: "bg-sage-soft text-sage-deep",
  review_pending: "bg-accent-soft text-accent-deep",
  pending: "bg-honey-soft text-honey",
};

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminGuidesPage({ searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const sp = await searchParams;
  const status = (STATUS_VALUES as readonly string[]).includes(sp.status ?? "") ? (sp.status as StatusValue) : "";
  const where: SQL | undefined = status ? eq(guides.status, status) : undefined;

  const [rows, counts] = await Promise.all([
    db
      .select({ guide: guides, topicName: topics.name, topicSlug: topics.slug, authorName: users.displayName })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .leftJoin(users, eq(guides.authorUserId, users.id))
      .where(where)
      .orderBy(desc(guides.updatedAt)),
    db.select({ status: guides.status, count: sql<number>`count(*)`.mapWith(Number) }).from(guides).groupBy(guides.status),
  ]);
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c.count]));
  const pendingCount = countBy.pending ?? 0;

  return (
    <div>
      <AdminPageHeader
        title={`게시글 ${rows.length}편${status ? ` · ${GUIDE_STATUS_LABEL[status]}` : ""}`}
        description="의료 인접 편은 수의사 감수 완료 전에는 발행할 수 없습니다. 회원 글은 '승인 대기'로 들어오며 발행으로 바꾸면 공개됩니다. 토픽 페이지는 최상단 고정(1~3) → 최신순."
        right={
          <Link href="/admin/guides/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 게시글 작성
          </Link>
        }
      />

      {pendingCount > 0 && !status && (
        <p className="mt-4 rounded-lg border border-honey/30 bg-honey-soft px-4 py-2.5 text-sm text-honey">
          회원 글 <strong>{pendingCount}편</strong>이 승인을 기다립니다.{" "}
          <Link href="/admin/guides?status=pending" className="font-semibold underline">
            승인 대기만 보기 →
          </Link>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <Link href="/admin/guides" className={`rounded-full border px-3 py-1 ${!status ? "border-ink bg-ink text-cream" : "border-line text-ink-soft hover:bg-sand"}`}>
          전체
        </Link>
        {STATUS_VALUES.map((v) => (
          <Link
            key={v}
            href={`/admin/guides?status=${v}`}
            className={`rounded-full border px-3 py-1 ${status === v ? "border-ink bg-ink text-cream" : "border-line text-ink-soft hover:bg-sand"}`}
          >
            {GUIDE_STATUS_LABEL[v]} {countBy[v] ?? 0}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">제목</th>
              <th className="px-4 py-2.5 font-medium">토픽 · 카테고리</th>
              <th className="px-4 py-2.5 font-medium">글쓴이</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">감수</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-faint">
                  해당 상태의 글이 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ guide, topicName, topicSlug, authorName }) => {
              const category = getGuideCategory(topicSlug, guide.category);
              const canQuickPublish = guide.status === "pending" && !(guide.medicalAdjacent && !guide.vetReviewed);
              return (
                <tr key={guide.id} className="hover:bg-sand/50">
                  <td className="px-4 py-2.5">
                    {guide.curated && (
                      <span className="mr-1.5 rounded-full bg-sea-soft px-1.5 py-0.5 text-[10px] font-semibold text-sea">
                        큐레이션{guide.curatedOrder ? ` ${guide.curatedOrder}` : ""}
                      </span>
                    )}
                    {guide.areaOrder && (
                      <span className="mr-1.5 rounded-full bg-honey-soft px-1.5 py-0.5 text-[10px] font-semibold text-honey">대표 {guide.areaOrder}</span>
                    )}
                    <Link href={`/admin/guides/${guide.id}`} className="font-medium text-ink hover:underline">
                      {guide.title}
                    </Link>
                    <span className="ml-2 text-xs text-ink-faint">/{guide.slug}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {topicName}
                    <span className="ml-1 text-xs text-ink-faint">· {category ? category.name : "전체"}</span>
                    {guide.role === "hub" && <span className="ml-1 text-xs text-ink-faint">· 허브</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{guide.authorUserId ? `회원 · ${authorName ?? "-"}` : "관리자"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[guide.status] ?? "bg-sand text-ink-soft"}`}>
                      {GUIDE_STATUS_LABEL[guide.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">
                    {guide.medicalAdjacent ? (guide.vetReviewed ? `완료 (${guide.vetReviewerName})` : "필요") : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canQuickPublish && (
                      <form action={publishGuideAction}>
                        <input type="hidden" name="id" value={guide.id} />
                        <button type="submit" className="rounded-full border border-sage/40 bg-sage-soft px-3 py-1 text-xs font-medium text-sage-deep hover:bg-sage hover:text-white">
                          승인·발행
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
