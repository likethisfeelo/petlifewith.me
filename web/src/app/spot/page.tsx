import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RegionSuggestBanner } from "@/components/region-banner";
import { SpotRegisterBanner } from "@/components/spot-register-banner";
import { SpotSearchBox } from "@/components/spot/spot-search-box";
import { TypeGroups } from "@/components/spot/type-groups";
import { countSpotsByType, listRegionTiles, listSidoSummaries, listSpotTypes } from "@/lib/queries/spots";
import { buildMeta } from "@/lib/seo";
import { shortSido } from "@/lib/spot-search";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateMetadata(): Metadata {
  return buildMeta({
    title: "스팟 디렉토리 — 반려동물이 즐거운 곳",
    description: "스파, 셀프목욕, 수영장, 놀이터, 재활 시설. 동반 가능 여부가 아니라 즐거움에 직접 기여하는 곳만 모았습니다.",
    path: "/spot",
    indexable: true,
  });
}

// 스팟 첫 화면 — 목록(시군구x유형 SEO 페이지)으로 들어가는 입구: 검색창 → 유형 묶음 → 시도
export default async function SpotIndexPage() {
  const [sidoSummaries, allTypes, tiles, typeCounts] = await Promise.all([
    listSidoSummaries(),
    listSpotTypes({ includeUnlisted: true }),
    listRegionTiles(),
    countSpotsByType(),
  ]);
  const types = allTypes.filter((t) => t.listed);
  const b2bTypes = allTypes.filter((t) => !t.listed);
  const total = sidoSummaries.reduce((a, s) => a + s.spotCount, 0);
  const maxSido = Math.max(1, ...sidoSummaries.map((s) => s.spotCount));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <SpotRegisterBanner regionLabel="우리 동네" />

      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "스팟", path: "/spot" }]} />

      {/* 검색 — 어디서 · 무엇을 */}
      <section className="mt-6 rounded-3xl bg-sea-soft/60 px-5 py-8 sm:px-10 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          반려동물이 <span className="text-sea">즐거운 곳</span>, 동네에서 찾기
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">
          단순 동반 장소가 아니라 즐거움에 직접 기여하는 시설만 — 인허가 공공데이터 {total > 0 ? `${total.toLocaleString("ko-KR")}곳` : ""}에 직접 발굴을 더해 채워 갑니다.
        </p>
        <div className="mt-6 max-w-3xl">
          <SpotSearchBox tiles={tiles} types={types.map((t) => ({ slug: t.slug, name: t.name }))} />
        </div>
        <div className="mt-4 max-w-3xl">
          <RegionSuggestBanner />
        </div>
      </section>

      {types.length > 0 && (
        <section className="mt-10" aria-labelledby="type-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="type-heading" className="text-lg font-bold text-ink">
              무엇을 찾으세요?
            </h2>
            <p className="text-xs text-ink-faint">유형을 누르면 전국 지역 지도로 갑니다</p>
          </div>
          <div className="mt-4">
            <TypeGroups types={types} counts={typeCounts} hrefFor={(slug) => `/spot/type/${slug}`} />
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="sido-heading">
        <h2 id="sido-heading" className="text-lg font-bold text-ink">
          지역에서 시작하기
        </h2>
        {sidoSummaries.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">지역 데이터가 아직 없습니다. 시드·ETL 실행 후 표시됩니다.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
            {sidoSummaries.map((s) => (
              <Link key={s.sidoSlug} href={`/spot/${s.sidoSlug}`} className="group rounded-xl border border-line bg-surface px-4 py-3 transition-shadow hover:shadow-md">
                <span className="flex items-center justify-between">
                  <span className="font-bold text-ink group-hover:underline">{shortSido(s.sidoName)}</span>
                  <span className="text-sm text-ink-faint">{s.spotCount > 0 ? `${s.spotCount.toLocaleString("ko-KR")}곳` : "준비 중"}</span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden>
                  <span className="block h-full rounded-full bg-sea/70" style={{ width: `${(s.spotCount / maxSido) * 100}%` }} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        {/* 의료 인접 — 치료법이 주어인 별도 목록. 광고·순위 없음 (claude.md 6-2) */}
        <section className="rounded-2xl border border-sage/30 bg-sage-soft/60 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-sage-deep">재활·한방·특수치료 — 어디서 받을 수 있나</h2>
            <Link href="/rehab" className="text-sm font-medium text-sage-deep hover:underline">
              치료법으로 찾기 →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            침치료(CVA)·한방재활·수중런닝머신·체외충격파·고압산소·도수치료를 시행한다고 공개된 동물병원을 치료법 기준, 지역별 가나다순으로 정리합니다. 병원 추천·순위·광고 없이 사실만 둡니다.
          </p>
        </section>
      </div>

      {b2bTypes.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <span>유통·산업 (B2B 참고):</span>
          {b2bTypes.map((t) => (
            <Link key={t.id} href={`/spot/type/${t.slug}`} title={t.description ?? undefined} className="rounded-full border border-line px-2.5 py-0.5 transition-colors hover:bg-sand hover:text-ink">
              {t.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
