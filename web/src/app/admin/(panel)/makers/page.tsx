import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { MAKER_CATEGORY_LABEL, idSlugPath } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";

const { makers, regions, items } = schema;

export default async function AdminMakersPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({
      maker: makers,
      sidoName: regions.sidoName,
      sigunguName: regions.sigunguName,
      itemCount: sql<number>`count(${items.id})`.mapWith(Number),
    })
    .from(makers)
    .leftJoin(regions, eq(makers.regionId, regions.id))
    .leftJoin(items, eq(items.makerId, makers.id))
    .groupBy(makers.id, regions.sidoName, regions.sigunguName)
    .orderBy(desc(makers.updatedAt));

  return (
    <div>
      <AdminPageHeader
        title={`메이커 ${rows.length}곳`}
        description="직접 제조하는 브랜드만 다룹니다. 소개(스토리)가 비어 있으면 공개해도 색인되지 않습니다."
        right={
          <Link href="/admin/makers/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 메이커 등록
          </Link>
        }
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">브랜드</th>
              <th className="px-4 py-2.5 font-medium">분류</th>
              <th className="px-4 py-2.5 font-medium">지역</th>
              <th className="px-4 py-2.5 font-medium">배지</th>
              <th className="px-4 py-2.5 font-medium">상품</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-faint">
                  등록된 메이커가 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ maker, sidoName, sigunguName, itemCount }) => (
              <tr key={maker.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/makers/${maker.id}`} className="font-medium text-ink hover:underline">
                    {maker.name}
                  </Link>
                  {maker.status === "published" && (
                    <Link
                      href={idSlugPath("maker", maker.id, maker.slug)}
                      className="ml-2 text-xs text-sea hover:underline"
                    >
                      보기 ↗
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{MAKER_CATEGORY_LABEL[maker.category] ?? maker.category}</td>
                <td className="px-4 py-2.5 text-ink-soft">{sidoName ? `${sidoName} ${sigunguName ?? ""}` : "-"}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">
                  {maker.badgeFeedRegistered || maker.badgeIngredientRegistered
                    ? `확인됨 (${maker.badgeVerifiedAt ?? "기준일 없음"})`
                    : "-"}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{itemCount}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      maker.status === "published" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-soft"
                    }`}
                  >
                    {maker.status === "published" ? "공개" : "작성 중"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
