// 지역 페이지 고유 데이터 블록 (claude.md 5-3)
// 인허가 덤프 사이트와 갈라지는 지점: 스팟 밀도·유형 분포·노령견 비율·관련 콘텐츠.
import Link from "next/link";
import type { RegionTypeCount } from "@/lib/queries/spots";
import type { GuideRow } from "@/lib/queries/guides";
import { SENIOR_AGE_YEARS, computeSeniorRatio, type DogStatRow } from "@/lib/stats";
import { formatNumber, formatPercent } from "@/lib/format";

interface Props {
  sidoSlug: string;
  sigunguSlug: string;
  sigunguName: string;
  typeCounts: RegionTypeCount[];
  dogStats: { rows: DogStatRow[]; referenceDate: string | null };
  relatedGuides: GuideRow[];
}

export function RegionDataBlock({ sidoSlug, sigunguSlug, sigunguName, typeCounts, dogStats, relatedGuides }: Props) {
  const total = typeCounts.reduce((a, c) => a + c.count, 0);
  const senior = dogStats.referenceDate ? computeSeniorRatio(dogStats.rows, dogStats.referenceDate) : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-bold text-ink">{sigunguName} 한눈에 보기</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-sand p-4">
          <dt className="text-xs text-ink-soft">영업 중 스팟</dt>
          <dd className="mt-1 text-2xl font-extrabold text-ink">{formatNumber(total)}곳</dd>
        </div>
        <div className="rounded-xl bg-sand p-4">
          <dt className="text-xs text-ink-soft">가장 많은 유형</dt>
          <dd className="mt-1 text-2xl font-extrabold text-ink">
            {typeCounts[0] ? typeCounts[0].typeName : "—"}
          </dd>
        </div>
        <div className="rounded-xl bg-sage-soft p-4">
          <dt className="text-xs text-sage-deep">등록견 중 노령견 비율</dt>
          <dd className="mt-1 text-2xl font-extrabold text-sage-deep">
            {senior?.ratio != null ? formatPercent(senior.ratio) : "집계 전"}
          </dd>
          {senior?.ratio != null && dogStats.referenceDate && (
            <p className="mt-1 text-[11px] leading-snug text-sage-deep/70">
              동물등록 {formatNumber(senior.total)}마리 중 만 {SENIOR_AGE_YEARS}세 이상 · {dogStats.referenceDate} 기준
            </p>
          )}
        </div>
      </dl>

      {typeCounts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {typeCounts.map((c) => (
            <Link
              key={c.typeId}
              href={`/spot/${sidoSlug}/${sigunguSlug}/${c.typeSlug}`}
              className="rounded-full bg-sea-soft px-3 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white"
            >
              {c.typeName} {c.count}
            </Link>
          ))}
        </div>
      )}

      {relatedGuides.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink-soft">이 지역이 등장한 이야기</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {relatedGuides.map((g) => (
              <li key={g.id}>
                <Link href={`/guide/${g.slug}`} className="text-ink hover:underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
