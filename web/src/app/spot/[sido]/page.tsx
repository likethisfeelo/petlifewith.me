// 시도 페이지 — 지도가 이 시도로 펼쳐진 채 시작한다. 유형 칩을 고르면 배지와 시군구 타일 링크가
// 그 유형의 지역x유형 페이지(SEO 페이지)로 바뀐다. 우측은 시군구별 현황(지역 허브 링크)과 유형별 링크.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SpotDirectory, type TypeChip } from "@/components/spot/spot-directory";
import { formatNumber } from "@/lib/format";
import { listCareCountsByRegion, listCareSidoTotals } from "@/lib/queries/care";
import { listRegionTiles, listSigunguSummaries, listSigunguTypeCounts, listSpotTypes } from "@/lib/queries/spots";
import { SpotSearchBox } from "@/components/spot/spot-search-box";
import { TypeGroups } from "@/components/spot/type-groups";
import { buildMeta, robotsMeta } from "@/lib/seo";
import { SpotRegisterBanner } from "@/components/spot-register-banner";

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
  const [rows, regionTiles, typeCounts, careCounts, careSidoTotals, allTypes] = await Promise.all([
    listSigunguSummaries(sidoSlug),
    listRegionTiles(),
    listSigunguTypeCounts(sidoSlug),
    listCareCountsByRegion({ sidoSlug }), // 돌봄 파트너는 주소가 아니라 서비스 지역 기준
    listCareSidoTotals(sidoSlug), // 시도 배지·요약은 사람 수 기준
    listSpotTypes(),
  ]);
  if (rows.length === 0) notFound();
  const sidoName = rows[0]!.region.sidoName;
  const total = rows.reduce((a, r) => a + r.spotCount, 0);

  // 지도 배지("전체"): 이 시도의 시군구별 영업 중 스팟 수 (소비자 유형)
  const countsByRegion = Object.fromEntries(rows.map((r) => [r.region.id, r.spotCount]));
  // 유형 칩: 이 시도에 하나라도 있는 유형만, 유형 정렬 순서대로. 칩을 고르면 배지·타일 링크가 그 유형으로 바뀐다.
  // 돌봄 유형(펫시터·시간제 시터·도그워커)의 배지는 노출 중 파트너 수 — 타일 링크는 그 지역의 5자리 페이지.
  const typeMap = new Map<string, TypeChip & { sortOrder: number; total: number }>();
  const countsByType: Record<string, Record<number, number>> = {};
  for (const t of [...typeCounts, ...careCounts]) {
    const entry = typeMap.get(t.typeSlug) ?? { slug: t.typeSlug, name: t.typeName, sortOrder: t.sortOrder, total: 0 };
    entry.total += t.count;
    typeMap.set(t.typeSlug, entry);
    (countsByType[t.typeSlug] ??= {})[t.regionId] = t.count;
  }
  const types = [...typeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const typeTotals = new Map(types.map((t) => [t.slug, careSidoTotals[t.slug] ?? t.total]));
  const maxCount = Math.max(1, ...rows.map((r) => r.spotCount));

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      <SpotRegisterBanner regionLabel={sidoName} />

      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: sidoName, path: `/spot/${sidoSlug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-sea">{sidoName}</h1>
      <p className="mt-2 text-ink-soft">
        영업 중 {formatNumber(total)}곳 · 지역을 검색하거나, 지도에서 유형을 고르고 구·시·군을 누르면 그 지역의 목록으로 갑니다.
      </p>
      <div className="mt-5 max-w-3xl">
        <SpotSearchBox tiles={regionTiles} types={allTypes.map((t) => ({ slug: t.slug, name: t.name }))} size="md" placeholder={`${sidoName} 구·시·군 검색 (다른 지역도 가능)`} />
      </div>

      <div className="mt-8">
        <SpotDirectory
          regions={regionTiles}
          countsByRegion={countsByRegion}
          typeFilter={{
            types: types.map(({ slug, name }) => ({ slug, name })),
            countsByType,
            sidoTotals: careSidoTotals,
            units: Object.fromEntries(Object.keys(careSidoTotals).map((slug) => [slug, "명"])),
          }}
          selectedSido={sidoSlug}
          selectedRegionId={null}
          typeSlug={null}
          mapTitle={`${sidoName} 지역 지도`}
        >
          <section aria-labelledby="sigungu-heading" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="sigungu-heading" className="text-lg font-bold text-ink">
              시군구별 현황 <span className="text-sm font-medium text-ink-faint">{rows.length}개 지역</span>
            </h2>
            <p className="mt-1 text-xs text-ink-faint">숫자는 영업 중으로 확인된 스팟 수입니다. 지역을 누르면 그 지역의 전체 스팟과 데이터가 나옵니다.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {rows.map(({ region, spotCount }) => (
                <Link
                  key={region.id}
                  href={`/spot/${region.sidoSlug}/${region.sigunguSlug}`}
                  className={`rounded-xl border px-4 py-2.5 transition-shadow hover:shadow-md ${spotCount > 0 ? "border-line bg-cream" : "border-dashed border-line bg-transparent"}`}
                >
                  <span className="flex items-center justify-between">
                    <span className={spotCount > 0 ? "font-semibold text-ink" : "text-ink-faint"}>{region.sigunguName}</span>
                    <span className="text-sm text-ink-faint">{spotCount > 0 ? formatNumber(spotCount) : "-"}</span>
                  </span>
                  {spotCount > 0 && (
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sand" aria-hidden>
                      <span className="block h-full rounded-full bg-sea/60" style={{ width: `${(spotCount / maxCount) * 100}%` }} />
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>

        </SpotDirectory>
      </div>

      {types.length > 0 && (
        <section aria-labelledby="type-links-heading" className="mt-10">
          <h2 id="type-links-heading" className="mb-4 text-lg font-bold text-ink">
            {sidoName} 유형별 <span className="font-medium text-ink-faint">누르면 전국 지역 지도로 갑니다</span>
          </h2>
          <TypeGroups
            types={allTypes.filter((t) => typeTotals.has(t.slug))}
            counts={typeTotals}
            hrefFor={(slug) => `/spot/type/${slug}`}
            unitFor={(slug) => (careSidoTotals[slug] !== undefined ? "명" : "곳")}
          />
        </section>
      )}

    </div>
  );
}
