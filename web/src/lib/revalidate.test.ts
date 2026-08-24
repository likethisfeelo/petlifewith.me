// "revalidate 값을 페이지마다 흩뿌리지 말고 상수 모듈로 관리한다" (claude.md 10-4)
// Next 는 segment config 에 리터럴만 허용하므로, 페이지의 리터럴이
// lib/revalidate.ts 의 상수와 어긋나면 이 테스트가 깨진다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REVALIDATE, type RevalidateKey } from "./revalidate";

const APP_DIR = path.resolve(__dirname, "../app");

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) collectFiles(p, out);
    else if (/(page\.tsx|route\.ts)$/.test(name)) out.push(p);
  }
  return out;
}

const LINE_RE = /export const revalidate = (\d+); \/\/ REVALIDATE\.(\w+)/;

describe("revalidate 리터럴 ↔ 상수 모듈 일치", () => {
  const files = collectFiles(APP_DIR);
  const withRevalidate = files.filter((f) => readFileSync(f, "utf8").includes("export const revalidate"));

  it("revalidate 를 내보내는 파일이 존재한다", () => {
    expect(withRevalidate.length).toBeGreaterThan(0);
  });

  for (const file of withRevalidate) {
    const rel = path.relative(APP_DIR, file);
    it(rel, () => {
      const src = readFileSync(file, "utf8");
      const m = src.match(LINE_RE);
      // 주석 없는 revalidate 는 규칙 위반
      expect(m, `${rel}: "export const revalidate = N; // REVALIDATE.<key>" 형식이어야 합니다`).toBeTruthy();
      const value = Number(m![1]);
      const key = m![2] as RevalidateKey;
      expect(REVALIDATE[key], `${rel}: REVALIDATE.${key} 가 상수 모듈에 없습니다`).toBeDefined();
      expect(value, `${rel}: 리터럴 ${value} ≠ REVALIDATE.${key} (${REVALIDATE[key]})`).toBe(REVALIDATE[key]);
    });
  }
});
