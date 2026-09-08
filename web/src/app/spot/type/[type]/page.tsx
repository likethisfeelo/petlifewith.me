import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { B2BNote, PharmacyNote } from "@/components/notices";
import {
  countIndexableSpotsForType,
  getSpotTypeBySlug,
  listRegionCountsForType,
  type TypeRegionCount,
} from "@/lib/queries/spots";
import { buildMeta, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";
import { formatNumber } from "@/lib/format";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const spotType = await getSpotTypeBySlug(decodeURIComponent(type));
  if (!spotType) return { robots: robotsMeta(false) };
  const indexableCount = await countIndexableSpotsForType(spotType.id);
  return buildMeta({
    title: `전국 ${spotType.name}`,
    description: `${spotType.name} 시설의 전국 시군구별 현황. 행정안전부 지방행정 인허가데이터 기반으로 기준일과 함께 제공합니다.`,
    path: `/spot/type/${spotType.slug}`,
    indexable: shouldIndexRegionPage(indexableCount),
    ads: spotType.monetizable,
  });
}

export default async function SpotTypeHubPage({ params }: Props) {
  const { type } = await params;
  const spotType = await getSpotTypeBySlug(decodeURIComponent(type));
  if (!spotType) notFound();

  const rows = await listRegionCountsForType(spotType.id);
  const total = rows.reduce((a, r) => a + r.count, 0);

  // 시도별 그룹 (쿼리가 시도명 → 많은 순으로 정렬해 준다)
  const bySido = new Map<string, { sidoName: string; items: TypeRegionCount[]; subtotal: number }>();
  for (const row of rows) {
    const key = row.region.sidoSlug;
    const group = bySido.get(key) ?? { sidoName: row.region.sidoName, items: [], subtotal: 0 };
    group.items.push(row);
    group.subtotal += row.count;
    bySido.set(key, group);
  }
  const groups = [...bySido.values()].sort((a, b) => b.subtotal - a.subtotal);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: spotType.name, path: `/spot/type/${spotType.slug}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        전국 <span className="text-sea">{spotType.name}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        영업 중 {formatNumber(total)}곳 · 지역을 고르면 목록이 나옵니다.
        {spotType.description ? ` ${spotType.description}` : ""}
      </p>
      {spotType.listed && spotType.monetizable && (
        <p className="mt-3 rounded-lg border border-line bg-sand/60 px-4 py-2.5 text-sm text-ink-soft">
          이 유형의 업체를 운영하시나요? 기본 등록은 무료입니다 —{" "}
          <Link href="/portal/spot" className="font-medium text-sea underline">
            업체 정보 등록·관리 안내
          </Link>
        </p>
      )}

      {/* 장묘·동물약국: 광고를 붙이지 않는 영역 — 담담한 실무 정보만 (기획서 4-1·6-2) */}
      {!spotType.monetizable && (
        <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
          이 디렉토리에는 광고·추천·순위가 없습니다. 인허가 기반 사실 정보만 정리합니다.
        </p>
      )}
      {spotType.slug === "pharmacy" && <PharmacyNote />}
      {!spotType.listed && <B2BNote />}
      {spotType.slug === "rehab" && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">
          동물병원의 재활·한방·특수치료(침치료·수중런닝머신·체외충격파 등)는 치료법 기준의 별도 목록으로
          정리합니다 —{" "}
          <Link href="/rehab" className="font-semibold underline">
            재활·한방·특수치료 어디서 받을 수 있나 →
          </Link>
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          아직 등록된 곳이 없습니다. 인허가 데이터 적재와 직접 발굴로 채워집니다.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.sidoName}>
              <h2 className="text-lg font-bold text-ink">
                {group.sidoName} <span className="text-sm font-medium text-ink-faint">{formatNumber(group.subtotal)}곳</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map(({ region, count }) => (
                  <Link
                    key={region.id}
                    href={`/spot/${region.sidoSlug}/${region.sigunguSlug}/${spotType.slug}`}
                    className="rounded-full bg-sea-soft px-3 py-1 text-sm font-medium text-sea hover:bg-sea hover:text-white"
                  >
                    {region.sigunguName} {count}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로
        하며, 각 장소 페이지에 출처·기준일·관리번호를 표기합니다.
      </p>
    </div>
  );
}
