// RowsEditor 가 보낸 JSON 을 서버 액션에서 읽는다.
// 값은 문자열/불리언만 허용하고, 그 외 타입은 버린다.
export type ParsedRow = Record<string, string | boolean>;

export function parseRows(formData: FormData, name: string): ParsedRow[] {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 100).map((row) => {
    const out: ParsedRow = {};
    if (row && typeof row === "object") {
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (typeof v === "string") out[k] = v.trim();
        else if (typeof v === "boolean") out[k] = v;
      }
    }
    return out;
  });
}

export function rowString(row: ParsedRow, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

export function rowBool(row: ParsedRow, key: string): boolean {
  return row[key] === true;
}
