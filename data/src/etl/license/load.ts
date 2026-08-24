// 인허가 CSV → 정규화 → 적재.
//
//   pnpm etl:license -- --dataset animal-beauty --file data/raw/animal_beauty.csv
//     [--encoding auto|utf8|cp949] [--reference-date 2026-08-01] [--dry-run]
//
// - 관리번호(license_mgmt_no) 로 upsert. 재실행해도 중복이 생기지 않는다.
// - 에디토리얼 필드(설명·요금·예약 링크 등)는 절대 덮어쓰지 않는다.
// - 시군구 미귀속·미매핑 상태값은 리포트로 남긴다. 조용히 버리지 않는다.
import path from "node:path";
import { existsSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { repoRoot } from "../../env.js";
import { closeDb, getDb } from "../../db/client.js";
import { feedLicenses, regions, spots, spotTypes } from "../../db/schema.js";
import { readCsvRows, resolveHeaders, type CsvEncoding } from "../lib/csv.js";
import { resolveRegionFromAddress, sanitizeRoadAddress } from "../lib/address.js";
import { addSkip, countKey, newReport, printSummary, writeReport } from "../lib/report.js";
import { slugify } from "../lib/slug.js";
import {
  DATASETS,
  LICENSE_HEADER_SPEC,
  RAW_COORD_SYSTEM_LABEL,
  mapBizStatus,
  parseDate,
  parseNum,
} from "./mappings.js";

interface Args {
  dataset: string;
  file: string;
  encoding: CsvEncoding;
  referenceDate: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dataset = get("dataset") ?? "";
  const file = get("file") ?? "";
  if (!dataset || !DATASETS[dataset]) {
    throw new Error(`--dataset 필요. 지원: ${Object.keys(DATASETS).join(", ")}`);
  }
  if (!file) throw new Error("--file 필요 (예: data/raw/animal_beauty.csv)");
  const encoding = (get("encoding") ?? "auto") as CsvEncoding;
  const referenceDate = get("reference-date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("--reference-date 는 YYYY-MM-DD");
  return { dataset, file, encoding, referenceDate, dryRun: argv.includes("--dry-run") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const def = DATASETS[args.dataset]!;
  const filePath = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
  if (!existsSync(filePath)) throw new Error(`파일 없음: ${filePath}`);

  const rows = readCsvRows(filePath, args.encoding);
  if (rows.length === 0) throw new Error("CSV 에 데이터 행이 없습니다.");

  const first = rows[0]!;
  const { mapping, missingRequired, headers } = resolveHeaders(first, LICENSE_HEADER_SPEC);
  if (missingRequired.length > 0) {
    console.error("필수 컬럼을 찾지 못했습니다. 추측으로 적재하지 않습니다.");
    console.error("  누락:", missingRequired.join(" / "));
    console.error("  발견된 헤더:", headers.join(", "));
    process.exit(1);
  }
  const col = (row: Record<string, string>, field: keyof typeof LICENSE_HEADER_SPEC): string | undefined => {
    const h = mapping[field];
    return h ? row[h] : undefined;
  };

  const report = newReport(args.dataset, path.relative(repoRoot, filePath));
  report.totalRows = rows.length;
  report.notes.push(`기준일: ${args.referenceDate}`, `인코딩: ${args.encoding}`);

  const db = getDb();

  // 지역 lookup — seed:base 선행 필요
  const regionRows = await db.select().from(regions);
  if (regionRows.length === 0) {
    throw new Error("regions 가 비어 있습니다. 먼저 `pnpm --filter @app/data seed:base` 를 실행하세요.");
  }
  const regionByName = new Map(regionRows.map((r) => [`${r.sidoName}|${r.sigunguName}`, r.id]));

  let spotTypeId: number | null = null;
  if (def.kind === "spot") {
    const t = await db.select().from(spotTypes).where(eq(spotTypes.slug, def.spotTypeSlug));
    if (!t[0]) throw new Error(`spot_types 에 ${def.spotTypeSlug} 가 없습니다. seed:base 를 먼저 실행하세요.`);
    spotTypeId = t[0].id;
  }

  for (const row of rows) {
    const name = col(row, "name")?.trim();
    const mgmtNo = col(row, "mgmtNo")?.trim();
    if (!name) {
      addSkip(report, "사업장명 없음", JSON.stringify(row).slice(0, 120));
      continue;
    }
    if (!mgmtNo) {
      addSkip(report, "관리번호 없음", name);
      continue;
    }

    const roadRaw = col(row, "roadAddress");
    const lotRaw = col(row, "lotAddress");
    const addressForRegion = roadRaw?.trim() || lotRaw?.trim();
    const match = resolveRegionFromAddress(addressForRegion);
    if (!match) {
      const key = addressForRegion ? addressForRegion.split(/\s+/).slice(0, 2).join(" ") : "(주소 없음)";
      countKey(report.unmatchedRegions, key);
      addSkip(report, "시군구 미귀속", `${name} / ${addressForRegion ?? "-"}`);
      continue;
    }
    const regionId = regionByName.get(`${match.region.sidoName}|${match.region.sigunguName}`);
    if (!regionId) {
      addSkip(report, "regions 테이블에 없는 시군구", `${match.region.sidoName} ${match.region.sigunguName}`);
      continue;
    }

    const { status, matchedOn } = mapBizStatus(col(row, "statusDetailName"), col(row, "statusName"));
    if (status === "unknown" && matchedOn) countKey(report.unmappedStatusValues, matchedOn);

    const licenseDate = parseDate(col(row, "licenseDate"));
    const phone = col(row, "phone")?.trim() || null;
    const address = sanitizeRoadAddress(roadRaw) ?? sanitizeRoadAddress(lotRaw);

    if (args.dryRun) {
      report.loaded += 1;
      continue;
    }

    if (def.kind === "spot") {
      const inserted = await db
        .insert(spots)
        .values({
          slug: slugify(name, def.spotTypeSlug),
          name,
          typeId: spotTypeId!,
          regionId,
          addressRoad: address,
          phone,
          status,
          source: "public_data",
          licenseMgmtNo: mgmtNo,
          licenseDate,
          dataReferenceDate: args.referenceDate,
          rawCoordX: parseNum(col(row, "coordX")),
          rawCoordY: parseNum(col(row, "coordY")),
          rawCoordSystem: RAW_COORD_SYSTEM_LABEL,
        })
        .onConflictDoUpdate({
          target: spots.licenseMgmtNo,
          // 에디토리얼·클레임 필드(설명·요금·예약 등)와 typeId(관리자 재분류)는 건드리지 않는다.
          set: {
            name,
            regionId,
            addressRoad: address,
            phone,
            status,
            licenseDate,
            dataReferenceDate: args.referenceDate,
            rawCoordX: parseNum(col(row, "coordX")),
            rawCoordY: parseNum(col(row, "coordY")),
            rawCoordSystem: RAW_COORD_SYSTEM_LABEL,
            updatedAt: new Date(),
          },
        })
        .returning({ createdAt: spots.createdAt, updatedAt: spots.updatedAt });
      const r0 = inserted[0];
      if (r0 && r0.createdAt.getTime() !== r0.updatedAt.getTime()) report.updated += 1;
      else report.loaded += 1;
    } else {
      const inserted = await db
        .insert(feedLicenses)
        .values({
          businessName: name,
          licenseKind: col(row, "bizKind")?.trim() || null,
          regionId,
          registeredAt: licenseDate,
          bizStatus: matchedOn,
          licenseMgmtNo: mgmtNo,
          referenceDate: args.referenceDate,
          sourcePayload: row,
        })
        .onConflictDoUpdate({
          target: feedLicenses.licenseMgmtNo,
          set: {
            businessName: name,
            licenseKind: col(row, "bizKind")?.trim() || null,
            regionId,
            registeredAt: licenseDate,
            bizStatus: matchedOn,
            referenceDate: args.referenceDate,
            sourcePayload: row,
            updatedAt: new Date(),
          },
        })
        .returning({ createdAt: feedLicenses.createdAt, updatedAt: feedLicenses.updatedAt });
      const r0 = inserted[0];
      if (r0 && r0.createdAt.getTime() !== r0.updatedAt.getTime()) report.updated += 1;
      else report.loaded += 1;
    }
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
