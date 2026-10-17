"use client";

// 펫세권 분석 — 시도 → (시군구) → 업종을 고르면 "업장 1곳당 등록 반려견 수"를 평균과 비교한다.
// 계산은 전부 받은 통계(lib/petsegwon/stats.ts)로 브라우저에서 한다. 분석은 누구나, 아래에 뉴스레터·회원가입 안내.
import { useEffect, useMemo, useRef, useState } from "react";
import { NewsletterCta } from "@/components/newsletter-cta";
import { track } from "@/components/tracker";
import {
  DEFAULT_INDUSTRY,
  SIDO_ORDER,
  fmtCount,
  industryList,
  industryName,
  regionResult,
  sigunguList,
  type PetsegwonLabel,
  type PetsegwonStats,
} from "@/lib/petsegwon/stats";
import { inputClass } from "@/app/admin/_components/fields";

const LABEL_TONE: Record<PetsegwonLabel, string> = {
  "공급 부족 후보": "bg-accent-soft text-accent-deep",
  평균권: "bg-sand text-ink",
  "밀집 지역": "bg-sea-soft text-sea",
  "표본 적음": "bg-line text-ink-soft",
  "업장 없음": "bg-line text-ink-soft",
};

function LabelBadge({ label }: { label: PetsegwonLabel }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${LABEL_TONE[label]}`}>{label}</span>;
}

function Bar({ name, value, max, strong }: { name: string; value: number | null; max: number; strong?: boolean }) {
  const w = value && max ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_4rem]">
      <span className={`truncate ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>{name}</span>
      <span className="h-3 overflow-hidden rounded-full bg-sand">
        <span className={`block h-full rounded-full ${strong ? "bg-accent" : "bg-ink-faint/50"}`} style={{ width: `${w}%` }} />
      </span>
      <span className={`text-right tabular-nums ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>{fmtCount(value)}</span>
    </div>
  );
}

export function PetsegwonTool({ stats }: { stats: PetsegwonStats }) {
  const industries = industryList(stats);
  const hasSigungu = stats.sigungu.length > 0;
  const [sido, setSido] = useState("서울");
  const [sigungu, setSigungu] = useState<string>("");
  const [ind, setInd] = useState(industries.includes(DEFAULT_INDUSTRY) ? DEFAULT_INDUSTRY : (industries[0] ?? DEFAULT_INDUSTRY));
  const [showRank, setShowRank] = useState(false);

  const sigungus = useMemo(() => sigunguList(stats, sido), [stats, sido]);
  const region = sigungu || null;
  const result = regionResult(stats, sido, region, ind);
  const regionName = region ? `${sido} ${region}` : sido;

  // 고를 때마다 한 번 (처음 열린 화면은 세지 않는다). 지역·업종 값은 페이지 문맥 키라 이벤트에 싣지 않는다
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    track("tool_action", { kind: "analyze", tool: "petsegwon" });
  }, [sido, region, ind]);

  // 업종 비교 — 같은 지역의 업종별 값
  const compareRows = industries.map((k) => ({ key: k, r: regionResult(stats, sido, region, k) }));

  // 순위 — 시군구를 골랐으면 그 시도 안 시군구, 아니면 전국 시도
  const rankRows = useMemo(() => {
    const rows = region
      ? sigungus.map((g) => ({ name: g.sigungu, value: g.industries[ind]?.per_shop ?? null, label: g.industries[ind]?.label ?? ("업장 없음" as PetsegwonLabel) }))
      : SIDO_ORDER.map((s) => {
          const r = regionResult(stats, s, null, ind);
          return { name: s, value: r?.perShop ?? null, label: r?.label ?? ("업장 없음" as PetsegwonLabel) };
        });
    return rows.filter((r) => r.value != null).sort((a, b) => b.value! - a.value!);
  }, [region, sigungus, stats, ind]);
  const rankMax = Math.max(...rankRows.map((r) => r.value ?? 0), 1);
  const barMax = Math.max(result?.perShop ?? 0, result?.sidoAvg ?? 0, result?.nationalAvg ?? 0, 1);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pet-sido" className="block text-sm font-medium text-ink">
              시도
            </label>
            <select
              id="pet-sido"
              value={sido}
              onChange={(e) => {
                setSido(e.target.value);
                setSigungu("");
              }}
              className={inputClass}
            >
              {SIDO_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pet-sigungu" className="block text-sm font-medium text-ink">
              시군구
            </label>
            <select id="pet-sigungu" value={sigungu} onChange={(e) => setSigungu(e.target.value)} disabled={!sigungus.length} className={`${inputClass} disabled:opacity-60`}>
              <option value="">{sido} 전체</option>
              {sigungus.map((g) => (
                <option key={g.sigungu} value={g.sigungu}>
                  {g.sigungu}
                </option>
              ))}
            </select>
            {!hasSigungu && <p className="mt-1 text-xs text-ink-faint">시군구별 분석은 준비 중이에요. 지금은 시도 단위로 비교합니다.</p>}
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">업종</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {industries.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={ind === k}
                onClick={() => setInd(k)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${ind === k ? "border-ink bg-ink font-semibold text-cream" : "border-line bg-cream text-ink-soft hover:bg-sand"}`}
              >
                {industryName(stats, k)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {result ? (
        <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <p className="text-sm text-ink-soft">
            {regionName} · {industryName(stats, ind)}
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-ink">
              <span className="text-base font-medium">업장 1곳당 반려견 </span>
              <strong className="text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">{fmtCount(result.perShop)}</strong>
              <span className="text-base font-medium">마리</span>
            </p>
            <LabelBadge label={result.label} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {result.pctOfCompare != null ? (
              <>
                {result.compareName}({fmtCount(result.compareAvg)}마리)의 <strong className="text-ink">{Math.round(result.pctOfCompare)}%</strong> 수준
              </>
            ) : (
              "비교할 평균이 없습니다"
            )}
            {result.rank && result.rankTotal && (
              <>
                {" · "}
                {result.rankScope} {result.rankTotal}곳 중 <strong className="text-ink">{result.rank}위</strong>
                <span className="text-ink-faint"> (1위 = 업장이 가장 모자란 곳)</span>
              </>
            )}
          </p>

          <div className="mt-6 space-y-2.5">
            <Bar name={region ?? sido} value={result.perShop} max={barMax} strong />
            {region && <Bar name={`${sido} 평균`} value={result.sidoAvg} max={barMax} />}
            <Bar name="전국 평균" value={result.nationalAvg} max={barMax} />
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            등록 반려견 {fmtCount(result.dogs)}마리 · 영업 중 업장 {region ? `약 ${fmtCount(result.shops)}` : fmtCount(result.shops)}곳
          </p>
        </section>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft">이 지역·업종은 자료가 없습니다.</p>
      )}

      <section aria-labelledby="pet-compare-title">
        <h3 id="pet-compare-title" className="text-base font-bold text-ink">
          {regionName} 업종별 비교
        </h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="bg-sand/60 text-left text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-2.5 font-medium">업종</th>
                <th className="px-4 py-2.5 text-right font-medium">1곳당 반려견</th>
                <th className="px-4 py-2.5 text-right font-medium">{region ? `${sido} 평균` : "전국 평균"}</th>
                <th className="px-4 py-2.5 text-right font-medium">평균 대비</th>
                <th className="px-4 py-2.5 font-medium">판정</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map(({ key, r }) => (
                <tr key={key} className={`border-t border-line ${key === ind ? "bg-accent-soft/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => setInd(key)} className={`hover:underline ${key === ind ? "font-bold text-ink" : "text-ink"}`}>
                      {industryName(stats, key)}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtCount(r?.perShop)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">{fmtCount(r?.compareAvg)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r?.pctOfCompare != null ? `${Math.round(r.pctOfCompare)}%` : "-"}</td>
                  <td className="px-4 py-2.5">{r ? <LabelBadge label={r.label} /> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="pet-rank-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="pet-rank-title" className="text-base font-bold text-ink">
            {region ? `${sido} 시군구` : "전국 시도"} 순위 · {industryName(stats, ind)}
          </h3>
          <button type="button" onClick={() => setShowRank((v) => !v)} aria-expanded={showRank} className="text-sm text-ink-soft hover:text-ink hover:underline">
            {showRank ? "접기" : `${rankRows.length}곳 모두 보기`}
          </button>
        </div>
        <ol className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-4">
          {(showRank ? rankRows : rankRows.slice(0, 5)).map((r, i) => (
            <li key={r.name}>
              <Bar name={`${i + 1}. ${r.name}`} value={r.value} max={rankMax} strong={r.name === (region ?? sido)} />
            </li>
          ))}
        </ol>
      </section>

      <div className="rounded-xl bg-sand/60 px-4 py-4 text-xs leading-relaxed text-ink-soft">
        <p>
          이 수치는 농림축산식품부 2025년 동물보호·복지 실태조사({stats.meta.baseline_reference_date.slice(0, 4)}년 {Number(stats.meta.baseline_reference_date.slice(5, 7))}월 말 기준)의
          시도별 등록 반려견 수와 영업장 수를 기준으로{hasSigungu ? ", 공공데이터포털의 시군구별 등록·인허가 자료로 배분해" : ""} 계산한 추정치입니다. 2026년 실태조사 결과가
          발표되는 대로 최신 기준으로 업데이트할 예정입니다.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-ink">계산 방법 자세히 보기</summary>
          <div className="mt-3 space-y-3">
            <p>
              <strong className="text-ink">업장 1곳당 등록 반려견 수 = 지역의 등록 반려견 수 ÷ 지역의 영업 중인 업장 수.</strong> 숫자가 클수록 업장 1곳에 대응하는 등록
              반려견이 많은 지역(공급 부족 후보)이고, 작을수록 업장이 몰려 있는 지역(밀집)입니다.
            </p>
            <p>
              판정 기준: 비교 대상 평균(시군구는 같은 시도 평균, 시도는 전국 평균)의 {stats.meta.thresholds.short}% 이상이면 &ldquo;공급 부족 후보&rdquo;,{" "}
              {stats.meta.thresholds.dense}% 미만이면 &ldquo;밀집 지역&rdquo;, 그 사이는 &ldquo;평균권&rdquo;입니다. 업장이 {stats.meta.thresholds.minShops}곳 미만인 지역은 값이
              크게 흔들려 &ldquo;표본 적음&rdquo;으로 표시합니다.
            </p>
            <p>
              <strong className="text-ink">반려견 수:</strong> 시군구별 등록 자료에는 사망한 반려견이 빠지지 않은 누적 건수가 포함되어 있습니다. 그래서 시군구별 자료는 시도
              안에서 각 시군구가 차지하는 비중을 구하는 데만 쓰고, 총량은 사망 개체를 제외한 2025년 실태조사의 시도별 수치에 맞춰 배분했습니다.
            </p>
            <p>
              <strong className="text-ink">업장 수:</strong> 인허가 자료에는 폐업·휴업 업장도 함께 들어 있어, 영업 중인 업장만 셌습니다. 이렇게 센 시도별 합계를 2025년
              실태조사의 시도별 업장 수와 대조했고, 시군구 값은 같은 방식으로 실태조사 시도 총량에 맞춰 배분했습니다. 이 보정 덕분에 시도·전국 평균은 농식품부 공식 통계와
              일치합니다. 대신 시군구 값은 비중을 이용한 추정치이므로 소수점이 생길 수 있고, 화면에는 반올림해 표시합니다.
            </p>
            <p>
              <strong className="text-ink">이 숫자로 알 수 없는 것:</strong> 등록하지 않은 반려견은 포함되지 않습니다(농어촌은 실제 반려견이 더 많을 수 있습니다). 반려견이 사는
              곳만 반영하고 실제로 어느 동네 업장을 이용하는지는 반영하지 않아, 업무 지구(예: 서울 종로구·중구)는 수치가 높게 나올 수 있습니다. 후보 지역을 좁히는 1차
              기준으로 쓰고, 창업·확장 결정 전에는 유동인구·출퇴근 동선·주차·임대료를 현장에서 확인하세요.
            </p>
            <p>
              <strong className="text-ink">업데이트:</strong> 업장 수는 공공데이터포털 인허가 자료로 매월 갱신하고, 기준 총량은 2026년 실태조사가 발표되는 대로 최신 연도로
              교체합니다.
            </p>
            <p>
              출처: 농림축산식품부 「2025년 동물보호·복지 실태조사」, 농림축산검역본부 「동물등록 현황」, 행정안전부 「동물 인허가 조회서비스」(공공데이터포털)
            </p>
          </div>
        </details>
      </div>

      <NewsletterCta
        title="추가 분석을 받아보고 싶다면, 뉴스레터를 구독하세요"
        description="시군구별 순위 변화, 새 업종 분석, 2026년 실태조사 업데이트처럼 펫세권 분석의 새 소식을 이메일로 먼저 보내 드려요."
        topic={`펫세권 분석 · ${regionName} · ${industryName(stats, ind)}`}
        signupDescription="CCTV 안내판 만들기·점검표 인쇄 같은 사장님 도구도 회원이면 바로 쓸 수 있어요."
      />
    </div>
  );
}
