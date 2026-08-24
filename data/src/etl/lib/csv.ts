// CSV 로딩. 공공데이터 CSV 는 UTF-8(BOM) 과 CP949 가 섞여 있다.
// 인코딩은 옵션으로 명시하는 것을 기본으로 하고, auto 는 BOM/복원문자 휴리스틱만 쓴다.
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

export type CsvEncoding = "utf8" | "cp949" | "auto";

export function readCsvRows(filePath: string, encoding: CsvEncoding = "auto"): Record<string, string>[] {
  const buf = readFileSync(filePath);
  const text = decodeBuffer(buf, encoding);
  const rows = parse(text, {
    columns: (header: string[]) => header.map((h) => h.replace(/^﻿/, "").trim()),
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
  return rows;
}

function decodeBuffer(buf: Buffer, encoding: CsvEncoding): string {
  if (encoding === "utf8") return buf.toString("utf8");
  if (encoding === "cp949") return iconv.decode(buf, "cp949");
  // auto: BOM 이 있으면 utf8, 아니면 utf8 디코딩 후 복원문자(U+FFFD)가 나오면 cp949 재시도
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString("utf8");
  }
  const asUtf8 = buf.toString("utf8");
  if (asUtf8.includes("�")) {
    return iconv.decode(buf, "cp949");
  }
  return asUtf8;
}

/**
 * 논리 필드명 → 실제 헤더 후보 목록으로 헤더를 해석한다.
 * 필수 필드를 못 찾으면 발견된 헤더 전체를 포함해 즉시 실패한다 — 추측하지 않는다.
 */
export function resolveHeaders(
  sampleRow: Record<string, string>,
  spec: Record<string, { candidates: string[]; required: boolean }>,
): { mapping: Record<string, string | null>; missingRequired: string[]; headers: string[] } {
  const headers = Object.keys(sampleRow);
  const mapping: Record<string, string | null> = {};
  const missingRequired: string[] = [];
  for (const [field, { candidates, required }] of Object.entries(spec)) {
    const found = headers.find((h) => candidates.includes(h));
    mapping[field] = found ?? null;
    if (!found && required) missingRequired.push(`${field} (후보: ${candidates.join(", ")})`);
  }
  return { mapping, missingRequired, headers };
}
