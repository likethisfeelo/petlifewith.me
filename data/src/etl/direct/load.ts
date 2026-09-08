// 직접 발굴 스팟 CSV → spots / spot_links 적재 (출처 direct).
//
//   pnpm etl:direct -- --file data/content/spots/soomgo-grooming-2026-09.csv [--dry-run]
//
// 파일 규약 (data/src/etl/lib/curated.ts):
//  - 필수: 외부키 / 이름 / 유형(spot_types.slug) / 지역("시도 시군구")
//  - 선택: 주소 / 전화 / 영업상태 / 기준일 / 소개 / 영업시간 / 요금 / 주차 /
//          홈페이지 / 카카오톡 / 예약 / 네이버 / 인스타그램 / 블로그 / 기타링크 / 비고(무시)
//  - 돌봄 유형(pet-sitter / dog-walk)만: 서비스지역("시도 시군구"를 | 로 구분) → spot_service_areas.
//    파일에 없는 지역·관리자가 끈 노출(exposed=false)은 건드리지 않는다. 비어 있으면 지역 셀의 시군구 하나.
//  - 출처: 비우면 direct, "sample" 이면 가상 예시(색인·사이트맵 제외, 화면에 예시 배지).
//  - "#" 은 미확인. 신규 행에서는 비우고, 재적재에서는 기존 값을 건드리지 않는다.
//  - 외부키(spots.external_ref) 로 upsert — 몇 번을 실행해도 중복이 생기지 않는다.
//  - 주소는 sanitizeRoadAddress 를 한 번 더 거친다 (동·호수 저장 금지, claude.md 5-6).
import path from "node:path";
import { existsSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { repoRoot } from "../../env.js";
import { closeDb, getDb } from "../../db/client.js";
import { regions, spotLinks, spotServiceAreas, spots, spotTypes } from "../../db/schema.js";
import { isCareType, parseAreaListCell } from "../../care/care.js";
import { readCsvRows } from "../lib/csv.js";
import { resolveRegionFromAddress, sanitizeRoadAddress } from "../lib/address.js";
import { addSkip, countKey, newReport, printSummary, writeReport } from "../lib/report.js";
import { slugify } from "../lib/slug.js";
import { bindCuratedHeaders, parseDateCell, parseLinkCell, parseStatusCell } from "../lib/curated.js";

const DIRECT_HEADER_SPEC = {
  externalRef: { candidates: ["외부키", "external_ref"], required: true },
  name: { candidates: ["이름", "상호", "사업장명"], required: true },
  type: { candidates: ["유형", "스팟유형"], required: true },
  region: { candidates: ["지역", "시군구"], required: true },
  address: { candidates: ["주소", "도로명주소"], required: false },
  phone: { candidates: ["전화", "전화번호"], required: false },
  status: { candidates: ["영업상태"], required: false },
  referenceDate: { candidates: ["기준일", "확인일"], required: false },
  description: { candidates: ["소개", "설명"], required: false },
  hours: { candidates: ["영업시간", "운영시간"], required: false },
  price: { candidates: ["요금"], required: false },
  parking: { candidates: ["주차"], required: false },
  website: { candidates: ["홈페이지"], required: false },
  kakao: { candidates: ["카카오톡", "카카오"], required: false },
  reservation: { candidates: ["예약"], required: false },
  naver: { candidates: ["네이버", "네이버플레이스"], required: false },
  instagram: { candidates: ["인스타그램"], required: false },
  blog: { candidates: ["블로그"], required: false },
  etc: { candidates: ["기타링크", "기타"], required: false },
  areas: { candidates: ["서비스지역", "활동지역"], required: false },
  source: { candidates: ["출처"], required: false },
} satisfies Record<string, { candidates: string[]; required: boolean }>;

/** 링크 컬럼 → spot_links.kind (web/src/lib/links.ts 의 어휘와 같다) */
const LINK_COLUMNS = [
  ["website", "website"],
  ["kakao", "kakao"],
  ["reservation", "reservation"],
  ["naver", "naver"],
  ["instagram", "instagram"],
  ["blog", "blog"],
  ["etc", "etc"],
] as const;

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const file = get("file") ?? "";
  if (!file) throw new Error("--file 필요 (예: data/content/spots/soomgo-grooming-2026-09.csv)");
  return { file, dryRun: argv.includes("--dry-run") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
  if (!existsSync(filePath)) throw new Error(`파일 없음: ${filePath}`);

  const rows = readCsvRows(filePath, "auto");
  if (rows.length === 0) throw new Error("CSV 에 데이터 행이 없습니다.");
  const h = bindCuratedHeaders(rows[0]!, DIRECT_HEADER_SPEC);

  const report = newReport("direct-spots", path.relative(repoRoot, filePath));
  report.totalRows = rows.length;

  const db = getDb();
  const regionRows = await db.select().from(regions);
  if (regionRows.length === 0) throw new Error("regions 가 비어 있습니다. 먼저 seed:base 를 실행하세요.");
  const regionByName = new Map(regionRows.map((r) => [`${r.sidoName}|${r.sigunguName}`, r.id]));
  const typeRows = await db.select({ id: spotTypes.id, slug: spotTypes.slug }).from(spotTypes);
  const typeBySlug = new Map(typeRows.map((t) => [t.slug, t.id]));

  const seenKeys = new Set<string>();

  for (const row of rows) {
    const externalRef = h.get(row, "externalRef");
    const name = h.get(row, "name");
    const typeSlug = h.get(row, "type");
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
      addSkip(report, "이름 미확인(#) — 상호를 채운 뒤 재실행", externalRef);
      continue;
    }
    if (!typeSlug) {
      addSkip(report, "유형 미확인(#)", `${externalRef} / ${name}`);
      continue;
    }
    const typeId = typeBySlug.get(typeSlug);
    if (!typeId) {
      countKey(report.unmappedStatusValues, `유형:${typeSlug}`);
      addSkip(report, "spot_types 에 없는 유형 슬러그", `${typeSlug} / ${name}`);
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

    const statusRaw = h.get(row, "status");
    const status = parseStatusCell(statusRaw);
    if (statusRaw && !status) countKey(report.unmappedStatusValues, statusRaw);
    const dateRaw = h.get(row, "referenceDate");
    const referenceDate = parseDateCell(dateRaw);
    if (dateRaw && !referenceDate) addSkip(report, "기준일 형식 오류(YYYY-MM-DD 아님) — 비움", `${name} / ${dateRaw}`);

    const address = sanitizeRoadAddress(h.get(row, "address"));
    const links: Array<{ kind: string; url: string; label: string | null }> = [];
    for (const [field, kind] of LINK_COLUMNS) {
      const raw = h.get(row, field);
      if (!raw) continue;
      const parsed = parseLinkCell(raw);
      if (!parsed) {
        addSkip(report, "링크 형식 오류(http(s) URL 아님) — 링크만 건너뜀", `${name} / ${kind}: ${raw.slice(0, 60)}`);
        continue;
      }
      links.push({ kind, ...parsed });
    }

    const sourceRaw = (h.get(row, "source") ?? "").toLowerCase();
    const source: "direct" | "sample" = sourceRaw === "sample" ? "sample" : "direct";
    if (sourceRaw && sourceRaw !== "sample" && sourceRaw !== "direct") countKey(report.unmappedStatusValues, `출처:${sourceRaw}`);

    // 돌봄 유형의 서비스 지역 — 시군구로 귀속되지 않는 조각은 리포트에 남기고 건너뛴다
    const areaRegionIds: number[] = [];
    if (isCareType(typeSlug)) {
      for (const areaText of parseAreaListCell(h.get(row, "areas"))) {
        const am = resolveRegionFromAddress(areaText);
        const areaId = am ? regionByName.get(`${am.region.sidoName}|${am.region.sigunguName}`) : undefined;
        if (!areaId) {
          countKey(report.unmatchedRegions, areaText);
          addSkip(report, "서비스지역 시군구 미귀속 — 그 지역만 건너뜀", `${name} / ${areaText}`);
          continue;
        }
        if (!areaRegionIds.includes(areaId)) areaRegionIds.push(areaId);
      }
      if (areaRegionIds.length === 0) areaRegionIds.push(regionId);
    }

    if (args.dryRun) {
      report.loaded += 1;
      continue;
    }

    // "#"(null) 은 기존 값을 유지한다 — coalesce(excluded, 현재값)
    const keep = (col: string) => sql.raw(`coalesce(excluded.${col}, spots.${col})`);
    const inserted = await db
      .insert(spots)
      .values({
        slug: slugify(name, typeSlug),
        name,
        typeId,
        regionId,
        addressRoad: address,
        phone: h.get(row, "phone"),
        status: status ?? "unknown",
        source,
        externalRef,
        dataReferenceDate: referenceDate,
        descriptionMd: h.get(row, "description"),
        hoursText: h.get(row, "hours"),
        priceText: h.get(row, "price"),
        parkingText: h.get(row, "parking"),
      })
      .onConflictDoUpdate({
        target: spots.externalRef,
        set: {
          name,
          typeId,
          regionId,
          addressRoad: keep("address_road"),
          phone: keep("phone"),
          status: status ?? sql.raw("spots.status"),
          source,
          dataReferenceDate: keep("data_reference_date"),
          descriptionMd: keep("description_md"),
          hoursText: keep("hours_text"),
          priceText: keep("price_text"),
          parkingText: keep("parking_text"),
          updatedAt: new Date(),
        },
      })
      .returning({ id: spots.id, createdAt: spots.createdAt, updatedAt: spots.updatedAt });
    const r0 = inserted[0]!;
    if (r0.createdAt.getTime() !== r0.updatedAt.getTime()) report.updated += 1;
    else report.loaded += 1;

    // 링크는 종류 단위로 교체한다 — 파일에 없는 종류(관리자가 넣은 것)는 남는다
    for (const [i, link] of links.entries()) {
      await db.delete(spotLinks).where(and(eq(spotLinks.spotId, r0.id), eq(spotLinks.kind, link.kind)));
      await db.insert(spotLinks).values({ spotId: r0.id, kind: link.kind, url: link.url, label: link.label, sortOrder: i + 1 });
    }

    // 서비스 지역은 추가만 한다 — 이미 있는 행(관리자가 노출을 끈 것 포함)은 그대로 둔다
    for (const [i, areaId] of areaRegionIds.entries()) {
      await db
        .insert(spotServiceAreas)
        .values({ spotId: r0.id, regionId: areaId, exposed: true, sortOrder: i + 1 })
        .onConflictDoNothing({ target: [spotServiceAreas.spotId, spotServiceAreas.regionId] });
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
