import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { ITEM_CATEGORY_LABEL, idSlugPath } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";

const { items, makers, itemOffers, guideItemTags } = schema;

export default async function AdminItemsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({
      item: items,
      makerName: makers.name,
      offerCount: sql<number>`count(distinct ${itemOffers.id})`.mapWith(Number),
      affiliateCount: sql<number>`count(distinct ${itemOffers.id}) filter (where ${itemOffers.isAffiliate})`.mapWith(Number),
      mentionCount: sql<number>`count(distinct ${guideItemTags.id})`.mapWith(Number),
    })
    .from(items)
    .leftJoin(makers, eq(items.makerId, makers.id))
    .leftJoin(itemOffers, eq(itemOffers.itemId, items.id))
    .leftJoin(guideItemTags, eq(guideItemTags.itemId, items.id))
    .groupBy(items.id, makers.name)
    .orderBy(desc(items.updatedAt));

  return (
    <div>
      <AdminPageHeader
        title={`상품 ${rows.length}개`}
        description="글에서 한 번도 언급되지 않은 상품은 색인되지 않습니다. 등록 후 게시글에서 태깅하세요."
        right={
          <Link href="/admin/items/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 상품 등록
          </Link>
        }
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">상품</th>
              <th className="px-4 py-2.5 font-medium">분류</th>
              <th className="px-4 py-2.5 font-medium">만든 곳</th>
              <th className="px-4 py-2.5 font-medium">구매 링크</th>
              <th className="px-4 py-2.5 font-medium">언급된 글</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-faint">
                  등록된 상품이 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ item, makerName, offerCount, affiliateCount, mentionCount }) => (
              <tr key={item.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/items/${item.id}`} className="font-medium text-ink hover:underline">
                    {item.name}
                  </Link>
                  <Link href={idSlugPath("item", item.id, item.slug)} className="ml-2 text-xs text-sea hover:underline">
                    보기 ↗
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{ITEM_CATEGORY_LABEL[item.category] ?? item.category}</td>
                <td className="px-4 py-2.5 text-ink-soft">{makerName ?? "-"}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {offerCount}
                  {affiliateCount > 0 && <span className="ml-1 text-xs text-accent-deep">(제휴 {affiliateCount})</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={mentionCount > 0 ? "text-sage-deep" : "text-accent-deep"}>
                    {mentionCount > 0 ? `${mentionCount}편` : "0 · noindex"}
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
