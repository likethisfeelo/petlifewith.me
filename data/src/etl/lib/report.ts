// ETL 실행 리포트 — 조용히 버리지 않는다.
// 스킵된 행·미매핑 값은 전부 집계해 data/reports/ 에 남긴다 (data/reports 는 gitignore).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../../env.js";

export interface EtlReport {
  dataset: string;
  file: string;
  startedAt: string;
  finishedAt?: string;
  totalRows: number;
  loaded: number;
  updated: number;
  skipped: { reason: string; count: number; examples: string[] }[];
  unmappedStatusValues: Record<string, number>;
  unmatchedRegions: Record<string, number>;
  notes: string[];
}

export function newReport(dataset: string, file: string): EtlReport {
  return {
    dataset,
    file,
    startedAt: new Date().toISOString(),
    totalRows: 0,
    loaded: 0,
    updated: 0,
    skipped: [],
    unmappedStatusValues: {},
    unmatchedRegions: {},
    notes: [],
  };
}

export function addSkip(report: EtlReport, reason: string, example: string) {
  let bucket = report.skipped.find((s) => s.reason === reason);
  if (!bucket) {
    bucket = { reason, count: 0, examples: [] };
    report.skipped.push(bucket);
  }
  bucket.count += 1;
  if (bucket.examples.length < 5) bucket.examples.push(example);
}

export function countKey(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export function writeReport(report: EtlReport): string {
  report.finishedAt = new Date().toISOString();
  const dir = path.join(repoRoot, "data", "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `${report.dataset}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
  return file;
}

export function printSummary(report: EtlReport) {
  const skippedTotal = report.skipped.reduce((a, s) => a + s.count, 0);
  console.log(`\n[${report.dataset}] 총 ${report.totalRows}행 / 적재 ${report.loaded} / 갱신 ${report.updated} / 스킵 ${skippedTotal}`);
  for (const s of report.skipped) {
    console.log(`  - 스킵(${s.reason}): ${s.count}건  예: ${s.examples.slice(0, 2).join(" | ")}`);
  }
  const regions = Object.entries(report.unmatchedRegions);
  if (regions.length > 0) {
    console.log(`  - 시군구 미귀속 상위:`);
    for (const [k, v] of regions.sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`      ${k}: ${v}건`);
  }
  const statuses = Object.entries(report.unmappedStatusValues);
  if (statuses.length > 0) {
    console.log(`  - 미매핑 영업상태 값: ${statuses.map(([k, v]) => `${k}(${v})`).join(", ")}`);
  }
}
