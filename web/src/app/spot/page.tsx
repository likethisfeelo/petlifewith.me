import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RegionSuggestBanner } from "@/components/region-banner";
import { listSidoSummaries, listSpotTypes } from "@/lib/queries/spots";
import { buildMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateMetadata(): Metadata {
  return buildMeta({
    title: "스팟 디렉토리 — 반려동물이 즐거운 곳",
    description: "스파, 셀프목욕, 수영장, 놀이터, 재활 시설. 동반 가능 여부가 아니라 즐거움에 직접 기여하는 곳만 모았습니다.",
    path: "/spot",
    indexable: true,
  });
}

export default async function SpotIndexPage() {
  const [sidoSummaries, allTypes] = await Promise.all([
    listSidoSummaries(),
    listSpotTypes({ includeUnlisted: true }),
  ]);
  const types = allTypes.filter((t) => t.listed);
  const b2bTypes = allTypes.filter((t) => !t.listed);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "스팟", path: "/spot" }]} />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-sea">스팟 — 가는 곳</h1>
        <p className="mt-3 text-ink-soft">
          카페·펜션 같은 단순 동반 장소가 아니라, 반려동물의 즐거움에 직접 기여하는 시설만 다룹니다. 인허가
          공공데이터에 직접 발굴을 더해 채워갑니다.
        </p>
      </header>

      <div className="mt-6">
        <RegionSuggestBanner />
      </div>

      {types.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-ink">유형</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {types.map((t) => (
              <Link
                key={t.id}
                href={`/spot/type/${t.slug}`}
                title={t.description ?? undefined}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  t.monetizable
                    ? "bg-sea-soft text-sea hover:bg-sea hover:text-white"
                    : "bg-sand text-ink-soft hover:bg-ink hover:text-cream"
                }`}
              >
                {t.name}
                {!t.monetizable && <span className="ml-1 text-xs opacity-70">· 광고 없음</span>}
              </Link>
            ))}
          </div>
          {b2bTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>유통·산업 (B2B 참고):</span>
              {b2bTypes.map((t) => (
                <Link
                  key={t.id}
                  href={`/spot/type/${t.slug}`}
                  title={t.description ?? undefined}
                  className="rounded-full border border-line px-2.5 py-0.5 transition-colors hover:bg-sand hover:text-ink"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-bold text-ink">지역에서 시작하기</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sidoSummaries.map((s) => (
            <Link
              key={s.sidoSlug}
              href={`/spot/${s.sidoSlug}`}
              className="group flex items-center justify-between rounded-xl border border-line bg-surface px-5 py-4 transition-shadow hover:shadow-md"
            >
              <span className="font-bold text-ink group-hover:underline">{s.sidoName}</span>
              <span className="text-sm text-ink-faint">
                {s.spotCount > 0 ? `${s.spotCount}곳` : "준비 중"}
              </span>
            </Link>
          ))}
        </div>
        {sidoSummaries.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            지역 데이터가 아직 없습니다. 시드·ETL 실행 후 표시됩니다.
          </p>
        )}
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-sand/60 p-6 text-sm text-ink-soft">
        <h2 className="font-bold text-ink">업체를 운영하시나요?</h2>
        <p className="mt-1">
          기본 등록은 무료입니다. 각 장소 페이지의 <strong>“이 장소를 운영하시나요?”</strong> 버튼으로 정보 관리를
          요청하면 확인 후 반영해 드립니다. 잘못된 정보 정정도 같은 경로로 받습니다.
        </p>
      </section>
    </div>
  );
}
