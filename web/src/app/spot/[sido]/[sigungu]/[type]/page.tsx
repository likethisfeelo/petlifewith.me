import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carePersonLabel, isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SpotCard } from "@/components/cards";
import { CareAreaSlots } from "@/components/care/care-slots";
import { SpotDirectory } from "@/components/spot/spot-directory";
import { CARE_INTRO, countProvidersByRegion, countProvidersBySido, providersInArea } from "@/lib/care";
import { countIndexableCareProviders, listCareProviders, listCareRegions } from "@/lib/queries/care";
import { JsonLd } from "@/components/jsonld";
import { RememberRegion } from "@/components/region-banner";
import { B2BNote, PharmacyNote } from "@/components/notices";
import {
  countIndexableSpotsInRegion,
  getRegionBySlugs,
  getSpotTypeBySlug,
  listRegionCountsForType,
  listRegionTiles,
  listSpotsInRegion,
} from "@/lib/queries/spots";
import { buildMeta, itemListLd, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";
import { idSlugPath } from "@/lib/format";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ sido: string; sigungu: string; type: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sido, sigungu, type } = await params;
  const [region, spotType] = await Promise.all([
    getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu)),
    getSpotTypeBySlug(decodeURIComponent(type)),
  ]);
  if (!region || !spotType) return { robots: robotsMeta(false) };
  if (isCareType(spotType.slug)) {
    const person = carePersonLabel(spotType.slug);
    return buildMeta({
      title: `${region.sigunguName} ${person}`,
      description: `${region.sidoName} ${region.sigunguName}에서 활동하는 ${person} 목록. 지역당 5자리, 예약 신청·카카오톡 상담.`,
      path: `/spot/${region.sidoSlug}/${region.sigunguSlug}/${spotType.slug}`,
      indexable: shouldIndexRegionPage(await countIndexableCareProviders(spotType.id, region.id)),
      ads: spotType.monetizable,
    });
  }
  const indexableCount = await countIndexableSpotsInRegion(region.id, spotType.id);
  return buildMeta({
    title: `${region.sigunguName} ${spotType.name}`,
    description: `${region.sidoName} ${region.sigunguName}의 ${spotType.name} 목록. 인허가 데이터 기준일과 함께 제공합니다.`,
    path: `/spot/${region.sidoSlug}/${region.sigunguSlug}/${spotType.slug}`,
    // 지역 x 유형 페이지도 동일 게이트: 3곳 미만이면 noindex
    indexable: shouldIndexRegionPage(indexableCount),
    ads: spotType.monetizable,
  });
}

export default async function RegionTypePage({ params }: Props) {
  const { sido, sigungu, type } = await params;
  const [region, spotType] = await Promise.all([
    getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu)),
    getSpotTypeBySlug(decodeURIComponent(type)),
  ]);
  if (!region || !spotType) notFound();
  const basePath = `/spot/${region.sidoSlug}/${region.sigunguSlug}`;
  const remember = { sidoSlug: region.sidoSlug, sigunguSlug: region.sigunguSlug, label: `${region.sidoName} ${region.sigunguName}` };

  // 돌봄 파트너: 주소가 아니라 서비스 지역 기준 — 이 지역의 5자리. 시설과 같은 셸(좌측 지도, 이 지역 강조)이고
  // 지도 배지는 유형 전체의 노출 중 파트너 수라 다른 구를 누르면 그 지역 페이지로 간다 (SEO 페이지 = 지도 페이지).
  if (isCareType(spotType.slug)) {
    const person = carePersonLabel(spotType.slug);
    const [providers, regions] = await Promise.all([listCareProviders(spotType.id), listCareRegions()]);
    const inArea = providersInArea(providers, region.id);
    const countsByRegion = countProvidersByRegion(providers);
    const countsBySido = countProvidersBySido(providers, regions);
    const regionNameById = Object.fromEntries(regions.map((r) => [r.id, r.sigunguName]));
    // 구조화 데이터에는 가상의 예시를 넣지 않는다
    const realProviders = inArea.filter((p) => p.source !== "sample");
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <RememberRegion region={remember} />
        <Breadcrumbs
          crumbs={[
            { name: "홈", path: "/" },
            { name: "스팟", path: "/spot" },
            { name: region.sidoName, path: `/spot/${region.sidoSlug}` },
            { name: region.sigunguName, path: basePath },
            { name: spotType.name, path: `${basePath}/${spotType.slug}` },
          ]}
        />

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
          {region.sigunguName} <span className="text-sea">{person}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
          {CARE_INTRO[spotType.slug] ?? `${person}를 지역별로 찾습니다.`} 지역마다 5자리. 예약 신청을 남기면 운영자가 확인해 연결하고,
          카카오톡 채널이 있는 파트너는 바로 상담할 수 있습니다.
        </p>

        <div className="mt-8">
          <SpotDirectory
            regions={regions}
            countsByRegion={countsByRegion}
            countsBySido={countsBySido}
            total={providers.length}
            unit="명"
            selectedSido={region.sidoSlug}
            selectedRegionId={region.id}
            typeSlug={spotType.slug}
            mapTitle={`${person} 지역 지도`}
          >
            <CareAreaSlots personLabel={person} region={region} providers={inArea} regionNameById={regionNameById} />
          </SpotDirectory>
        </div>

        <p className="mt-6 text-xs text-ink-faint">
          파트너 정보는 직접 확인과 등록 신청을 바탕으로 하며, 순위·평점을 매기지 않습니다. 개인 사업자의 상세 주소는 싣지 않고 활동
          지역(시군구)만 표기합니다.
        </p>

        {realProviders.length > 0 && (
          <JsonLd
            data={itemListLd({
              name: `${region.sigunguName} ${person}`,
              items: realProviders.map((p) => ({ name: p.name, path: idSlugPath("place", p.id, p.slug) })),
            })}
          />
        )}
      </div>
    );
  }

  const [spots, regionTiles, counts] = await Promise.all([
    listSpotsInRegion(region.id, spotType.id),
    listRegionTiles(),
    listRegionCountsForType(spotType.id),
  ]);
  const countsByRegion = Object.fromEntries(counts.map((r) => [r.region.id, r.count]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <RememberRegion region={remember} />
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: region.sidoName, path: `/spot/${region.sidoSlug}` },
          { name: region.sigunguName, path: basePath },
          { name: spotType.name, path: `${basePath}/${spotType.slug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        {region.sigunguName} <span className="text-sea">{spotType.name}</span>
      </h1>
      {spotType.description && <p className="mt-2 text-sm text-ink-soft">{spotType.description}</p>}

      {/* 장묘·동물약국: 광고를 붙이지 않는 영역 — 담담한 실무 정보만 (기획서 4-1·6-2) */}
      {!spotType.monetizable && (
        <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 목록에는 광고·추천·순위가 없습니다. 인허가 기반 사실 정보만 가나다순으로 정리합니다.
        </p>
      )}
      {spotType.slug === "pharmacy" && <PharmacyNote />}
      {!spotType.listed && <B2BNote />}

      {/* 좌측 지도(이 지역 강조) + 우측 목록. 다른 시군구 타일을 누르면 그 지역 페이지로 간다 — 이 페이지가 곧 SEO 페이지 */}
      <div className="mt-8">
        <SpotDirectory
          regions={regionTiles}
          countsByRegion={countsByRegion}
          selectedSido={region.sidoSlug}
          selectedRegionId={region.id}
          typeSlug={spotType.slug}
          mapTitle={`${spotType.name} 지역 지도`}
        >
          <section aria-labelledby="region-list-heading">
            <h2 id="region-list-heading" className="text-sm font-bold text-ink">
              {region.sigunguName} {spotType.name} <span className="font-medium text-ink-faint">{spots.length}곳</span>
            </h2>
            {spots.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
                아직 등록된 곳이 없습니다.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {spots.map((s) => (
                  <SpotCard key={s.spot.id} item={s} />
                ))}
              </div>
            )}
          </section>
        </SpotDirectory>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로
        하며, 각 장소 페이지에 출처·기준일을 표기합니다.
      </p>

      {spots.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${region.sigunguName} ${spotType.name}`,
            items: spots.map((s) => ({ name: s.spot.name, path: idSlugPath("place", s.spot.id, s.spot.slug) })),
          })}
        />
      )}
    </div>
  );
}
