// 재활·한방·특수치료 시행처 CSV → rehab_sites 적재.
//
//   pnpm etl:rehab -- --file data/content/rehab/rehab-sites.csv [--dry-run]
//
// 파일 규약 (data/src/etl/lib/curated.ts):
//  - 필수: 외부키 / 병원명 / 지역("시도 시군구") / 치료법(슬러그를 | 로 구분,
//          data/src/rehab/modalities.ts)
//  - 선택: 소재지 / 전화 / 영업상태 / 근거출처 / 근거 / 확인수준 / 내부메모 / 기준일 / 게시(Y/N)
//  - "#" 은 미확인. 신규 행에서는 비우고, 재적재에서는 기존 값을 건드리지 않는다.
//  - 치료법이 하나도 없는 행은 적재하지 않는다 — 치료법 없는 병원 목록은
//    "일반 동물병원 디렉토리" 가 되기 때문이다 (claude.md 6-2).
//  - 담당 수의사 개인명 컬럼은 받지 않는다 (claude.md 5-6).
import path from "node:path";
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { repoRoot } from "../../env.js";
import { closeDb, getDb } from "../../db/client.js";
import { regions, rehabSites } from "../../db/schema.js";
import { readCsvRows } from "../lib/csv.js";
import { resolveRegionFromAddress, sanitizeRoadAddress } from "../lib/address.js";
import { addSkip, countKey, newReport, printSummary, writeReport } from "../lib/report.js";
import { normalizeModalitySlugs } from "../../rehab/modalities.js";
import { bindCuratedHeaders, parseBoolCell, parseDateCell, parseStatusCell, splitPipeList } from "../lib/curated.js";

const REHAB_HEADER_SPEC = {
  externalRef: { candidates: ["외부키", "external_ref"], required: true },
  name: { candidates: ["병원명", "이름", "시행처"], required: true },
  region: { candidates: ["지역", "시군구"], required: true },
  modalities: { candidates: ["치료법"], required: true },
  address: { candidates: ["소재지", "주소"], required: false },
  phone: { candidates: ["전화", "전화번호"], required: false },
  status: { candidates: ["영업상태"], required: false },
  sourceLabel: { candidates: ["근거출처", "출처"], required: false },
  evidenceNote: { candidates: ["근거"], required: false },
  internalLevel: { candidates: ["확인수준"], required: false },
  internalNote: { candidates: ["내부메모"], required: false },
  verifiedAt: { candidates: ["기준일", "확인일"], required: false },
  published: { candidates: ["게시"], required: false },
} satisfies Record<string, { candidates: string[]; required: boolean }>;

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { file: get("file") ?? "data/content/rehab/rehab-sites.csv", dryRun: argv.includes("--dry-run") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
  if (!existsSync(filePath)) throw new Error(`파일 없음: ${filePath}`);

  const rows = readCsvRows(filePath, "auto");
  if (rows.length === 0) throw new Error("CSV 에 데이터 행이 없습니다.");
  const h = bindCuratedHeaders(rows[0]!, REHAB_HEADER_SPEC);

  const report = newReport("rehab-sites", path.relative(repoRoot, filePath));
  report.totalRows = rows.length;

  const db = getDb();
  const regionRows = await db.select().from(regions);
  if (regionRows.length === 0) throw new Error("regions 가 비어 있습니다. 먼저 seed:base 를 실행하세요.");
  const regionByName = new Map(regionRows.map((r) => [`${r.sidoName}|${r.sigunguName}`, r.id]));
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const externalRef = h.get(row, "externalRef");
    const name = h.get(row, "name");
    const regionText = h.get(row, "region");
    const label = name ?? externalRef ?? JSON.stringify(row).slice(0, 80);

    if (!externalRef) {
      addSkip(report, "외부키 없음", label);
      continue;
    }
    if (seenKeys.has(externalRef)) {
      addSkip(report, "외부키 중복(파일 안)", `${externalRef} / ${label}`);
      continue;
    }
    seenKeys.add(externalRef);
    if (!name) {
      addSkip(report, "병원명 미확인(#)", externalRef);
      continue;
    }
    const match = resolveRegionFromAddress(regionText);
    if (!match) {
      countKey(report.unmatchedRegions, regionText ?? "(지역 없음)");
      addSkip(report, "시군구 미귀속", `${name} / ${regionText ?? "-"}`);
      continue;
    }
    const regionId = regionByName.get(`${match.region.sidoName}|${match.region.sigunguName}`);
    if (!regionId) {
      addSkip(report, "regions 테이블에 없는 시군구", `${match.region.sidoName} ${match.region.sigunguName}`);
      continue;
    }

    // 치료법 — "#" 이면 재적재 시 기존 값 유지, 신규 행이면 적재 불가
    const modalityRaw = h.get(row, "modalities");
    let modalities: string[] | null = null;
    if (modalityRaw) {
      const { valid, unknown } = normalizeModalitySlugs(splitPipeList(modalityRaw));
      for (const u of unknown) countKey(report.unmappedStatusValues, `치료법:${u}`);
      if (valid.length === 0) {
        addSkip(report, "유효한 치료법 없음 — 치료법 없는 병원은 게시하지 않는다", `${name} / ${modalityRaw}`);
        continue;
      }
      modalities = valid;
    }

    const statusRaw = h.get(row, "status");
    const status = parseStatusCell(statusRaw);
    if (statusRaw && !status) countKey(report.unmappedStatusValues, statusRaw);
    const dateRaw = h.get(row, "verifiedAt");
    const verifiedAt = parseDateCell(dateRaw);
    if (dateRaw && !verifiedAt) addSkip(report, "기준일 형식 오류(YYYY-MM-DD 아님) — 비움", `${name} / ${dateRaw}`);
    const publishedRaw = h.get(row, "published");
    const published = parseBoolCell(publishedRaw);
    if (publishedRaw && published === null) countKey(report.unmappedStatusValues, `게시:${publishedRaw}`);

    if (args.dryRun) {
      report.loaded += 1;
      continue;
    }

    const keep = (col: string) => sql.raw(`coalesce(excluded.${col}, rehab_sites.${col})`);
    const inserted = await db
      .insert(rehabSites)
      .values({
        externalRef,
        name,
        regionId,
        address: sanitizeRoadAddress(h.get(row, "address")),
        phone: h.get(row, "phone"),
        status: status ?? "unknown",
        modalities: modalities ?? [],
        sourceLabel: h.get(row, "sourceLabel"),
        evidenceNote: h.get(row, "evidenceNote"),
        internalLevel: h.get(row, "internalLevel"),
        internalNote: h.get(row, "internalNote"),
        verifiedAt,
        published: published ?? true,
      })
      .onConflictDoUpdate({
        target: rehabSites.externalRef,
        set: {
          name,
          regionId,
          address: keep("address"),
          phone: keep("phone"),
          status: status ?? sql.raw("rehab_sites.status"),
          modalities: modalities ?? sql.raw("rehab_sites.modalities"),
          sourceLabel: keep("source_label"),
          evidenceNote: keep("evidence_note"),
          internalLevel: keep("internal_level"),
          internalNote: keep("internal_note"),
          verifiedAt: keep("verified_at"),
          published: published ?? sql.raw("rehab_sites.published"),
          updatedAt: new Date(),
        },
      })
      .returning({ createdAt: rehabSites.createdAt, updatedAt: rehabSites.updatedAt });
    const r0 = inserted[0]!;
    if (r0.createdAt.getTime() !== r0.updatedAt.getTime()) report.updated += 1;
    else report.loaded += 1;
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
