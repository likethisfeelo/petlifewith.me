// 시도 x 유형 페이지 — /spot/<시도>/<유형> (예: /spot/gangwon/grooming = 강원 미용·스파)
// 같은 동적 경로를 시군구와 나눠 쓴다: 시군구 슬러그는 항상 -si/-gun/-gu 로 끝나 유형 슬러그와 겹치지 않는다 (lib/spot-paths.test.ts).
// 들어가자마자 그 시도 전체의 지도 + 목록. 시군구로 좁히면 기존 시군구 x 유형 페이지(SEO 페이지)로.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/jsonld";
import { B2BNote, PharmacyNote } from "@/components/notices";
import { SpotRegisterBanner } from "@/components/spot-register-banner";
import { SpotBrowser } from "@/components/spot/spot-browser";
import { SpotSidebar } from "@/components/spot/spot-sidebar";
import { idSlugPath } from "@/lib/format";
import {
  countIndexableSpotsInSido,
  countSpotsByType,
  getSpotTypeBySlug,
  listLinkKindsBySpot,
  listRegionCountsForType,
  listRegionTiles,
  listSpotTypes,
  listSpotsInRegion,
  type SpotTypeRow,
} from "@/lib/queries/spots";
import { buildMeta, itemListLd, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";
import { toBrowserSpots } from "@/lib/spot-browser-server";
import { TYPE_ICON, shortSido } from "@/lib/spot-search";

/** /spot/<시도>/<x> 의 x 가 유형이면 그 유형 (시군구가 아니면) */
export async function resolveSidoType(sidoSlug: string, key: string): Promise<{ type: SpotTypeRow; sidoName: string } | null> {
  const type = await getSpotTypeBySlug(key);
  if (!type) return null;
  const tiles = (await listRegionTiles()).filter((r) => r.sidoSlug === sidoSlug);
  if (tiles.length === 0) return null;
  return { type, sidoName: tiles[0]!.sidoName };
}

export async function sidoTypeMetadata(sidoSlug: string, found: { type: SpotTypeRow; sidoName: string }): Promise<Metadata> {
  const { type, sidoName } = found;
  if (isCareType(type.slug)) return { robots: robotsMeta(false) };
  const n = await countIndexableSpotsInSido(sidoSlug, type.id);
  return buildMeta({
    title: `${shortSido(sidoName)} ${type.name} — ${sidoName} ${type.name} ${n}곳 지도`,
    description: `${sidoName}의 ${type.name} ${n}곳을 지도와 목록으로. 시·군·구별로 좁혀 보고, 운영시간·주차·예약 정보를 확인하세요.`,
    path: `/spot/${sidoSlug}/${type.slug}`,
    indexable: shouldIndexRegionPage(n),
    ads: type.monetizable,
  });
}

export async function SidoTypePage({ sidoSlug, found }: { sidoSlug: string; found: { type: SpotTypeRow; sidoName: string } }) {
  const { type, sidoName } = found;
  // 돌봄 파트너는 주소가 아니라 서비스 지역 기준 — 전국 유형 허브(지역별 5자리)로
  if (isCareType(type.slug)) redirect(`/spot/type/${type.slug}`);

  const [spots, tiles, regionCounts, typeCounts, allTypes] = await Promise.all([
    listSpotsInRegion({ sidoSlug }, type.id, undefined, { plainOrder: !type.monetizable }),
    listRegionTiles(),
    listRegionCountsForType(type.id),
    countSpotsByType(sidoSlug),
    listSpotTypes({ includeUnlisted: true }),
  ]);
  const sidoRegions = tiles.filter((r) => r.sidoSlug === sidoSlug);
  if (sidoRegions.length === 0) notFound();
  const countsByRegion = Object.fromEntries(regionCounts.filter((r) => r.region.sidoSlug === sidoSlug).map((r) => [r.region.id, r.count]));
  const items = toBrowserSpots(spots, await listLinkKindsBySpot(spots.map((s) => s.spot.id)));
  const short = shortSido(sidoName);
  const basePath = `/spot/${sidoSlug}`;
  const listedTypes = allTypes.filter((t) => t.listed && !isCareType(t.slug) && (typeCounts.get(t.slug) ?? 0) > 0);
  const sidoTotal = listedTypes.reduce((a, t) => a + (typeCounts.get(t.slug) ?? 0), 0);
  const canAdvertise = type.listed && type.monetizable;
  // 업체 많은 시군구 — 좁혀 들어가는 지름길 (상위 8곳)
  const topAreas = sidoRegions
    .map((r) => ({ r, n: countsByRegion[r.id] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      {canAdvertise && <SpotRegisterBanner regionLabel={sidoName} typeSlug={type.slug} typeName={type.name} />}

      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: type.name, path: `/spot/type/${type.slug}` },
          { name: sidoName, path: `${basePath}/${type.slug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        {short} <span className="text-sea">{type.name}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {sidoName} 영업 중 {items.length.toLocaleString("ko-KR")}곳 · 시·군·구를 누르면 그 지역으로 좁혀 봅니다.
      </p>

      {!type.monetizable && (
        <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">이 목록에는 광고·추천·순위가 없습니다. 인허가 기반 사실 정보만 가나다순으로 정리합니다.</p>
      )}
      {type.slug === "pharmacy" && <PharmacyNote />}
      {!type.listed && <B2BNote />}

      {topAreas.length > 0 && (
        <nav aria-label={`${short} ${type.name} 많은 지역`} className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-soft">많은 지역</span>
          {topAreas.map(({ r, n }) => (
            <a key={r.id} href={`${basePath}/${r.sigunguSlug}/${type.slug}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-sea hover:text-sea">
              {r.sigunguName} <span className="text-xs font-medium text-ink-faint">{n}</span>
            </a>
          ))}
        </nav>
      )}

      <div className="mt-6">
        <SpotBrowser
          items={items}
          title={`${short} ${type.name}`}
          typeTabs={[
            { key: "all", label: "전체", count: sidoTotal, href: basePath, active: false },
            ...listedTypes.map((t) => ({ key: t.slug, label: t.name, count: typeCounts.get(t.slug) ?? 0, href: `${basePath}/${t.slug}`, icon: TYPE_ICON[t.slug], active: t.slug === type.slug })),
          ]}
          registerCard={canAdvertise ? { href: `/portal/spot?type=${type.slug}#register`, label: "여기에 내 업체를 소개하세요" } : null}
          sidebar={
            <SpotSidebar
              types={listedTypes.map((t) => ({ slug: t.slug, name: t.name, count: typeCounts.get(t.slug) ?? 0 }))}
              currentType={type.slug}
              basePath={basePath}
              sidoRegions={sidoRegions}
              currentRegionId={-1}
              typeSlug={type.slug}
              countsByRegion={countsByRegion}
              sidoName={sidoName}
              sidoSlug={sidoSlug}
            />
          }
        />
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로 하며, 각 장소 페이지에 출처·기준일을 표기합니다.
      </p>

      {items.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${sidoName} ${type.name}`,
            items: spots.slice(0, 100).map((s) => ({ name: s.spot.name, path: idSlugPath("place", s.spot.id, s.spot.slug) })),
          })}
        />
      )}
    </div>
  );
}
