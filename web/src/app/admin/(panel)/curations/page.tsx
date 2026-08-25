import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { GUIDE_STATUS_LABEL, formatDate } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";

const { curations, curationEntries } = schema;

export default async function AdminCurationsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({
      curation: curations,
      entryCount: sql<number>`count(${curationEntries.id})`.mapWith(Number),
    })
    .from(curations)
    .leftJoin(curationEntries, eq(curationEntries.curationId, curations.id))
    .groupBy(curations.id)
    .orderBy(desc(curations.updatedAt));

  return (
    <div>
      <AdminPageHeader
        title={`큐레이션 ${rows.length}개`}
        description="테마 단위로만 묶습니다. 창작자 개인 허브 페이지는 만들지 않습니다."
        right={
          <Link href="/admin/curations/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 큐레이션 등록
          </Link>
        }
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">테마</th>
              <th className="px-4 py-2.5 font-medium">항목</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">발행일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-faint">
                  등록된 큐레이션이 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ curation, entryCount }) => (
              <tr key={curation.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/curations/${curation.id}`} className="font-medium text-ink hover:underline">
                    {curation.title}
                  </Link>
                  {curation.status === "published" && (
                    <Link href={`/curation/${curation.themeSlug}`} className="ml-2 text-xs text-sea hover:underline">
                      보기 ↗
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={entryCount > 0 ? "text-ink-soft" : "text-accent-deep"}>
                    {entryCount > 0 ? `${entryCount}개` : "0 · noindex"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{GUIDE_STATUS_LABEL[curation.status]}</td>
                <td className="px-4 py-2.5 text-xs text-ink-faint">{formatDate(curation.publishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
