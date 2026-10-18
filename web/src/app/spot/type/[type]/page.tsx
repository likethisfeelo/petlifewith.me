import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carePersonLabel, isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RegionSuggestBanner } from "@/components/region-banner";
import { SpotDirectory } from "@/components/spot/spot-directory";
import { B2BNote, MedicalNotice, PharmacyNote } from "@/components/notices";
import { CARE_INTRO, countProvidersByRegion, countProvidersBySido, primaryArea, type CareRegion } from "@/lib/care";
import { countIndexableCareProviders, listCareProviders, listCareRegions } from "@/lib/queries/care";
import { countIndexableSpotsForType, countSpotsByType, getSpotTypeBySlug, listRegionCountsForType, listRegionTiles, listSpotTypes } from "@/lib/queries/spots";
import { SpotRegisterBanner } from "@/components/spot-register-banner";
import { SpotSearchBox } from "@/components/spot/spot-search-box";
import { TypeGroups } from "@/components/spot/type-groups";
import { shortSido } from "@/lib/spot-search";
import { regionHref } from "@/lib/regions";
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

  const [rows, regionTiles, allTypes, typeCounts] = await Promise.all([listRegionCountsForType(spotType.id), listRegionTiles(), listSpotTypes(), countSpotsByType()]);
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
  const maxSido = Math.max(1, ...sidoRows.map((r) => r.subtotal));

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      {/* 장묘·약국·B2B 유형은 광고·영업 유도를 붙이지 않는다 */}
      {spotType.listed && spotType.monetizable && <SpotRegisterBanner regionLabel="우리 동네" typeSlug={spotType.slug} typeName={spotType.name} />}

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
      {spotType.listed && (
        <div className="mt-5 max-w-3xl">
          <SpotSearchBox tiles={regionTiles} types={allTypes.map((t) => ({ slug: t.slug, name: t.name }))} defaultType={spotType.slug} size="md" placeholder={`${spotType.name} — 지역명 검색 (예: 영통구, 해운대)`} />
        </div>
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
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
            수중 러닝머신·밸런스 기구처럼 <span className="font-semibold text-ink">재활·특수 훈련 장비를 갖춘 곳</span>만 싣습니다. 어떤 장비가 있는지는 업체 페이지에 사실대로 적고,
            기기 자체는 <Link href="/device" className="font-semibold text-sea underline">관리·재활 도구</Link>에서 본사·대리점·체험 가능 업체까지 이어집니다.
          </p>
          <p className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">
            동물병원의 재활·한방·특수치료(침치료·수중런닝머신·체외충격파 등)는 치료법 기준의 별도 목록으로
            정리합니다 —{" "}
            <Link href="/rehab" className="font-semibold underline">
              재활·한방·특수치료 어디서 받을 수 있나 →
            </Link>
          </p>
          <MedicalNotice />
        </div>
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
              <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {sidoRows.map((row) => (
                  <Link key={row.slug} href={`/spot/${row.slug}`} className="group rounded-xl border border-line bg-cream px-4 py-2.5 transition-shadow hover:shadow-md">
                    <span className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink group-hover:underline">{shortSido(row.sidoName)}</span>
                      <span className="text-ink-faint">
                        {formatNumber(row.subtotal)}곳 · {row.regionCount}개 지역
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sand" aria-hidden>
                      <span className="block h-full rounded-full bg-sea/60" style={{ width: `${(row.subtotal / maxSido) * 100}%` }} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </SpotDirectory>
      </div>

      {spotType.listed && (
        <section aria-labelledby="other-types-heading" className="mt-10">
          <h2 id="other-types-heading" className="mb-4 text-lg font-bold text-ink">
            다른 유형 보기
          </h2>
          <TypeGroups types={allTypes} counts={typeCounts} hrefFor={(slug) => `/spot/type/${slug}`} currentSlug={spotType.slug} unitFor={(slug) => (isCareType(slug) ? "명" : "곳")} />
        </section>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        시설 정보는 행정안전부 지방행정 인허가데이터(공공데이터포털 data.go.kr)와 직접 확인을 바탕으로
        하며, 각 장소 페이지에 출처·기준일·관리번호를 표기합니다.
      </p>
    </div>
  );
}

// 돌봄 파트너(펫시터·시간제 시터·도그워커): 주소가 아니라 서비스 지역으로 노출.
// 시설 디렉토리와 같은 셸 — 좌측 지도(배지는 노출 중 파트너 수), 시군구 타일은 지역x유형 페이지(5자리)로 가는 진짜 링크.
// 우측은 파트너가 있는 시도·시군구 현황. 최근 본 지역이 있으면 그 지역 페이지로 가는 제안 배너를 띄운다.
async function CareTypeHub({ spotType }: { spotType: NonNullable<Awaited<ReturnType<typeof getSpotTypeBySlug>>> }) {
  const person = carePersonLabel(spotType.slug);
  const [regions, providers, allTypes, typeCounts] = await Promise.all([listCareRegions(), listCareProviders(spotType.id), listSpotTypes(), countSpotsByType()]);
  const countsByRegion = countProvidersByRegion(providers);
  const countsBySido = countProvidersBySido(providers, regions);
  const areaCount = Object.keys(countsByRegion).length;

  // 우측 패널: 파트너가 있는 시도 → 시군구 칩 (지역x유형 페이지 링크). 시도는 사람 수 순
  const groups = new Map<string, { sidoName: string; sidoSlug: string; areas: Array<{ region: CareRegion; n: number }> }>();
  for (const r of regions) {
    const n = countsByRegion[r.id] ?? 0;
    if (n <= 0) continue;
    const g = groups.get(r.sidoSlug) ?? { sidoName: r.sidoName, sidoSlug: r.sidoSlug, areas: [] };
    g.areas.push({ region: r, n });
    groups.set(r.sidoSlug, g);
  }
  const sidoGroups = [...groups.values()].sort((a, b) => (countsBySido[b.sidoSlug] ?? 0) - (countsBySido[a.sidoSlug] ?? 0));

  // 처음 펼쳐 둘 시도: 첫 파트너의 1순위 지역이 있는 시도 (없으면 서울)
  const first = primaryArea(providers[0]);
  const openSido = (first && regions.find((r) => r.id === first.regionId)?.sidoSlug) || "seoul";

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
      <SpotRegisterBanner regionLabel="우리 동네" typeSlug={spotType.slug} typeName={person} care />

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
        지도에서 구·시·군을 누르면 그 지역의 {person} 페이지로 갑니다. 예약 신청을 남기면 운영자가 확인해 연결하고, 카카오톡 채널이 있는
        파트너는 바로 상담할 수 있습니다.
      </p>
      <div className="mt-4">
        <RegionSuggestBanner typeSlug={spotType.slug} />
      </div>

      <div className="mt-8">
        <SpotDirectory
          regions={regions}
          countsByRegion={countsByRegion}
          countsBySido={countsBySido}
          total={providers.length}
          unit="명"
          selectedSido={openSido}
          selectedRegionId={null}
          typeSlug={spotType.slug}
          mapTitle={`${person} 지역 지도`}
        >
          {sidoGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
              아직 노출 중인 {person}가 없습니다. 등록 신청을 받는 중입니다.
            </p>
          ) : (
            <section aria-labelledby="care-areas-heading" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="care-areas-heading" className="text-lg font-bold text-ink">
                지역별 현황{" "}
                <span className="text-sm font-medium text-ink-faint">
                  {person} {providers.length}명 · 지역 {areaCount}곳 · 지역마다 5자리
                </span>
              </h2>
              <p className="mt-1 text-xs text-ink-faint">지역을 누르면 그 지역의 {person} 자리(예약 신청·카카오톡 상담) 페이지로 갑니다.</p>
              <ul className="mt-4 divide-y divide-line">
                {sidoGroups.map((g) => (
                  <li key={g.sidoSlug} className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{g.sidoName}</span>
                      <span className="text-ink-faint">
                        {countsBySido[g.sidoSlug] ?? 0}명 · {g.areas.length}개 지역
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.areas.map(({ region, n }) => (
                        <Link
                          key={region.id}
                          href={regionHref(region, spotType.slug)}
                          className="rounded-full bg-sea-soft px-3 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white"
                        >
                          {region.sigunguName} {n}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </SpotDirectory>
      </div>

      <section aria-labelledby="other-types-heading" className="mt-10">
        <h2 id="other-types-heading" className="mb-4 text-lg font-bold text-ink">
          다른 유형 보기
        </h2>
        <TypeGroups types={allTypes} counts={typeCounts} hrefFor={(slug) => `/spot/type/${slug}`} currentSlug={spotType.slug} unitFor={(slug) => (isCareType(slug) ? "명" : "곳")} />
      </section>

      <p className="mt-10 text-xs text-ink-faint">
        파트너 정보는 직접 확인과 등록 신청을 바탕으로 하며, 순위·평점을 매기지 않습니다. 개인 사업자의 상세 주소는 싣지 않고 활동
        지역(시군구)만 표기합니다.
      </p>
    </div>
  );
}
