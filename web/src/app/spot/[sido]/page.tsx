// 시도 페이지 — 들어오자마자 그 시도 전체 지도·목록 (시도 x 유형·시군구 x 유형과 같은 화면 틀).
// 맨 위: 이 지역 등록 업체 줄(상단 노출 → 프리미엄 → 등록), 시·군·구 칩(검색·더 보기, 진짜 링크).
// 지도·목록은 수천 곳이라 HTML 에 싣지 않고 브라우저가 /api/spots/browse 에서 불러온다 (components/spot/lazy-spot-browser).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AreaChips } from "@/components/spot/area-chips";
import { LazySpotBrowser } from "@/components/spot/lazy-spot-browser";
import { ShowcaseStrip } from "@/components/spot/showcase-strip";
import { SpotSidebar } from "@/components/spot/spot-sidebar";
import { SpotRegisterBanner } from "@/components/spot-register-banner";
import { formatNumber } from "@/lib/format";
import { listCareSidoTotals } from "@/lib/queries/care";
import { listShowcaseInSido } from "@/lib/queries/spot-pages";
import { countSpotsByType, listRegionTiles, listSigunguSummaries, listSpotTypes } from "@/lib/queries/spots";
import { buildMeta, robotsMeta } from "@/lib/seo";
import { TYPE_ICON, generalGusOf, shortSido } from "@/lib/spot-search";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ sido: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sido } = await params;
  const rows = await listSigunguSummaries(decodeURIComponent(sido));
  if (rows.length === 0) return { robots: robotsMeta(false) };
  const sidoName = rows[0]!.region.sidoName;
  const total = rows.reduce((a, r) => a + r.spotCount, 0);
  return buildMeta({
    title: `${sidoName} 반려동물 스팟`,
    description: `${sidoName}의 스파·셀프목욕·수영장·놀이터·재활 시설 ${total}곳을 시군구별로 정리했습니다.`,
    path: `/spot/${rows[0]!.region.sidoSlug}`,
    indexable: total > 0,
  });
}

export default async function SidoPage({ params }: Props) {
  const { sido } = await params;
  const sidoSlug = decodeURIComponent(sido);
  const [rows, tiles, typeCounts, careSidoTotals, allTypes, showcase] = await Promise.all([
    listSigunguSummaries(sidoSlug),
    listRegionTiles(),
    countSpotsByType(sidoSlug),
    listCareSidoTotals(sidoSlug), // 돌봄 파트너는 서비스 지역 기준 사람 수
    listSpotTypes(),
    listShowcaseInSido(sidoSlug),
  ]);
  if (rows.length === 0) notFound();
  const sidoName = rows[0]!.region.sidoName;
  const short = shortSido(sidoName);
  const total = rows.reduce((a, r) => a + r.spotCount, 0);
  const basePath = `/spot/${sidoSlug}`;
  const countsByRegion = Object.fromEntries(rows.map((r) => [r.region.id, r.spotCount]));

  // 유형 칩 — 시설 유형은 시도 x 유형, 돌봄 유형은 서비스 지역 기준 전국 허브(사람 수)
  const facilityTypes = allTypes.filter((t) => !isCareType(t.slug) && (typeCounts.get(t.slug) ?? 0) > 0);
  const careTypes = allTypes.filter((t) => isCareType(t.slug) && (careSidoTotals[t.slug] ?? 0) > 0);
  const facilityTotal = facilityTypes.reduce((a, t) => a + (typeCounts.get(t.slug) ?? 0), 0);
  const typeTabs = [
    { key: "all", label: "전체", count: facilityTotal, href: basePath, active: true },
    ...facilityTypes.map((t) => ({ key: t.slug, label: t.name, count: typeCounts.get(t.slug) ?? 0, href: `${basePath}/${t.slug}`, icon: TYPE_ICON[t.slug], active: false })),
    ...careTypes.map((t) => ({ key: t.slug, label: t.name, count: careSidoTotals[t.slug] ?? 0, href: `/spot/type/${t.slug}`, icon: TYPE_ICON[t.slug], active: false })),
  ];
  const areaChips = rows
    .filter((r) => r.spotCount > 0)
    .map((r) => ({ name: r.region.sigunguName, href: `${basePath}/${r.region.sigunguSlug}`, count: r.spotCount, gus: generalGusOf(sidoName, r.region.sigunguName) }));

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      <SpotRegisterBanner regionLabel={sidoName} />

      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: sidoName, path: basePath },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        {short} <span className="text-sea">반려동물 스팟</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">{sidoName} 영업 중 {formatNumber(total)}곳 · 유형이나 시·군·구를 골라 좁혀 보세요.</p>

      {areaChips.length > 0 && (
        <div className="mt-5">
          <AreaChips areas={areaChips} label="시·군·구" placeholder={`${short} 시·군·구 검색`} />
        </div>
      )}

      <ShowcaseStrip title={`${short} 등록 업체`} spots={showcase} />

      <div className="mt-6">
        <LazySpotBrowser
          sidoSlug={sidoSlug}
          title={`${short} 전체`}
          typeTabs={typeTabs}
          registerCard={{ href: "/portal/spot#register", label: "여기에 내 업체를 소개하세요" }}
          sidebar={
            <SpotSidebar
              types={facilityTypes.map((t) => ({ slug: t.slug, name: t.name, count: typeCounts.get(t.slug) ?? 0 }))}
              currentType={null}
              basePath={basePath}
              sidoRegions={tiles.filter((r) => r.sidoSlug === sidoSlug)}
              currentRegionId={-1}
              typeSlug={null}
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
    </div>
  );
}
