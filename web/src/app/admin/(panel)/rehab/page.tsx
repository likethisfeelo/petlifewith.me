import Link from "next/link";
import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { REHAB_MODALITIES, getRehabModality } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { SPOT_STATUS_LABEL } from "@/lib/format";
import { AdminPageHeader } from "../../_components/fields";

const { rehabSites, regions } = schema;

interface Props {
  searchParams: Promise<{ q?: string; modality?: string; published?: string; deleted?: string }>;
}

export default async function AdminRehabPage({ searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const modality = getRehabModality(sp.modality ?? "")?.slug ?? "";
  const published = sp.published === "y" ? true : sp.published === "n" ? false : null;

  const conds: SQL[] = [];
  if (q) conds.push(ilike(rehabSites.name, `%${q}%`));
  if (modality) conds.push(sql`${modality} = any(${rehabSites.modalities})`);
  if (published !== null) conds.push(eq(rehabSites.published, published));

  const rows = await db
    .select({ site: rehabSites, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
    .from(rehabSites)
    .innerJoin(regions, eq(rehabSites.regionId, regions.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(regions.sidoName), asc(regions.sigunguName), asc(rehabSites.name));

  const filterHref = (patch: Record<string, string>): string => {
    const u = new URLSearchParams();
    const next = { q, modality, published: published === null ? "" : published ? "y" : "n", ...patch };
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    const qs = u.toString();
    return qs ? `/admin/rehab?${qs}` : "/admin/rehab";
  };

  return (
    <div>
      <AdminPageHeader
        title={`재활·한방·특수치료 시행처 ${rows.length}곳`}
        description="주어는 병원이 아니라 치료법입니다. 확인 수준(A/B/C)은 관리 화면 전용이며 공개 페이지에는 절대 나가지 않습니다. 공개 목록은 지역별 가나다순 — 순위·추천·평점·광고 없음."
        right={
          <Link href="/admin/rehab/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 시행처 등록
          </Link>
        }
      />
      {sp.deleted && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">삭제했습니다.</p>
      )}

      <form action="/admin/rehab" className="mt-4 flex flex-wrap items-end gap-2 text-sm">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="병원명 검색"
          className="w-52 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink"
        />
        <select name="modality" defaultValue={modality} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
          <option value="">치료법 전체</option>
          {REHAB_MODALITIES.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="published" defaultValue={published === null ? "" : published ? "y" : "n"} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
          <option value="">게시 전체</option>
          <option value="y">게시 중</option>
          <option value="n">비게시</option>
        </select>
        <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-sand">
          필터
        </button>
        {(q || modality || published !== null) && (
          <Link href="/admin/rehab" className="text-xs text-ink-faint hover:text-ink">
            초기화
          </Link>
        )}
      </form>

      <p className="mt-3 text-xs text-ink-faint">
        일괄 적재·갱신은 <code>data/content/rehab/rehab-sites.csv</code> 를 편집한 뒤 <code>pnpm etl:rehab</code> 으로 한다.
        CSV 의 &quot;#&quot; 셀은 여기서 채운 값을 덮어쓰지 않는다. 공개 페이지: <Link href="/rehab" className="underline">/rehab</Link>
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">병원</th>
              <th className="px-4 py-2.5 font-medium">지역</th>
              <th className="px-4 py-2.5 font-medium">치료법</th>
              <th className="px-4 py-2.5 font-medium">근거 출처</th>
              <th className="px-4 py-2.5 font-medium" title="관리 전용 확인 수준 — 공개 금지">확인</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">게시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-faint">
                  조건에 맞는 시행처가 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ site, sidoName, sigunguName }) => (
              <tr key={site.id} className={`hover:bg-sand/50 ${site.published ? "" : "opacity-60"}`}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/rehab/${site.id}`} className="font-medium text-ink hover:underline">
                    {site.name}
                  </Link>
                  {site.phone && <span className="ml-2 text-xs text-ink-faint">{site.phone}</span>}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {sidoName} {sigunguName}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {site.modalities.map((slug) => (
                      <span key={slug} className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage-deep">
                        {getRehabModality(slug)?.short ?? slug}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">{site.sourceLabel ?? "-"}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">{site.internalLevel ?? "-"}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">{SPOT_STATUS_LABEL[site.status] ?? site.status}</td>
                <td className="px-4 py-2.5 text-xs">{site.published ? <span className="text-sage-deep">게시</span> : <span className="text-ink-faint">비게시</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
