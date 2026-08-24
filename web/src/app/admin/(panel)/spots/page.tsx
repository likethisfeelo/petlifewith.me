import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { SPOT_STATUS_LABEL } from "@/lib/format";
import { placeInfoItemCount } from "@/lib/seo";
import { countLinksBySpot } from "@/lib/queries/spots";
import { AdminPageHeader } from "../../_components/fields";
import { togglePromotionAction } from "../../actions";

const { spots, spotTypes, regions, promotions } = schema;

export default async function AdminSpotsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({
      spot: spots,
      typeName: spotTypes.name,
      monetizable: spotTypes.monetizable,
      sigunguName: regions.sigunguName,
      promoted: sql<boolean>`exists (select 1 from ${promotions} p where p.spot_id = ${spots.id} and p.active = true)`,
    })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .orderBy(desc(spots.updatedAt))
    .limit(300);

  // 링크도 정보 항목으로 세므로 목록의 색인 판정에 함께 반영한다
  const linkCounts = await countLinksBySpot(rows.map((r) => r.spot.id));

  return (
    <div>
      <AdminPageHeader
        title="스팟 (최근 300)"
        description="정보 3항목 미만은 noindex 상태입니다. 링크를 포함해 정보를 보강하면 색인 대상이 됩니다."
        right={
          <Link
            href="/admin/spots/new"
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
          >
            + 스팟 등록
          </Link>
        }
      />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">유형</th>
              <th className="px-4 py-2.5 font-medium">지역</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">정보</th>
              <th className="px-4 py-2.5 font-medium">노출 광고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ spot, typeName, monetizable, sigunguName, promoted }) => {
              const infoCount = placeInfoItemCount(spot, linkCounts.get(spot.id) ?? 0);
              return (
                <tr key={spot.id} className="hover:bg-sand/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/spots/${spot.id}`} className="font-medium text-ink hover:underline">
                      {spot.name}
                    </Link>
                    {spot.source === "sample" && <span className="ml-2 text-xs text-accent-deep">샘플</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{typeName}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{sigunguName}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{SPOT_STATUS_LABEL[spot.status]}</td>
                  <td className="px-4 py-2.5">
                    <span className={infoCount >= 3 ? "text-sage-deep" : "text-accent-deep"}>
                      {infoCount}항목 {infoCount >= 3 ? "· 색인 가능" : "· noindex"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {monetizable ? (
                      <form action={togglePromotionAction}>
                        <input type="hidden" name="spotId" value={spot.id} />
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            promoted ? "bg-accent-soft text-accent-deep" : "border border-line text-ink-faint hover:bg-sand"
                          }`}
                        >
                          {promoted ? "지역 상단 노출 중 — 해제" : "지역 상단 노출 켜기"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-ink-faint">광고 불가 (장묘)</span>
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
