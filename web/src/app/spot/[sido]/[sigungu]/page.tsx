import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SpotBrowser } from "@/components/spot/spot-browser";
import { toBrowserSpots } from "@/lib/spot-browser-server";
import { TYPE_ICON } from "@/lib/spot-search";
import { JsonLd } from "@/components/jsonld";
import { RememberRegion } from "@/components/region-banner";
import { RegionDataBlock } from "@/components/region-data-block";
import { SpotDirectory } from "@/components/spot/spot-directory";
import { listCareCountsByRegion } from "@/lib/queries/care";
import { guidesForRegion } from "@/lib/queries/guides";
import {
  countIndexableSpotsInRegion,
  countSpotsByTypeInRegion,
  getRegionBySlugs,
  getRegionDogStats,
  listRegionTiles,
  listRegionTotals,
  listLinkKindsBySpot,
  listSpotsInRegion,
} from "@/lib/queries/spots";
import { buildMeta, itemListLd, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";
import { idSlugPath } from "@/lib/format";
import { SpotRegisterBanner } from "@/components/spot-register-banner";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ sido: string; sigungu: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sido, sigungu } = await params;
  const region = await getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu));
  if (!region) return { robots: robotsMeta(false) };
  // 얇은 콘텐츠 방지: 스팟 3개 미만 지역 페이지 → noindex (claude.md 5-3)
  const indexableCount = await countIndexableSpotsInRegion(region.id);
  return buildMeta({
    title: `${region.sidoName} ${region.sigunguName} 반려동물 스팟`,
    description: `${region.sigunguName}의 스파·셀프목욕·수영장·놀이터·재활 시설과 지역 데이터를 정리했습니다.`,
    path: `/spot/${region.sidoSlug}/${region.sigunguSlug}`,
    indexable: shouldIndexRegionPage(indexableCount),
  });
}

export default async function SigunguPage({ params }: Props) {
  const { sido, sigungu } = await params;
  const region = await getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu));
  if (!region) notFound();

  // 적재 후 지역당 수백 곳이 될 수 있다 — 지역 허브는 상위 일부만 보여주고 전체는 유형 페이지로
  const REGION_LIST_LIMIT = 48;
  const [spots, addressTypeCounts, dogStats, related, regionTiles, countsByRegion, careCounts] = await Promise.all([
    listSpotsInRegion(region.id, undefined, REGION_LIST_LIMIT),
    countSpotsByTypeInRegion(region.id),
    getRegionDogStats(region.id),
    guidesForRegion(region.id),
    listRegionTiles(),
    listRegionTotals(),
    listCareCountsByRegion({ regionId: region.id }), // 돌봄 파트너는 이 지역을 서비스 지역으로 둔 사람 수
  ]);
  const allTypeCounts = [...addressTypeCounts, ...careCounts].sort((a, b) => b.count - a.count);
  // 소비자 유형만 혼합 목록·분포에. B2B 참고 유형은 아래 별도 줄에서 지역x유형 페이지로 링크한다.
  const typeCounts = allTypeCounts.filter((c) => c.listed);
  const infraCounts = allTypeCounts.filter((c) => !c.listed);
  const listedTotal = typeCounts.reduce((a, c) => a + c.count, 0);
  const items = toBrowserSpots(spots, await listLinkKindsBySpot(spots.map((s) => s.spot.id)));

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6">
      <SpotRegisterBanner regionLabel={`${region.sidoName} ${region.sigunguName}`} regionId={region.id} />

      <RememberRegion
        region={{
          sidoSlug: region.sidoSlug,
          sigunguSlug: region.sigunguSlug,
          label: `${region.sidoName} ${region.sigunguName}`,
        }}
      />
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: region.sidoName, path: `/spot/${region.sidoSlug}` },
          { name: region.sigunguName, path: `/spot/${region.sidoSlug}/${region.sigunguSlug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        {region.sidoName} <span className="text-sea">{region.sigunguName}</span>
      </h1>

      {/* 좌측 지도(이 지역 강조, 배지는 전체 스팟 수) + 우측 지역 정보·목록. 시군구 타일은 지역 허브로 간다 */}
      <div className="mt-6">
        <SpotDirectory
          regions={regionTiles}
          countsByRegion={countsByRegion}
          selectedSido={region.sidoSlug}
          selectedRegionId={region.id}
          typeSlug={null}
          mapTitle={`${region.sidoName} 지역 지도`}
        >
      <div>
        <RegionDataBlock
          sidoSlug={region.sidoSlug}
          sigunguSlug={region.sigunguSlug}
          sigunguName={region.sigunguName}
          typeCounts={typeCounts}
          dogStats={dogStats}
          relatedGuides={related}
        />
      </div>

      {infraCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <span>유통·산업 인허가 (B2B 참고):</span>
          {infraCounts.map((c) => (
            <Link
              key={c.typeId}
              href={`/spot/${region.sidoSlug}/${region.sigunguSlug}/${c.typeSlug}`}
              className="rounded-full border border-line px-2.5 py-0.5 transition-colors hover:bg-sand hover:text-ink"
            >
              {c.typeName} {c.count}곳
            </Link>
          ))}
          <span>— 소비자 시설이 아닌 업체 간 인허가 정보입니다</span>
        </div>
      )}

        </SpotDirectory>
      </div>

      <section className="mt-10">
        {spots.length < listedTotal && (
          <p className="mb-2 text-xs text-ink-faint">
            스팟 {listedTotal.toLocaleString("ko-KR")}곳 중 {spots.length}곳을 보여 줍니다 — 전체 목록은 위 유형별 링크에서 볼 수 있습니다.
          </p>
        )}
        <SpotBrowser
          items={items}
          title={`${region.sigunguName} 스팟`}
          showSidebar={false}
          typeTabs={[
            { key: "all", label: "전체", count: listedTotal, href: `/spot/${region.sidoSlug}/${region.sigunguSlug}`, active: true },
            ...typeCounts.map((c) => ({
              key: c.typeSlug,
              label: c.typeName,
              count: c.count,
              href: `/spot/${region.sidoSlug}/${region.sigunguSlug}/${c.typeSlug}`,
              icon: TYPE_ICON[c.typeSlug],
              active: false,
            })),
          ]}
          emptyText="아직 등록된 스팟이 없습니다. 인허가 데이터 적재와 직접 발굴로 채워집니다."
        />
      </section>

      <p className="mt-6 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로
        하며, 각 장소 페이지에 출처·기준일을 표기합니다.
      </p>


      {spots.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${region.sidoName} ${region.sigunguName} 반려동물 스팟`,
            items: spots.map((s) => ({ name: s.spot.name, path: idSlugPath("place", s.spot.id, s.spot.slug) })),
          })}
        />
      )}
    </div>
  );
}
