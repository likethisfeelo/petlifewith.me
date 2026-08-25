import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { GUIDE_STATUS_LABEL } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";

const { guides, topics } = schema;

export default async function AdminGuidesPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const rows = await db
    .select({ guide: guides, topicName: topics.name })
    .from(guides)
    .innerJoin(topics, eq(guides.topicId, topics.id))
    .orderBy(desc(guides.updatedAt));

  return (
    <div>
      <AdminPageHeader
        title={`게시글 ${rows.length}편`}
        description="의료 인접 편은 수의사 감수 완료 전에는 발행할 수 없습니다."
        right={
          <Link href="/admin/guides/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 게시글 작성
          </Link>
        }
      />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">제목</th>
              <th className="px-4 py-2.5 font-medium">토픽</th>
              <th className="px-4 py-2.5 font-medium">구조</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">감수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ guide, topicName }) => (
              <tr key={guide.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/guides/${guide.id}`} className="font-medium text-ink hover:underline">
                    {guide.title}
                  </Link>
                  <span className="ml-2 text-xs text-ink-faint">/{guide.slug}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{topicName}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {guide.role === "hub" ? "허브" : `스포크${guide.spokeGroup ? ` (${guide.spokeGroup})` : ""}`}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      guide.status === "published"
                        ? "bg-sage-soft text-sage-deep"
                        : guide.status === "review_pending"
                          ? "bg-accent-soft text-accent-deep"
                          : "bg-sand text-ink-soft"
                    }`}
                  >
                    {GUIDE_STATUS_LABEL[guide.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">
                  {guide.medicalAdjacent ? (guide.vetReviewed ? `완료 (${guide.vetReviewerName})` : "필요") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
