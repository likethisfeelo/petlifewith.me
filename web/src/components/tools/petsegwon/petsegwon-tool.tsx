"use client";

// 펫세권 분석 — "내 지역을 조사하는 도구". 한 화면에서 선택 → 결과 → 해석, 그 아래 순위 탐색·실제 업장·계산 방법.
// 계산은 받은 통계(lib/petsegwon/stats.ts)로 브라우저에서 한다. 고른 지역·업종은 주소(?region=&sigungu=&category=)에 남겨 공유한다.
// 1차 사용자는 창업 준비자·업장 운영자 — 수치는 공급 비교 지표일 뿐 수요·수익성이 아니라는 점을 결과 바로 옆에 둔다.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { NewsletterCta } from "@/components/newsletter-cta";
import { RegionSearch } from "./region-search";
import { track } from "@/components/tracker";
import { analysisQuery, directoryLink, sidoFromSlug, sigunguFromParam } from "@/lib/petsegwon/links";
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
  type RegionResult,
} from "@/lib/petsegwon/stats";

const LABEL_TONE: Record<PetsegwonLabel, string> = {
  "업장 대비 등록견 많음": "bg-accent-soft text-accent-deep",
  "평균 수준": "bg-sand text-ink",
  "업장 대비 등록견 적음": "bg-sea-soft text-sea",
  "표본 적음": "bg-line text-ink-soft",
  "업장 없음": "bg-line text-ink-soft",
};

const selectClass =
  "mt-1 block w-full rounded-xl border border-line bg-cream px-3.5 py-3 text-[15px] font-semibold text-ink focus:border-ink focus:outline-none disabled:opacity-50";

function LabelBadge({ label, size = "sm" }: { label: PetsegwonLabel; size?: "sm" | "md" }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full font-bold ${size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"} ${LABEL_TONE[label]}`}>
      {label}
    </span>
  );
}

function Bar({ name, value, max, strong }: { name: string; value: number | null; max: number; strong?: boolean }) {
  const w = value && max ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_5rem]">
      <span className={`truncate ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>{name}</span>
      <span className="h-3.5 overflow-hidden rounded-full bg-sand">
        <span className={`block h-full rounded-full ${strong ? "bg-accent" : "bg-ink-faint/50"}`} style={{ width: `${w}%` }} />
      </span>
      <span className={`text-right tabular-nums ${strong ? "font-bold text-ink" : "text-ink-soft"}`}>{fmtCount(value)}마리</span>
    </div>
  );
}

/** 받침에 맞는 조사 (전남은 / 제주는, 평균과 / 서울와 아님) */
function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withBatchim : without;
}

/** "전남은 전국 평균보다 업장당 등록견 수가 약 40% 많아요." */
function compareSentence(name: string, r: RegionResult): string | null {
  if (r.pctOfCompare == null) return null;
  const diff = Math.round(r.pctOfCompare - 100);
  const subject = `${name}${josa(name, "은", "는")}`;
  if (Math.abs(diff) < 3) return `${subject} ${r.compareName}${josa(r.compareName, "과", "와")} 업장당 등록견 수가 비슷해요.`;
  return `${subject} ${r.compareName}보다 업장당 등록견 수가 약 ${Math.abs(diff)}% ${diff > 0 ? "많아요" : "적어요"}.`;
}

function readQuery(stats: PetsegwonStats, industries: string[]): { sido?: string; sigungu?: string; ind?: string } {
  const q = new URLSearchParams(window.location.search);
  const sido = sidoFromSlug(q.get("region") ?? "", SIDO_ORDER) ?? undefined;
  const sigunguRaw = q.get("sigungu");
  const sigungu = sido && sigunguRaw ? (sigunguFromParam(sido, sigunguRaw, sigunguList(stats, sido).map((g) => g.sigungu)) ?? undefined) : undefined;
  const cat = q.get("category") ?? "";
  return { sido, sigungu, ind: industries.includes(cat) ? cat : undefined };
}

export function PetsegwonTool({ stats }: { stats: PetsegwonStats }) {
  const industries = industryList(stats);
  const hasSigungu = stats.sigungu.length > 0;
  const year = stats.meta.baseline_reference_date.slice(0, 4);
  const [sido, setSido] = useState("서울");
  const [sigungu, setSigungu] = useState("");
  const [ind, setInd] = useState(industries.includes(DEFAULT_INDUSTRY) ? DEFAULT_INDUSTRY : (industries[0] ?? DEFAULT_INDUSTRY));
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const ready = useRef(false);
  const resultRef = useRef<HTMLElement>(null);

  // 공유 주소로 들어오면 그 지역·업종부터
  useEffect(() => {
    const q = readQuery(stats, industries);
    if (q.sido) setSido(q.sido);
    if (q.sigungu) setSigungu(q.sigungu);
    if (q.ind) setInd(q.ind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sigungus = useMemo(() => sigunguList(stats, sido), [stats, sido]);
  const region = sigungu || null;
  const regionName = region ? `${sido} ${region}` : sido;
  const result = regionResult(stats, sido, region, ind);
  const directory = directoryLink(sido, region, ind);
  const indName = industryName(stats, ind);

  // 고른 값을 주소에 남긴다 (새로 불러오지 않게 replaceState). 처음 열린 화면은 세지 않는다
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${analysisQuery(sido, region, ind)}`);
    track("tool_action", { kind: "analyze", tool: "petsegwon" });
  }, [sido, region, ind]);

  const pick = (nextSido: string, nextSigungu: string) => {
    setSido(nextSido);
    setSigungu(nextSigungu);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${analysisQuery(sido, region, ind)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      track("share", { channel: "copy_link", tool: "petsegwon" });
    } catch {
      window.prompt("이 주소를 복사하세요", url);
    }
  };

  // 순위 — 시군구를 골랐으면 그 시도 안 시군구, 아니면 전국 시도
  const scope = region ? `${sido} 시군구` : "전국 시도";
  const rankRows = useMemo(() => {
    const rows = region
      ? sigungus.map((g) => {
          const d = g.industries[ind];
          return { sido, sigungu: g.sigungu, name: g.sigungu, value: d?.per_shop ?? null, pct: d?.pct_of_sido_avg ?? null, label: d?.label ?? ("업장 없음" as PetsegwonLabel) };
        })
      : SIDO_ORDER.map((s) => {
          const r = regionResult(stats, s, null, ind);
          return { sido: s, sigungu: "", name: s, value: r?.perShop ?? null, pct: r?.pctOfCompare ?? null, label: r?.label ?? ("업장 없음" as PetsegwonLabel) };
        });
    return rows
      .filter((r) => r.value != null)
      .sort((a, b) => b.value! - a.value!)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [region, sigungus, stats, ind, sido]);
  const q = query.trim();
  const shownRanks = q ? rankRows.filter((r) => r.name.includes(q)) : rankRows;
  const barMax = Math.max(result?.perShop ?? 0, result?.sidoAvg ?? 0, result?.nationalAvg ?? 0, 1);
  const selectedName = region ?? sido;

  return (
    <div className="space-y-10">
      {/* 1. 선택 — 첫 화면에서 바로 시작 */}
      <section aria-labelledby="pet-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <p className="text-xs font-semibold tracking-wide text-sea">펫세권 데이터 분석 · {year}년 기준</p>
        <h2 id="pet-title" className="mt-1.5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          우리 지역, 반려동물 업장이 많은 편일까?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          지역과 업종을 선택해 업장 1곳당 등록 반려견 수를 비교해 보세요.
          {!hasSigungu && <span className="text-ink-faint"> 지금은 시·도 단위로 분석합니다 (시군구는 준비 중).</span>}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="text-xs font-medium text-ink-soft">
            <span id="pet-region-label">지역</span>
            <div className="mt-1">
              <RegionSearch
                stats={stats}
                value={regionName}
                onSelect={(o) => {
                  setSido(o.sido);
                  setSigungu(o.sigungu);
                }}
                className={selectClass.replace("mt-1 ", "")}
              />
            </div>
          </div>
          <label className="block text-xs font-medium text-ink-soft">
            업종
            <select value={ind} onChange={(e) => setInd(e.target.value)} className={selectClass}>
              {industries.map((k) => (
                <option key={k} value={k}>
                  {industryName(stats, k)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 2. 결과 + 해석 — 같은 카드 안에서 */}
        <section ref={resultRef} aria-live="polite" aria-label="분석 결과" className="mt-6 scroll-mt-24 rounded-xl bg-cream p-5 sm:p-6">
          {result ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink-soft">
                  {regionName} · {indName}
                </p>
                <button type="button" onClick={copyLink} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink">
                  {copied ? "복사했어요 ✓" : "이 결과 링크 복사"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-ink">
                  <strong className="text-5xl font-extrabold tracking-tight tabular-nums">{fmtCount(result.perShop)}</strong>
                  <span className="ml-1 text-lg font-bold">마리</span>
                </p>
                <LabelBadge label={result.label} size="md" />
              </div>
              <p className="mt-1 text-sm text-ink-soft">{indName}장 1곳당 등록 반려견 수</p>

              <div className="mt-5 space-y-2.5">
                <Bar name={selectedName} value={result.perShop} max={barMax} strong />
                {region && <Bar name={`${sido} 평균`} value={result.sidoAvg} max={barMax} />}
                <Bar name="전국 평균" value={result.nationalAvg} max={barMax} />
              </div>

              <p className="mt-5 text-[15px] font-semibold leading-relaxed text-ink">
                {compareSentence(selectedName, result) ?? "비교할 평균이 없습니다."}
                {result.rank && result.rankTotal && (
                  <span className="font-normal text-ink-soft">
                    {" "}
                    {result.rankScope} {result.rankTotal}곳 중 {result.rank === 1 ? "업장당 등록견이 가장 많아요." : `${result.rank}번째로 업장당 등록견이 많아요.`}
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                등록견 수 기준의 공급 비교 지표입니다. 실제 수요나 창업 수익성을 뜻하지는 않습니다. · 등록 반려견 {fmtCount(result.dogs)}마리 · 영업 중 업장{" "}
                {region ? `약 ${fmtCount(result.shops)}` : fmtCount(result.shops)}곳
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-soft">이 지역·업종은 자료가 없습니다.</p>
          )}
        </section>

        {/* 3. 다음 행동 — 실제 업장 */}
        {directory && (
          <Link
            href={directory.href}
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ink bg-ink px-5 py-4 text-cream hover:opacity-90"
          >
            <span>
              <span className="block text-xs text-cream/70">실제 업장 확인하기</span>
              <span className="block text-[15px] font-bold">{directory.label}</span>
            </span>
            <span aria-hidden className="text-xl">
              →
            </span>
          </Link>
        )}
      </section>

      {/* 4. 순위 탐색 — 행을 누르면 위 결과가 바뀐다 */}
      <section aria-labelledby="pet-rank-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="pet-rank-title" className="text-lg font-bold text-ink">
              {scope} 순위 · {indName}
            </h3>
            <p className="mt-0.5 text-xs text-ink-faint">업장당 등록견이 많은 순. 지역을 누르면 위 결과가 바뀝니다.</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지역 검색"
            aria-label="순위에서 지역 검색"
            className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm sm:w-48"
          />
        </div>
        <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand text-left text-xs text-ink-soft">
              <tr>
                <th className="w-12 px-3 py-2.5 font-medium">순위</th>
                <th className="px-3 py-2.5 font-medium">지역</th>
                <th className="px-3 py-2.5 text-right font-medium">1곳당</th>
                <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">{region ? `${sido} 평균 대비` : "전국 평균 대비"}</th>
                <th className="px-3 py-2.5 font-medium">판정</th>
              </tr>
            </thead>
            <tbody>
              {shownRanks.map((r) => {
                const on = r.name === selectedName;
                return (
                  <tr key={r.name} className={`border-t border-line ${on ? "bg-accent-soft/50" : "hover:bg-cream"}`}>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">{r.rank}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => pick(r.sido, r.sigungu)}
                        aria-current={on ? "true" : undefined}
                        className={`text-left hover:underline ${on ? "font-bold text-ink" : "text-ink"}`}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtCount(r.value)}</td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-soft sm:table-cell">{r.pct != null ? `${Math.round(r.pct)}%` : "-"}</td>
                    <td className="px-3 py-2.5">
                      <LabelBadge label={r.label} />
                    </td>
                  </tr>
                );
              })}
              {shownRanks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-faint">
                    &ldquo;{q}&rdquo; 지역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 같은 지역 업종별 비교 */}
      <section aria-labelledby="pet-compare-title">
        <h3 id="pet-compare-title" className="text-lg font-bold text-ink">
          {regionName} 업종별 비교
        </h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="bg-sand text-left text-xs text-ink-soft">
              <tr>
                <th className="px-3 py-2.5 font-medium">업종</th>
                <th className="px-3 py-2.5 text-right font-medium">1곳당</th>
                <th className="px-3 py-2.5 text-right font-medium">{region ? `${sido} 평균` : "전국 평균"}</th>
                <th className="px-3 py-2.5 text-right font-medium">평균 대비</th>
                <th className="px-3 py-2.5 font-medium">판정</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((k) => {
                const r = regionResult(stats, sido, region, k);
                return (
                  <tr key={k} className={`border-t border-line ${k === ind ? "bg-accent-soft/50" : ""}`}>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setInd(k)} className={`hover:underline ${k === ind ? "font-bold text-ink" : "text-ink"}`}>
                        {industryName(stats, k)}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtCount(r?.perShop)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtCount(r?.compareAvg)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r?.pctOfCompare != null ? `${Math.round(r.pctOfCompare)}%` : "-"}</td>
                    <td className="px-3 py-2.5">{r ? <LabelBadge label={r.label} /> : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. 계산 방법·출처·유의사항 — 관심 있는 사람만 펼친다 */}
      <section aria-label="계산 방법과 출처" className="rounded-xl bg-sand/60 px-4 py-4 text-xs leading-relaxed text-ink-soft sm:px-5">
        <p>
          농림축산식품부 {year}년 동물보호·복지 실태조사({year}년 {Number(stats.meta.baseline_reference_date.slice(5, 7))}월 말 기준)의 시도별 등록 반려견 수와 영업장 수
          {hasSigungu ? "를 기준으로, 공공데이터포털의 시군구별 등록·인허가 자료로 배분해" : "로"} 계산한 추정치입니다. 다음 실태조사가 발표되면 최신 기준으로 바꿉니다.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold text-ink">계산 방법·출처·유의사항 자세히 보기</summary>
          <div className="mt-3 space-y-3">
            <p>
              <strong className="text-ink">업장 1곳당 등록 반려견 수 = 지역의 등록 반려견 수 ÷ 지역의 영업 중인 업장 수.</strong> 숫자가 클수록 업장 1곳에 대응하는 등록 반려견이
              많고, 작을수록 적습니다.
            </p>
            <p>
              판정: 비교 대상 평균(시군구는 같은 시도 평균, 시도는 전국 평균)의 {stats.meta.thresholds.short}% 이상이면 &ldquo;업장 대비 등록견 많음&rdquo;,{" "}
              {stats.meta.thresholds.dense}% 미만이면 &ldquo;업장 대비 등록견 적음&rdquo;, 그 사이는 &ldquo;평균 수준&rdquo;입니다. 업장이 {stats.meta.thresholds.minShops}곳
              미만인 지역은 값이 크게 흔들려 &ldquo;표본 적음&rdquo;으로 표시합니다.
            </p>
            <p>
              <strong className="text-ink">반려견 수:</strong> 시군구별 등록 자료는 사망한 반려견이 빠지지 않은 누적 건수라, 시도 안에서 각 시군구가 차지하는 비중을 구하는 데만
              쓰고 총량은 사망 개체를 제외한 실태조사의 시도별 수치에 맞춰 배분했습니다.
            </p>
            <p>
              <strong className="text-ink">업장 수:</strong> 인허가 자료에서 영업 중인 업장만 셌고, 시군구 값은 같은 방식으로 실태조사 시도 총량에 맞춰 배분했습니다. 그래서
              시도·전국 평균은 농식품부 공식 통계와 같고, 시군구 값은 소수점이 생길 수 있는 추정치입니다(화면은 반올림).
            </p>
            <p>
              <strong className="text-ink">이 숫자로 알 수 없는 것:</strong> 등록하지 않은 반려견, 실제로 어느 동네 업장을 이용하는지, 업장 규모·가격·품질은 반영되지 않습니다.
              업무 지구(예: 서울 종로구·중구)는 거주 반려견이 적어 수치가 다르게 나올 수 있습니다. 후보 지역을 좁히는 1차 기준으로 쓰고, 창업·확장 결정 전에는 유동인구·동선·
              주차·임대료를 현장에서 확인하세요.
            </p>
            <p>출처: 농림축산식품부 「동물보호·복지 실태조사」, 농림축산검역본부 「행정구역별 반려동물등록 개체 수 현황」, 행정안전부 「동물 인허가 정보」(공공데이터포털)</p>
          </div>
        </details>
      </section>

      <NewsletterCta
        title="추가 분석을 받아보고 싶다면, 뉴스레터를 구독하세요"
        description="시군구별 순위 변화, 새 업종 분석, 실태조사 업데이트처럼 펫세권 분석의 새 소식을 이메일로 먼저 보내 드려요."
        topic={`펫세권 분석 · ${regionName} · ${indName}`}
        signupDescription="CCTV 안내판 만들기·점검표 인쇄 같은 사장님 도구도 회원이면 바로 쓸 수 있어요."
      />
    </div>
  );
}
