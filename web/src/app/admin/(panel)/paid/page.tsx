// 유료 상품 — 프리미엄 링크 페이지(기간)와 지역 상단 노출을 한 화면에서 본다.
// 적용·연장·끝내기는 각 업체 편집 화면의 "유료 상품" 칸에서 (여기는 현황과 바로가기).
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { PREMIUM_STATE_LABEL, linkBaseUrl, linkPageUrl, premiumStatus } from "@/lib/spot-pages";
import { AdminPageHeader } from "../../_components/fields";

const { spots, spotTypes, regions, spotPages, promotions } = schema;

export default async function AdminPaidPage({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { go } = await searchParams;
  const goId = Number(go);
  if (Number.isSafeInteger(goId) && goId > 0) redirect(`/admin/spots/${goId}#paid`);

  const db = getDb();
  const base = linkBaseUrl(siteUrl());
  const [premium, promos] = await Promise.all([
    db
      .select({ id: spots.id, name: spots.name, typeName: spotTypes.name, sido: regions.sidoName, sigungu: regions.sigunguName, paidFrom: spotPages.paidFrom, paidUntil: spotPages.paidUntil, handle: spotPages.handle, published: spotPages.published })
      .from(spotPages)
      .innerJoin(spots, eq(spotPages.spotId, spots.id))
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(isNotNull(spotPages.paidUntil))
      .orderBy(asc(spotPages.paidUntil)),
    db
      .select({ id: spots.id, name: spots.name, typeName: spotTypes.name, sido: regions.sidoName, sigungu: regions.sigunguName, since: promotions.createdAt })
      .from(promotions)
      .innerJoin(spots, eq(promotions.spotId, spots.id))
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(and(eq(promotions.kind, "region_top"), eq(promotions.active, true)))
      .orderBy(asc(regions.sidoName), asc(regions.sigunguName)),
  ]);
  const rows = premium.map((r) => ({ ...r, status: premiumStatus(r) }));
  const order = { active: 0, scheduled: 1, expired: 2, none: 3 } as const;
  rows.sort((a, b) => order[a.status.state] - order[b.status.state]);
  const activeCount = rows.filter((r) => r.status.state === "active").length;

  return (
    <div>
      <AdminPageHeader title="유료 상품" description={`프리미엄 링크 페이지 진행 중 ${activeCount}곳 · 지역 상단 노출 ${promos.length}곳 — 두 상품은 별개입니다.`} />

      <form className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm" action="/admin/paid">
        <span className="font-semibold text-ink">새로 적용하기</span>
        <input name="go" inputMode="numeric" placeholder="업체 번호 (장소 주소 /place/번호-…)" className="w-64 rounded-lg border border-line px-3 py-1.5" />
        <button className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream">업체 유료 상품 칸으로 →</button>
        <Link href="/admin/spots" className="text-xs text-sea hover:underline">
          스팟 목록에서 찾기
        </Link>
      </form>

      <section className="mt-6">
        <h2 className="text-base font-bold text-ink">① 프리미엄 링크 페이지</h2>
        {rows.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 프리미엄을 적용한 업체가 없습니다.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-sand/60 text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-2">상태</th>
                  <th className="px-4 py-2">업체</th>
                  <th className="px-4 py-2">기간</th>
                  <th className="px-4 py-2">링크</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status.state === "active" ? "bg-ink text-cream" : r.status.state === "scheduled" ? "bg-sea-soft text-sea" : "bg-sand text-ink-faint"}`}>
                        {PREMIUM_STATE_LABEL[r.status.state]}
                        {r.status.state === "active" && ` · ${r.status.days}일 남음`}
                      </span>
                      {r.status.state === "active" && (r.status.days ?? 99) <= 7 && <span className="ml-1 text-xs font-bold text-rose-600">곧 끝남</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-ink-faint">
                        {r.typeName} · {r.sido} {r.sigungu}
                        {!r.published && " · 비공개"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-soft">
                      {r.paidFrom} ~ {r.paidUntil}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.published ? (
                        <a href={linkPageUrl(base, r.id, r)} target="_blank" rel="noopener noreferrer" className="text-sea hover:underline">
                          {linkPageUrl(base, r.id, r).replace(/^https?:\/\//, "")} ↗
                        </a>
                      ) : (
                        <span className="text-ink-faint">비공개</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/spots/${r.id}#paid`} className="text-xs font-medium text-sea hover:underline">
                        연장·수정 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-bold text-ink">② 지역 상단 노출</h2>
        {promos.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">상단 노출 중인 업체가 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {promos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="ml-2 text-xs text-ink-faint">
                    {p.typeName} · {p.sido} {p.sigungu} · {p.since.toISOString().slice(0, 10)}부터
                  </span>
                </span>
                <Link href={`/admin/spots/${p.id}#paid`} className="text-xs font-medium text-sea hover:underline">
                  관리 →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
