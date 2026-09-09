import Link from "next/link";
import { CARE_TYPE_SLUGS, MAX_EXPOSED_PER_AREA, carePersonLabel, isCareType } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { SPOT_SOURCE_LABEL, SPOT_STATUS_LABEL } from "@/lib/format";
import { listCareProviders, listCareRegions } from "@/lib/queries/care";
import { AdminPageHeader } from "../../_components/fields";
import { toggleServiceAreaExposureAction } from "../../actions";

const { spotTypes } = schema;

// 지역별 노출 관리 — "이 지역에 등록된 여러 파트너 중 누구를 켜 둘지"를 지역 단위로 본다.
// 지역 x 유형당 자리는 MAX_EXPOSED_PER_AREA. 켤 때 자리가 차 있으면 액션이 notice=full 로 돌아온다.

interface Props {
  searchParams: Promise<{ type?: string; sido?: string; notice?: string; region?: string }>;
}

export default async function AdminCarePage({ searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const sp = await searchParams;
  const typeSlug = isCareType(sp.type) ? sp.type : CARE_TYPE_SLUGS[0];
  const sidoFilter = sp.sido?.trim() ?? "";

  const types = await db.select({ id: spotTypes.id, slug: spotTypes.slug, name: spotTypes.name }).from(spotTypes);
  const careTypes = types.filter((t) => isCareType(t.slug)).sort((a, b) => CARE_TYPE_SLUGS.indexOf(a.slug as (typeof CARE_TYPE_SLUGS)[number]) - CARE_TYPE_SLUGS.indexOf(b.slug as (typeof CARE_TYPE_SLUGS)[number]));
  const current = careTypes.find((t) => t.slug === typeSlug);
  if (!current) return <p className="text-sm text-ink-soft">돌봄 유형이 시드되지 않았습니다. seed:base 를 먼저 실행하세요.</p>;

  const [regions, providers] = await Promise.all([listCareRegions(), listCareProviders(current.id, { includeHidden: true })]);
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const person = carePersonLabel(current.slug);

  // 지역 → 파트너 행
  const byRegion = new Map<number, Array<{ provider: (typeof providers)[number]; exposed: boolean; sortOrder: number }>>();
  for (const p of providers) {
    for (const a of p.areas) {
      const list = byRegion.get(a.regionId) ?? [];
      list.push({ provider: p, exposed: a.exposed, sortOrder: a.sortOrder });
      byRegion.set(a.regionId, list);
    }
  }
  const sidos = [...new Set(regions.map((r) => r.sidoSlug))].map((slug) => ({ slug, name: regions.find((r) => r.sidoSlug === slug)!.sidoName }));
  const groups = regions
    .filter((r) => byRegion.has(r.id) && (!sidoFilter || r.sidoSlug === sidoFilter))
    .map((r) => ({ region: r, rows: byRegion.get(r.id)!.sort((a, b) => a.sortOrder - b.sortOrder || a.provider.name.localeCompare(b.provider.name, "ko")) }));
  const exposedProviders = new Set(providers.filter((p) => p.areas.some((a) => a.exposed)).map((p) => p.id)).size;
  const fullRegionName = sp.notice === "full" && sp.region ? regionById.get(Number(sp.region)) : undefined;
  const back = `/admin/care?type=${current.slug}${sidoFilter ? `&sido=${sidoFilter}` : ""}`;

  return (
    <div>
      <AdminPageHeader
        title="돌봄 파트너 · 지역별 노출"
        description={`펫시터·도그워커는 주소가 아니라 서비스 지역(시군구)으로 노출됩니다. 지역마다 유형당 ${MAX_EXPOSED_PER_AREA}자리 — 여러 파트너가 등록된 지역은 여기서 누구를 켜 둘지 정합니다.`}
        right={
          <Link href="/admin/spots/new" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            파트너 등록
          </Link>
        }
      />

      {fullRegionName && (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
          {fullRegionName.sidoName} {fullRegionName.sigunguName} {person} 자리가 찼습니다 ({MAX_EXPOSED_PER_AREA}/{MAX_EXPOSED_PER_AREA}). 다른 파트너의 노출을 먼저 끄세요.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        {careTypes.map((t) => (
          <Link
            key={t.slug}
            href={`/admin/care?type=${t.slug}${sidoFilter ? `&sido=${sidoFilter}` : ""}`}
            className={`rounded-full px-3 py-1 font-medium ${t.slug === current.slug ? "bg-ink text-white" : "bg-sand text-ink-soft hover:text-ink"}`}
          >
            {carePersonLabel(t.slug) === t.name ? t.name : `${t.name} · ${carePersonLabel(t.slug)}`}
          </Link>
        ))}
        <form method="get" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="type" value={current.slug} />
          <select name="sido" defaultValue={sidoFilter} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
            <option value="">전체 시도</option>
            {sidos.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand">
            보기
          </button>
        </form>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        {current.name} 등록 {providers.length}명 · 노출 중 {exposedProviders}명 · 지역 {byRegion.size}곳 ·{" "}
        <Link href={`/spot/type/${current.slug}`} className="text-sea hover:underline">
          공개 페이지 보기 →
        </Link>
      </p>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          서비스 지역이 등록된 {person}가 없습니다. 스팟 등록에서 유형을 {current.name}로 고르면 서비스 지역 편집기가 나타납니다.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map(({ region, rows }) => {
            const exposed = rows.filter((r) => r.exposed).length;
            return (
              <section key={region.id} className="rounded-xl border border-line bg-surface">
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                  <h2 className="text-sm font-bold text-ink">
                    {region.sidoName} {region.sigunguName}
                  </h2>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${exposed >= MAX_EXPOSED_PER_AREA ? "bg-accent-soft text-accent-deep" : "bg-sea-soft text-sea"}`}>
                    노출 {exposed}/{MAX_EXPOSED_PER_AREA}
                  </span>
                  <span className="text-[11px] text-ink-faint">등록 {rows.length}명</span>
                  <Link href={`/spot/${region.sidoSlug}/${region.sigunguSlug}/${current.slug}`} className="ml-auto text-xs text-sea hover:underline">
                    지역 페이지 →
                  </Link>
                </header>
                <ul className="divide-y divide-line">
                  {rows.map(({ provider, exposed: on }) => (
                    <li key={provider.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                      <Link href={`/admin/spots/${provider.id}`} className="font-medium text-ink hover:underline">
                        {provider.name}
                      </Link>
                      <span className="text-[11px] text-ink-faint">{SPOT_STATUS_LABEL[provider.status] ?? provider.status}</span>
                      {provider.source === "sample" && <span className="rounded-full bg-honey-soft px-2 py-0.5 text-[10px] font-semibold text-honey">예시</span>}
                      {provider.source !== "sample" && <span className="text-[11px] text-ink-faint">{SPOT_SOURCE_LABEL[provider.source] ?? provider.source}</span>}
                      {provider.status !== "operating" && on && (
                        <span className="text-[11px] text-accent-deep">영업 중이 아니라 공개 목록에는 나오지 않음</span>
                      )}
                      <form action={toggleServiceAreaExposureAction} className="ml-auto">
                        <input type="hidden" name="spotId" value={provider.id} />
                        <input type="hidden" name="regionId" value={region.id} />
                        <input type="hidden" name="back" value={back} />
                        <button
                          type="submit"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-sage-soft text-sage-deep hover:bg-sage hover:text-white" : "bg-sand text-ink-soft hover:bg-ink hover:text-white"}`}
                        >
                          {on ? "노출 ON · 끄기" : "노출 OFF · 켜기"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
