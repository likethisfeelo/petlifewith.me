// 동물등록 현황 (농림축산검역본부) — 시군구별 x 출생연도별 등록 수.
// 지역별 노령견 비율의 근거 데이터 (기획서 SECTION 04-2, claude.md 7).
//
//   pnpm etl:stats -- --file data/raw/dog_registration.csv --reference-date 2026-06-30
//     [--encoding auto|utf8|cp949] [--dry-run]
//
// API 활용신청 승인 전이므로 CSV 파일 기반으로 시작한다. API 응답 구조가 확정되면
// fetch 단계만 추가한다 — 정규화·적재는 그대로 재사용.
import path from "node:path";
import { existsSync } from "node:fs";
import { repoRoot } from "../../env.js";
import { closeDb, getDb } from "../../db/client.js";
import { regionDogStats, regions } from "../../db/schema.js";
import { readCsvRows, resolveHeaders, type CsvEncoding } from "../lib/csv.js";
import { normalizeSidoName } from "../../regions/regions.js";
import { addSkip, countKey, newReport, printSummary, writeReport } from "../lib/report.js";

const STATS_HEADER_SPEC = {
  sido: { candidates: ["시도", "시도명", "시도 명"], required: true },
  sigungu: { candidates: ["시군구", "시군구명", "시군구 명"], required: true },
  birthYear: { candidates: ["출생연도", "출생년도", "출생 연도"], required: true },
  count: { candidates: ["등록수", "등록두수", "등록개체수", "개체수", "마리수"], required: true },
} satisfies Record<string, { candidates: string[]; required: boolean }>;

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const file = get("file") ?? "";
  if (!file) throw new Error("--file 필요");
  const referenceDate = get("reference-date");
  // 통계는 기준일이 곧 의미다 — 기본값으로 얼버무리지 않는다.
  if (!referenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw new Error("--reference-date YYYY-MM-DD 필수 (통계 기준일)");
  }
  return {
    file,
    referenceDate,
    encoding: (get("encoding") ?? "auto") as CsvEncoding,
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
  if (!existsSync(filePath)) throw new Error(`파일 없음: ${filePath}`);

  const rows = readCsvRows(filePath, args.encoding);
  if (rows.length === 0) throw new Error("CSV 에 데이터 행이 없습니다.");

  const { mapping, missingRequired, headers } = resolveHeaders(rows[0]!, STATS_HEADER_SPEC);
  if (missingRequired.length > 0) {
    console.error("필수 컬럼을 찾지 못했습니다. 추측으로 적재하지 않습니다.");
    console.error("  누락:", missingRequired.join(" / "));
    console.error("  발견된 헤더:", headers.join(", "));
    process.exit(1);
  }
  const col = (row: Record<string, string>, field: keyof typeof STATS_HEADER_SPEC) => {
    const h = mapping[field];
    return h ? row[h]?.trim() : undefined;
  };

  const report = newReport("dog-registration-stats", path.relative(repoRoot, filePath));
  report.totalRows = rows.length;
  report.notes.push(`기준일: ${args.referenceDate}`);

  const db = getDb();
  const regionRows = await db.select().from(regions);
  if (regionRows.length === 0) throw new Error("regions 가 비어 있습니다. seed:base 를 먼저 실행하세요.");
  const regionByName = new Map(regionRows.map((r) => [`${r.sidoName}|${r.sigunguName}`, r.id]));

  for (const row of rows) {
    const sidoRaw = col(row, "sido");
    const sigunguRaw = col(row, "sigungu");
    const sido = sidoRaw ? normalizeSidoName(sidoRaw) : undefined;
    if (!sido || !sigunguRaw) {
      countKey(report.unmatchedRegions, `${sidoRaw ?? "-"} ${sigunguRaw ?? "-"}`);
      addSkip(report, "시도/시군구 해석 불가", `${sidoRaw} ${sigunguRaw}`);
      continue;
    }
    // 세종처럼 시군구가 비어 오는 경우 단일 행으로 귀속
    const sigunguName = sido.slug === "sejong" ? "세종시" : sigunguRaw;
    const regionId = regionByName.get(`${sido.name}|${sigunguName}`);
    if (!regionId) {
      countKey(report.unmatchedRegions, `${sido.name} ${sigunguName}`);
      addSkip(report, "regions 에 없는 시군구", `${sido.name} ${sigunguName}`);
      continue;
    }

    const birthYear = Number(col(row, "birthYear"));
    const count = Number(col(row, "count")?.replace(/,/g, ""));
    if (!Number.isInteger(birthYear) || birthYear < 1980 || birthYear > 2100) {
      addSkip(report, "출생연도 해석 불가", `${col(row, "birthYear")}`);
      continue;
    }
    if (!Number.isFinite(count) || count < 0) {
      addSkip(report, "등록수 해석 불가", `${col(row, "count")}`);
      continue;
    }

    if (args.dryRun) {
      report.loaded += 1;
      continue;
    }

    await db
      .insert(regionDogStats)
      .values({ regionId, birthYear, registeredCount: Math.round(count), referenceDate: args.referenceDate })
      .onConflictDoUpdate({
        target: [regionDogStats.regionId, regionDogStats.birthYear, regionDogStats.referenceDate],
        set: { registeredCount: Math.round(count) },
      });
    report.loaded += 1;
  }

  const reportFile = writeReport(report);
  printSummary(report);
  console.log(`리포트: ${path.relative(repoRoot, reportFile)}`);
  if (args.dryRun) console.log("(dry-run — DB 에 쓰지 않았습니다)");
  await closeDb();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
