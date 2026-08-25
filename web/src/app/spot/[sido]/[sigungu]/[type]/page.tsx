import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SpotCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { RememberRegion } from "@/components/region-banner";
import {
  countIndexableSpotsInRegion,
  getRegionBySlugs,
  getSpotTypeBySlug,
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
  const indexableCount = await countIndexableSpotsInRegion(region.id, spotType.id);
  return buildMeta({
    title: `${region.sigunguName} ${spotType.name}`,
    description: `${region.sidoName} ${region.sigunguName}의 ${spotType.name} 목록. 인허가 데이터 기준일과 함께 제공합니다.`,
    path: `/spot/${region.sidoSlug}/${region.sigunguSlug}/${spotType.slug}`,
    // 지역 x 유형 페이지도 동일 게이트: 3곳 미만이면 noindex
    indexable: shouldIndexRegionPage(indexableCount),
  });
}

export default async function RegionTypePage({ params }: Props) {
  const { sido, sigungu, type } = await params;
  const [region, spotType] = await Promise.all([
    getRegionBySlugs(decodeURIComponent(sido), decodeURIComponent(sigungu)),
    getSpotTypeBySlug(decodeURIComponent(type)),
  ]);
  if (!region || !spotType) notFound();

  const spots = await listSpotsInRegion(region.id, spotType.id);
  const basePath = `/spot/${region.sidoSlug}/${region.sigunguSlug}`;

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
          { name: region.sigunguName, path: basePath },
          { name: spotType.name, path: `${basePath}/${spotType.slug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        {region.sigunguName} <span className="text-sea">{spotType.name}</span>
      </h1>
      {spotType.description && <p className="mt-2 text-sm text-ink-soft">{spotType.description}</p>}

      {/* 장묘: 광고를 붙이지 않는 영역 — 담담한 실무 정보만 (기획서 4-1) */}
      {!spotType.monetizable && (
        <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 목록에는 광고·추천·순위가 없습니다. 인허가 기반 사실 정보만 가나다순으로 정리합니다.
        </p>
      )}

      <section className="mt-8">
        {spots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 등록된 곳이 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((s) => (
              <SpotCard key={s.spot.id} item={s} />
            ))}
          </div>
        )}
      </section>

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
