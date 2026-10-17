// 펫세권 분석 — 서버에서 그리는 시도별 표. 분석 도구는 브라우저에서만 그려지므로(자바스크립트),
// 검색엔진·스크립트 없이 보는 사람도 주요 수치를 읽을 수 있게 HTML 로 함께 싣는다.
import { SIDO_ORDER, fmtCount, industryList, industryName, type PetsegwonStats } from "@/lib/petsegwon/stats";

const MAIN = ["grooming", "boarding", "transport", "exhibition"];

export function PetsegwonSummary({ stats }: { stats: PetsegwonStats }) {
  const cols = industryList(stats, true).filter((k) => MAIN.includes(k));
  const year = stats.meta.baseline_reference_date.slice(0, 4);
  return (
    <details className="rounded-xl border border-line bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        시도별 업장 1곳당 등록 반려견 수 한눈에 보기 ({year}년 실태조사 기준)
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">
            시도별·업종별 업장 1곳당 등록 반려견 수 ({year}년 농림축산식품부 동물보호·복지 실태조사)
          </caption>
          <thead className="bg-sand text-left text-xs text-ink-soft">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                지역
              </th>
              {cols.map((k) => (
                <th key={k} scope="col" className="px-3 py-2 text-right font-medium">
                  {industryName(stats, k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="px-3 py-2 text-left">
                전국 평균
              </th>
              {cols.map((k) => (
                <td key={k} className="px-3 py-2 text-right tabular-nums">
                  {fmtCount(stats.national[k]?.per_shop)}
                </td>
              ))}
            </tr>
            {SIDO_ORDER.map((s) => (
              <tr key={s} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {s}
                </th>
                {cols.map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">
                    {fmtCount(stats.sido[s]?.industries[k]?.per_shop)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-faint">단위: 마리 (등록 반려견 수 ÷ 영업 중 업장 수, 반올림)</p>
      </div>
    </details>
  );
}
