// 큐레이션 CSV(직접 발굴 목록) 공통 규약.
//
// 인허가 CSV 와 달리 사람이 정리해 커밋하는 파일이다 (data/content/**). 규약:
//  - 셀 값 "#" 은 **미확인(비움)** 표시다. 빈 셀과 같게 취급하되, 재적재(upsert) 때는
//    기존 DB 값을 덮어쓰지 않는다 — 관리자에서 채운 값이 살아남는다.
//  - 필수 셀(이름·유형·지역 등)이 "#" 이면 그 행은 적재하지 않고 리포트에 남긴다.
//  - 헤더는 한글 후보명으로 해석한다. 모르는 컬럼(비고 등)은 무시한다.
import { resolveHeaders } from "./csv.js";

export const PLACEHOLDER = "#";

/** "#"·공백 → null. 그 외는 trim 한 문자열. */
export function cellValue(raw: string | undefined | null): string | null {
  const s = raw?.trim();
  if (!s || s === PLACEHOLDER) return null;
  return s;
}

export type HeaderSpec = Record<string, { candidates: string[]; required: boolean }>;

/**
 * 헤더를 해석해 필드 접근자를 만든다. 필수 헤더가 없으면 발견된 헤더를 담아 throw 한다.
 * (추측으로 적재하지 않는다 — claude.md 9)
 */
export function bindCuratedHeaders<S extends HeaderSpec>(sampleRow: Record<string, string>, spec: S) {
  const { mapping, missingRequired, headers } = resolveHeaders(sampleRow, spec);
  if (missingRequired.length > 0) {
    throw new Error(
      `필수 컬럼을 찾지 못했습니다. 누락: ${missingRequired.join(" / ")}\n  발견된 헤더: ${headers.join(", ")}`,
    );
  }
  return {
    headers,
    /** 셀 값 ("#"·빈 값은 null) */
    get(row: Record<string, string>, field: keyof S & string): string | null {
      const h = mapping[field];
      return h ? cellValue(row[h]) : null;
    },
    /** 이 논리 필드에 해당하는 컬럼이 파일에 존재하는가 */
    has(field: keyof S & string): boolean {
      return Boolean(mapping[field]);
    },
  };
}

export type BizStatus = "operating" | "suspended" | "closed" | "unknown";

/** 영업상태 셀 — 영문 값과 한글 표기를 모두 받는다. 해석 불가면 null (호출부가 리포트). */
export function parseStatusCell(raw: string | null): BizStatus | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["operating", "영업", "영업중", "영업 중", "운영", "운영중"].includes(s)) return "operating";
  if (["suspended", "휴업"].includes(s)) return "suspended";
  if (["closed", "폐업"].includes(s)) return "closed";
  if (["unknown", "확인필요", "확인 필요", "미확인"].includes(s)) return "unknown";
  return null;
}

/** YYYY-MM-DD 만 허용. 그 외는 null (호출부가 리포트). */
export function parseDateCell(raw: string | null): string | null {
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/** 게시 여부 셀 — Y/N, 예/아니오, true/false. 해석 불가면 null. */
export function parseBoolCell(raw: string | null): boolean | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["y", "yes", "true", "예", "게시", "1"].includes(s)) return true;
  if (["n", "no", "false", "아니오", "비게시", "0"].includes(s)) return false;
  return null;
}

/** "a|b|c" → ["a","b","c"] (공백·빈 항목 제거) */
export function splitPipeList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** http(s) URL 만 허용한다. javascript: 같은 스킴은 버린다. */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** 링크 셀 — "URL" 또는 "라벨|URL". 잘못된 URL 은 null (호출부가 리포트). */
export function parseLinkCell(raw: string | null): { url: string; label: string | null } | null {
  if (!raw) return null;
  let label: string | null = null;
  let url = raw.trim();
  const bar = url.indexOf("|");
  if (bar > 0 && !/^https?:\/\//i.test(url)) {
    label = url.slice(0, bar).trim() || null;
    url = url.slice(bar + 1).trim();
  }
  if (!isSafeHttpUrl(url)) return null;
  return { url, label };
}
