import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { SPOT_SOURCE_LABEL, SPOT_STATUS_LABEL } from "@/lib/format";
import { placeInfoItemCount } from "@/lib/seo";
import { countLinksBySpot } from "@/lib/queries/spots";
import { AdminPageHeader } from "../../_components/fields";
import { togglePromotionAction } from "../../actions";

const { spots, spotTypes, regions, promotions } = schema;

// 인허가 적재 후 수만 건이 된다 — 검색·필터·페이지네이션으로 관리한다.
const PAGE_SIZE = 50;
const STATUS_VALUES = ["operating", "suspended", "closed", "unknown"] as const;
const SOURCE_VALUES = ["public_data", "direct", "claimed", "sample"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];
type SourceValue = (typeof SOURCE_VALUES)[number];

interface Props {
  searchParams: Promise<{ q?: string; type?: string; status?: string; source?: string; page?: string }>;
}

export default async function AdminSpotsPage({ searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const typeSlug = sp.type?.trim() ?? "";
  const status = (STATUS_VALUES as readonly string[]).includes(sp.status ?? "") ? (sp.status as StatusValue) : "";
  const source = (SOURCE_VALUES as readonly string[]).includes(sp.source ?? "") ? (sp.source as SourceValue) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const conds: SQL[] = [];
  if (q) conds.push(ilike(spots.name, `%${q}%`));
  if (typeSlug) conds.push(eq(spotTypes.slug, typeSlug));
  if (status) conds.push(eq(spots.status, status));
  if (source) conds.push(eq(spots.source, source));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [types, totalRows, rows] = await Promise.all([
    db
      .select({ slug: spotTypes.slug, name: spotTypes.name, listed: spotTypes.listed })
      .from(spotTypes)
      .orderBy(spotTypes.sortOrder),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(where),
    db
      .select({
        spot: spots,
        typeName: spotTypes.name,
        typeListed: spotTypes.listed,
        monetizable: spotTypes.monetizable,
        sigunguName: regions.sigunguName,
        promoted: sql<boolean>`exists (select 1 from ${promotions} p where p.spot_id = ${spots.id} and p.active = true)`,
      })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(where)
      .orderBy(desc(spots.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = totalRows[0]?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number): string => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (typeSlug) u.set("type", typeSlug);
    if (status) u.set("status", status);
    if (source) u.set("source", source);
    if (p > 1) u.set("page", String(p));
    const qs = u.toString();
    return qs ? `/admin/spots?${qs}` : "/admin/spots";
  };
  const filtered = Boolean(q || typeSlug || status || source);

  // 링크도 정보 항목으로 세므로 목록의 색인 판정에 함께 반영한다
  const linkCounts = await countLinksBySpot(rows.map((r) => r.spot.id));

  const selectCls = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink";

  return (
    <div>
      <AdminPageHeader
        title={`스팟 (${total.toLocaleString("ko-KR")}건)`}
        description="정보 3항목 미만은 noindex 상태입니다. B2B 참고 유형(의약품 도매·의료용구)은 소비자 목록과 분리된 참고 디렉토리로 게시됩니다."
        right={
          <Link
            href="/admin/spots/new"
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
          >
            + 스팟 등록
          </Link>
        }
      />

      <form method="get" action="/admin/spots" className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="이름 검색"
          className="w-48 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
        <select name="type" defaultValue={typeSlug} className={selectCls}>
          <option value="">전체 유형</option>
          {types.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
              {t.listed ? "" : " (B2B 참고)"}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={selectCls}>
          <option value="">전체 상태</option>
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {SPOT_STATUS_LABEL[v]}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={source} className={selectCls}>
          <option value="">전체 출처</option>
          {SOURCE_VALUES.map((v) => (
            <option key={v} value={v}>
              {SPOT_SOURCE_LABEL[v]}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream hover:opacity-90">
          검색
        </button>
        {filtered && (
          <Link href="/admin/spots" className="text-xs text-ink-faint hover:text-ink">
            초기화
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">이름</th>
              <th className="px-4 py-2.5 font-medium">유형</th>
              <th className="px-4 py-2.5 font-medium">지역</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">출처 · 기준일</th>
              <th className="px-4 py-2.5 font-medium">정보</th>
              <th className="px-4 py-2.5 font-medium">노출 광고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ spot, typeName, typeListed, monetizable, sigunguName, promoted }) => {
              const infoCount = placeInfoItemCount(spot, linkCounts.get(spot.id) ?? 0);
              return (
                <tr key={spot.id} className="hover:bg-sand/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/spots/${spot.id}`} className="font-medium text-ink hover:underline">
                      {spot.name}
                    </Link>
                    {spot.source === "sample" && <span className="ml-2 text-xs text-accent-deep">샘플</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {typeName}
                    {!typeListed && <span className="ml-1 text-xs text-ink-faint">(B2B 참고)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{sigunguName}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{SPOT_STATUS_LABEL[spot.status]}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">
                    {SPOT_SOURCE_LABEL[spot.source] ?? spot.source}
                    {spot.dataReferenceDate && (
                      <span className="text-ink-faint"> · {spot.dataReferenceDate}</span>
                    )}
                  </td>
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
                      <span className="text-xs text-ink-faint">광고 불가 (장묘·의료 인접)</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-faint">
                  조건에 맞는 스팟이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
        <p>
          총 {total.toLocaleString("ko-KR")}건 · {page}/{pageCount} 페이지
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-sand">
              ← 이전
            </Link>
          )}
          {page < pageCount && (
            <Link href={pageHref(page + 1)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-sand">
              다음 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
