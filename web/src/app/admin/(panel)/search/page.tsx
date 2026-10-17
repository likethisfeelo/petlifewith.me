// 검색 유입 — Search Console 데이터를 우리 DB 에 매일 쌓은 것 (16개월 넘게 보관, data/src/gsc/sync.ts)
import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { getOptionalEnv } from "@/lib/config";
import {
  SEARCH_DEVICES,
  getSearchCoverage,
  getSearchDaily,
  getSearchDetail,
  getSearchSummary,
  getTopPages,
  getTopQueries,
  isFiltered,
  parseSearchFilter,
  type SearchFilter,
} from "@/lib/queries/search";
import { AdminPageHeader, inputClass } from "../../_components/fields";
import { SearchSyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const VIEWS = [
  { key: "queries", label: "검색어 순위" },
  { key: "pages", label: "페이지 순위" },
  { key: "detail", label: "날짜별 상세" },
] as const;
const DETAIL_PAGE = 200;
const DEVICE_LABEL: Record<string, string> = { DESKTOP: "PC", MOBILE: "모바일", TABLET: "태블릿" };

const n = (v: number) => v.toLocaleString("ko-KR");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pos = (v: number) => (v ? v.toFixed(1) : "—");

function href(f: SearchFilter, extra: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  const all: Record<string, string | undefined> = { from: f.from, to: f.to, q: f.q, page: f.page, device: f.device, ...extra };
  for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
  return `?${p.toString()}`;
}

function rangeFrom(latest: string, days: number): string {
  const d = new Date(`${latest}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const sp = await searchParams;
  const coverage = await getSearchCoverage();
  const f = parseSearchFilter(sp, coverage.latest);
  const viewRaw = typeof sp.view === "string" ? sp.view : "queries";
  const view = VIEWS.some((v) => v.key === viewRaw) ? viewRaw : "queries";
  const pageNo = Math.max(1, Number(typeof sp.p === "string" ? sp.p : 1) || 1);
  const connected = Boolean(getOptionalEnv("GSC_SYNC_FUNCTION"));

  const [summary, daily, queries, pages, detail] = await Promise.all([
    getSearchSummary(f),
    getSearchDaily(f),
    view === "queries" ? getTopQueries(f) : Promise.resolve([]),
    view === "pages" ? getTopPages(f) : Promise.resolve([]),
    view === "detail" ? getSearchDetail(f, DETAIL_PAGE + 1, (pageNo - 1) * DETAIL_PAGE) : Promise.resolve([]),
  ]);
  const maxClicks = Math.max(1, ...daily.map((d) => d.clicks));
  const status = coverage.status;

  return (
    <div>
      <AdminPageHeader
        title="검색어 (구글 검색 유입)"
        description="Search Console 데이터를 매일 새벽 우리 DB 에 쌓습니다. 구글은 16개월만 보관하지만 여기에는 계속 남습니다."
      />

      {/* 보관 상태 */}
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
        <div className="space-y-1">
          <p>
            보관 기간: <strong className="text-ink">{coverage.oldest ?? "—"} ~ {coverage.latest ?? "—"}</strong> ({n(coverage.days)}일 · 약 {n(coverage.rows)}행)
          </p>
          {status ? (
            <p className={status.ok ? "" : "text-accent-deep"}>
              마지막 실행 {new Date(status.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} ·{" "}
              {status.ok
                ? `${status.fetchedDays ?? 0}일 · ${n(status.rows ?? 0)}행 받음${status.remainingMissing ? ` · 남은 빈 날짜 ${status.remainingMissing}일(다음 실행에 이어서)` : ""}`
                : `실패: ${status.error}`}
            </p>
          ) : (
            <p>아직 한 번도 받지 않았습니다.</p>
          )}
          {!connected && <p className="text-accent-deep">연결 전 — 서비스 계정 키를 배포 환경에 넣어야 매일 자동으로 받습니다 (docs/운영.md 4-5).</p>}
        </div>
        <SearchSyncButton disabled={!connected} />
      </section>

      {/* 필터 */}
      <form method="get" className="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-6">
        <input type="hidden" name="view" value={view} />
        <label className="text-xs text-ink-soft sm:col-span-1">
          시작일
          <input type="date" name="from" defaultValue={f.from} className={inputClass} />
        </label>
        <label className="text-xs text-ink-soft sm:col-span-1">
          종료일
          <input type="date" name="to" defaultValue={f.to} className={inputClass} />
        </label>
        <label className="text-xs text-ink-soft sm:col-span-2">
          검색어 포함
          <input name="q" defaultValue={f.q ?? ""} placeholder="예: 노견" className={inputClass} />
        </label>
        <label className="text-xs text-ink-soft sm:col-span-1">
          페이지 포함
          <input name="page" defaultValue={f.page ?? ""} placeholder="/place/" className={inputClass} />
        </label>
        <label className="text-xs text-ink-soft sm:col-span-1">
          기기
          <select name="device" defaultValue={f.device ?? ""} className={inputClass}>
            <option value="">전체</option>
            {SEARCH_DEVICES.map((d) => (
              <option key={d} value={d}>
                {DEVICE_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
          <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream hover:opacity-90">
            적용
          </button>
          {coverage.latest &&
            (
              [
                ["7일", 7],
                ["28일", 28],
                ["90일", 90],
                ["12개월", 365],
              ] as const
            ).map(([label, days]) => (
              <Link key={label} href={href({ ...f, from: rangeFrom(coverage.latest!, days), to: coverage.latest! }, { view })} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:bg-sand">
                최근 {label}
              </Link>
            ))}
          {coverage.oldest && (
            <Link href={href({ ...f, from: coverage.oldest, to: coverage.latest ?? f.to }, { view })} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:bg-sand">
              전체 기간
            </Link>
          )}
          {isFiltered(f) && (
            <Link href={href({ from: f.from, to: f.to }, { view })} className="text-xs text-ink-faint hover:underline">
              필터 지우기
            </Link>
          )}
          <a href={`/admin/search/export${href(f, {})}`} className="ml-auto rounded-full border border-ink px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand">
            CSV 내려받기 (날짜별 원본)
          </a>
        </div>
      </form>

      {/* 합계 */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["클릭", n(summary.clicks)],
            ["노출", n(summary.impressions)],
            ["클릭률", pct(summary.ctr)],
            ["평균 순위", pos(summary.position)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs text-ink-faint">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </section>
      {isFiltered(f) && <p className="mt-2 text-xs text-ink-faint">필터를 걸면 구글이 익명 처리한 드문 검색어가 빠져 합계가 사이트 전체보다 작게 나옵니다.</p>}

      {/* 날짜별 클릭 */}
      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-bold text-ink">날짜별 클릭</p>
        {daily.length === 0 ? (
          <p className="mt-3 text-xs text-ink-faint">이 기간에 보관된 데이터가 없습니다.</p>
        ) : (
          <div className="mt-3 flex h-32 items-end gap-px overflow-x-auto">
            {daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date} · 클릭 ${n(d.clicks)} · 노출 ${n(d.impressions)} · 순위 ${pos(d.position)}`}
                className="min-w-[3px] flex-1 rounded-t bg-sea/70 hover:bg-sea"
                style={{ height: `${Math.max(2, (d.clicks / maxClicks) * 100)}%` }}
              />
            ))}
          </div>
        )}
        {daily.length > 0 && (
          <p className="mt-1 flex justify-between text-[11px] text-ink-faint">
            <span>{daily[0]!.date}</span>
            <span>막대에 마우스를 올리면 그날 숫자가 보입니다</span>
            <span>{daily[daily.length - 1]!.date}</span>
          </p>
        )}
      </section>

      {/* 보기 전환 */}
      <nav className="mt-6 flex gap-1 border-b border-line text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href(f, { view: v.key })}
            className={`-mb-px border-b-2 px-3 py-2 ${view === v.key ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-b-xl border border-t-0 border-line bg-surface">
        {view === "queries" && (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-2.5 font-medium">검색어</th>
                <th className="px-3 py-2.5 text-right font-medium">클릭</th>
                <th className="px-3 py-2.5 text-right font-medium">노출</th>
                <th className="px-3 py-2.5 text-right font-medium">클릭률</th>
                <th className="px-3 py-2.5 text-right font-medium">평균 순위</th>
                <th className="px-3 py-2.5 text-right font-medium">페이지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queries.length === 0 && <EmptyRow cols={6} />}
              {queries.map((r) => (
                <tr key={r.query} className="hover:bg-sand/50">
                  <td className="px-4 py-2">
                    <Link href={href({ ...f, q: r.query }, { view: "detail" })} className="text-ink hover:underline">
                      {r.query}
                    </Link>
                  </td>
                  <Num>{n(r.clicks)}</Num>
                  <Num>{n(r.impressions)}</Num>
                  <Num>{pct(r.ctr)}</Num>
                  <Num>{pos(r.position)}</Num>
                  <Num>{r.pages}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "pages" && (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-2.5 font-medium">페이지</th>
                <th className="px-3 py-2.5 text-right font-medium">클릭</th>
                <th className="px-3 py-2.5 text-right font-medium">노출</th>
                <th className="px-3 py-2.5 text-right font-medium">클릭률</th>
                <th className="px-3 py-2.5 text-right font-medium">평균 순위</th>
                <th className="px-3 py-2.5 text-right font-medium">검색어 수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pages.length === 0 && <EmptyRow cols={6} />}
              {pages.map((r) => (
                <tr key={r.page} className="hover:bg-sand/50">
                  <td className="max-w-[28rem] truncate px-4 py-2">
                    <Link href={href({ ...f, page: r.page }, { view: "queries" })} className="text-ink hover:underline" title={r.page}>
                      {r.page}
                    </Link>
                    <a href={r.page} target="_blank" rel="noopener" className="ml-2 text-xs text-sea hover:underline">
                      ↗
                    </a>
                  </td>
                  <Num>{n(r.clicks)}</Num>
                  <Num>{n(r.impressions)}</Num>
                  <Num>{pct(r.ctr)}</Num>
                  <Num>{pos(r.position)}</Num>
                  <Num>{r.queries}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "detail" && (
          <>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">날짜</th>
                  <th className="px-3 py-2.5 font-medium">검색어</th>
                  <th className="px-3 py-2.5 font-medium">페이지</th>
                  <th className="px-3 py-2.5 font-medium">기기</th>
                  <th className="px-3 py-2.5 text-right font-medium">클릭</th>
                  <th className="px-3 py-2.5 text-right font-medium">노출</th>
                  <th className="px-3 py-2.5 text-right font-medium">클릭률</th>
                  <th className="px-3 py-2.5 text-right font-medium">순위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.length === 0 && <EmptyRow cols={8} />}
                {detail.slice(0, DETAIL_PAGE).map((r, i) => (
                  <tr key={`${r.date}-${i}`} className="hover:bg-sand/50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-ink-soft">{r.date}</td>
                    <td className="px-3 py-2 text-ink">{r.query}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-ink-soft" title={r.page}>
                      {r.page}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{DEVICE_LABEL[r.device] ?? r.device}</td>
                    <Num>{n(r.clicks)}</Num>
                    <Num>{n(r.impressions)}</Num>
                    <Num>{pct(r.ctr)}</Num>
                    <Num>{pos(r.position)}</Num>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-ink-soft">
              <span>
                {pageNo}쪽 · 쪽마다 {DETAIL_PAGE}행 (전체는 CSV 로)
              </span>
              <span className="flex gap-3">
                {pageNo > 1 && (
                  <Link href={href(f, { view, p: String(pageNo - 1) })} className="hover:underline">
                    ← 이전
                  </Link>
                )}
                {detail.length > DETAIL_PAGE && (
                  <Link href={href(f, { view, p: String(pageNo + 1) })} className="hover:underline">
                    다음 →
                  </Link>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-soft">{children}</td>;
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-ink-faint">
        이 조건에 맞는 데이터가 없습니다.
      </td>
    </tr>
  );
}
