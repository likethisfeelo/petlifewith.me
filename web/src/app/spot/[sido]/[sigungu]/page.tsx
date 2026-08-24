import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SpotCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { RememberRegion } from "@/components/region-banner";
import { RegionDataBlock } from "@/components/region-data-block";
import { guidesForRegion } from "@/lib/queries/guides";
import {
  countIndexableSpotsInRegion,
  countSpotsByTypeInRegion,
  getRegionBySlugs,
  getRegionDogStats,
  listSpotsInRegion,
} from "@/lib/queries/spots";
import { canonicalUrl, itemListLd, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";
import { idSlugPath } from "@/lib/format";

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
  return {
    title: `${region.sidoName} ${region.sigunguName} 반려동물 스팟`,
    description: `${region.sigunguName}의 스파·셀프목욕·수영장·놀이터·재활 시설과 지역 데이터를 정리했습니다.`,
    alternates: { canonical: canonicalUrl(`/spot/${region.sidoSlug}/${region.sigunguSlug}`) },
    robots: robotsMeta(shouldIndexRegionPage(indexableCount)),
  };
}

export default async function SigunguPage({ params }: Props) {
  const { sido, sigungu } = await params;
  const region = await getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu));
  if (!region) notFound();

  const [spots, typeCounts, dogStats, related] = await Promise.all([
    listSpotsInRegion(region.id),
    countSpotsByTypeInRegion(region.id),
    getRegionDogStats(region.id),
    guidesForRegion(region.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
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

      <div className="mt-6">
        <RegionDataBlock
          sidoSlug={region.sidoSlug}
          sigunguSlug={region.sigunguSlug}
          sigunguName={region.sigunguName}
          typeCounts={typeCounts}
          dogStats={dogStats}
          relatedGuides={related}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">스팟 {spots.length}곳</h2>
        {spots.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 등록된 스팟이 없습니다. 인허가 데이터 적재와 직접 발굴로 채워집니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((s) => (
              <SpotCard key={s.spot.id} item={s} />
            ))}
          </div>
        )}
      </section>

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
