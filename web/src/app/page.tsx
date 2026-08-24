import Link from "next/link";
import { GuideCard, MakerCard } from "@/components/cards";
import { isDbConfigured } from "@/lib/db";
import { latestPublishedGuides, listTopics } from "@/lib/queries/guides";
import { listPublishedCurations } from "@/lib/queries/curations";
import { listPublishedMakers } from "@/lib/queries/makers";
import { listSidoSummaries, listSpotTypes } from "@/lib/queries/spots";
import { TOPIC_PHASE_LABEL, formatDate } from "@/lib/format";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 600; // REVALIDATE.home

export default async function HomePage() {
  const [topics, latest, sidoSummaries, spotTypes, makers, curations] = await Promise.all([
    listTopics(),
    latestPublishedGuides(6),
    listSidoSummaries(),
    listSpotTypes(),
    listPublishedMakers(4),
    listPublishedCurations(),
  ]);

  const initialTopics = topics.filter((t) => t.phase === "initial");
  const laterTopics = topics.filter((t) => t.phase !== "initial" && t.slug !== "spot");
  const topSido = sidoSummaries.filter((s) => s.spotCount > 0).slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* 포지셔닝 히어로 */}
      <section className="py-14 sm:py-20">
        <p className="text-sm font-semibold text-accent-deep">반려동물의 즐거움을 다루는 미디어</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          어디에 데려갈 수 있을까가 아니라,
          <br />
          <span className="text-accent">무엇이 즐거울까</span>를 묻습니다
        </h1>
        <p className="mt-4 max-w-2xl text-ink-soft">
          스파, 셀프목욕, 노즈워크, 마사지, 그리고 노견의 하루. 주어가 사람이 아니라 반려동물인 이야기를
          정리합니다.
        </p>
      </section>

      {!isDbConfigured() && (
        <div className="mb-10 rounded-xl border border-line bg-sand p-5 text-sm text-ink-soft">
          DATABASE_URL 이 설정되지 않아 콘텐츠가 비어 있습니다. 루트 <code>.env.local</code> 을 채우고
          마이그레이션·시드를 실행하세요 (<code>docs/운영.md</code> 참조).
        </div>
      )}

      {/* 두 개의 초기 클러스터 — 함께 민다 */}
      {initialTopics.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {initialTopics.map((t) => {
            const style = topicStyle(t.slug);
            return (
              <Link
                key={t.id}
                href={`/topic/${t.slug}`}
                className={`group rounded-2xl border p-6 transition-shadow hover:shadow-md ${style.card}`}
              >
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                  {TOPIC_PHASE_LABEL[t.phase]}
                </span>
                <h2 className={`mt-3 text-xl font-extrabold ${style.heading} group-hover:underline`}>{t.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.description}</p>
              </Link>
            );
          })}
        </section>
      )}

      {/* 최신 콘텐츠 */}
      {latest.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold text-ink">새로 나온 이야기</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map(({ guide, topic }) => (
              <GuideCard key={guide.id} guide={guide} topic={topic} />
            ))}
          </div>
        </section>
      )}

      {/* 스팟 디렉토리 진입 */}
      <section className="mt-14 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink">스팟 — 반려동물이 즐거운 곳</h2>
          <Link href="/spot" className="text-sm font-medium text-sea hover:underline">
            전체 디렉토리 →
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          스파·셀프목욕·수영장·놀이터·재활. 동반 가능 여부가 아니라 즐거움에 직접 기여하는 시설만 다룹니다.
        </p>
        {spotTypes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {spotTypes.map((t) => (
              <span key={t.id} className="rounded-full bg-sea-soft px-3 py-1 text-xs font-medium text-sea">
                {t.name}
              </span>
            ))}
          </div>
        )}
        {topSido.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-sm">
            {topSido.map((s) => (
              <Link
                key={s.sidoSlug}
                href={`/spot/${s.sidoSlug}`}
                className="rounded-full border border-line px-3 py-1 text-ink-soft hover:bg-sand hover:text-ink"
              >
                {s.sidoName} <span className="text-ink-faint">{s.spotCount}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 메이커 */}
      {makers.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold text-ink">메이커 — 만드는 곳</h2>
            <Link href="/maker" className="text-sm font-medium text-honey hover:underline">
              전체 보기 →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            검색 상위에 안 잡히는 작은 브랜드일수록 가치가 큽니다. 직접 만드는 곳만 소개합니다.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {makers.map(({ maker, regionLabel }) => (
              <MakerCard key={maker.id} maker={maker} regionLabel={regionLabel} />
            ))}
          </div>
        </section>
      )}

      {/* 큐레이션 */}
      {curations.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold text-ink">크리에이터 큐레이션</h2>
            <Link href="/curation" className="text-sm font-medium text-plum hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {curations.slice(0, 2).map((c) => (
              <Link
                key={c.id}
                href={`/curation/${c.themeSlug}`}
                className="group rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
              >
                <span className="rounded-full bg-plum-soft px-2 py-0.5 text-xs font-medium text-plum">테마 큐레이션</span>
                <h3 className="mt-2 font-bold text-ink group-hover:underline">{c.title}</h3>
                <p className="mt-2 text-xs text-ink-faint">{formatDate(c.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 다음 확장 클러스터 */}
      {laterTopics.length > 0 && (
        <section className="mt-14 mb-4">
          <h2 className="text-sm font-bold text-ink-faint">다음에 확장할 클러스터</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {laterTopics.map((t) => (
              <span key={t.id} className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-ink-faint">
                {t.name} — 준비 중
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
