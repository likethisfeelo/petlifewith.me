import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carePersonLabel, isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CareDirectory } from "@/components/care/care-directory";
import { SpotDirectory } from "@/components/spot/spot-directory";
import { B2BNote, PharmacyNote } from "@/components/notices";
import { countIndexableCareProviders, listCareProviders, listCareRegions } from "@/lib/queries/care";
import { countIndexableSpotsForType, getSpotTypeBySlug, listRegionCountsForType, listRegionTiles } from "@/lib/queries/spots";
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
  if (isCareType(spotType.slug)) {
    const person = carePersonLabel(spotType.slug);
    return buildMeta({
      title: person === spotType.name ? `전국 ${person} 찾기` : `전국 ${person} 찾기 — 지역별 ${spotType.name}`,
      description: `지역(시군구)별 ${person} 목록. 지역마다 5자리, 예약 신청과 카카오톡 상담으로 바로 연락합니다. 노령견 돌봄 경험을 확인하세요.`,
      path: `/spot/type/${spotType.slug}`,
      indexable: shouldIndexRegionPage(await countIndexableCareProviders(spotType.id)),
      ads: spotType.monetizable,
    });
  }
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

  if (isCareType(spotType.slug)) return <CareTypeHub spotType={spotType} />;

  const [rows, regionTiles] = await Promise.all([listRegionCountsForType(spotType.id), listRegionTiles()]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const countsByRegion = Object.fromEntries(rows.map((r) => [r.region.id, r.count]));

  // 우측 패널의 시도별 현황 — 시도 페이지(지도가 그 시도로 펼쳐진 상태)로 가는 진짜 링크
  const bySido = new Map<string, { sidoName: string; subtotal: number; regionCount: number }>();
  for (const row of rows) {
    const key = row.region.sidoSlug;
    const group = bySido.get(key) ?? { sidoName: row.region.sidoName, subtotal: 0, regionCount: 0 };
    group.subtotal += row.count;
    group.regionCount += 1;
    bySido.set(key, group);
  }
  const sidoRows = [...bySido.entries()].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.subtotal - a.subtotal);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
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
        영업 중 {formatNumber(total)}곳 · 지도에서 시도를 누르면 구·시·군이 펼쳐지고, 구·시·군을 누르면 그 지역의 목록 페이지로 갑니다.
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

      {/* 좌측 지도 + 우측 패널. 시군구 타일은 지역x유형 페이지로 가는 진짜 링크 (SEO 페이지 = 지도 페이지) */}
      <div className="mt-8">
        <SpotDirectory
          regions={regionTiles}
          countsByRegion={countsByRegion}
          selectedSido={null}
          selectedRegionId={null}
          typeSlug={spotType.slug}
          mapTitle={`${spotType.name} 지역 지도`}
        >
          {sidoRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
              아직 등록된 곳이 없습니다. 인허가 데이터 적재와 직접 발굴로 채워집니다.
            </p>
          ) : (
            <section aria-labelledby="sido-summary-heading" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="sido-summary-heading" className="text-lg font-bold text-ink">
                시도별 현황 <span className="text-sm font-medium text-ink-faint">{spotType.name} {formatNumber(total)}곳</span>
              </h2>
              <p className="mt-1 text-xs text-ink-faint">지도에서 구·시·군을 고르면 그 지역의 {spotType.name} 목록이 이 자리에 나옵니다.</p>
              <ul className="mt-4 divide-y divide-line">
                {sidoRows.map((row) => (
                  <li key={row.slug}>
                    <Link href={`/spot/${row.slug}`} className="group flex items-center justify-between py-2.5 text-sm">
                      <span className="font-semibold text-ink group-hover:underline">{row.sidoName}</span>
                      <span className="text-ink-faint">
                        {formatNumber(row.subtotal)}곳 · {row.regionCount}개 지역
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </SpotDirectory>
      </div>

      <p className="mt-10 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로
        하며, 각 장소 페이지에 출처·기준일·관리번호를 표기합니다.
      </p>
    </div>
  );
}

/** 돌봄 유형별 첫 문장 — 무엇을 하는 사람인지 한 줄로 */
const CARE_INTRO: Record<string, string> = {
  "pet-sitter": "보호자 집으로 와서 돌보는 방문 펫시터를 지역별로 찾습니다.",
  "hourly-sitter": "몇 시간 자리를 비울 때 시터 집에 아이를 맡기는 시간제 시터를 지역별로 찾습니다.",
  "dog-walk": "산책 대행·동행 도그워커를 지역별로 찾습니다.",
};

// 돌봄 파트너(펫시터·시간제 시터·펫산책): 주소가 아니라 서비스 지역으로 노출 — 좌측 지도, 우측 지역별 5자리
async function CareTypeHub({ spotType }: { spotType: NonNullable<Awaited<ReturnType<typeof getSpotTypeBySlug>>> }) {
  const person = carePersonLabel(spotType.slug);
  const [regions, providers] = await Promise.all([listCareRegions(), listCareProviders(spotType.id)]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: spotType.name, path: `/spot/type/${spotType.slug}` },
        ]}
      />
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">
        전국 <span className="text-sea">{person}</span> 찾기
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
        {CARE_INTRO[spotType.slug] ?? `${person}를 지역별로 찾습니다.`} 서울·경기·광역시는 구 단위, 그 밖은 시·군 단위로 지역마다 5자리를 둡니다.{" "}
        예약 신청을 남기면 운영자가 확인해 연결하고, 카카오톡 채널이 있는 파트너는 바로 상담할 수 있습니다.
      </p>
      <p className="mt-3 rounded-lg border border-line bg-sand/60 px-4 py-2.5 text-sm text-ink-soft">
        {person}로 활동하시나요? 지역별 자리는 무료이고 운영자 확인 후 노출됩니다 —{" "}
        <Link href="/portal/spot" className="font-medium text-sea underline">
          등록·관리 안내
        </Link>
      </p>

      <div className="mt-8">
        <CareDirectory typeSlug={spotType.slug} personLabel={person} regions={regions} providers={providers} />
      </div>

      <p className="mt-10 text-xs text-ink-faint">
        파트너 정보는 직접 확인과 등록 신청을 바탕으로 하며, 순위·평점을 매기지 않습니다. 개인 사업자의 상세 주소는 싣지 않고 활동
        지역(시군구)만 표기합니다.
      </p>
    </div>
  );
}
