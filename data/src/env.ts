// 환경변수 로딩 — 루트 .env.local 단일 소스.
// 웹은 next.config.ts 에서 같은 파일을 로드한다. 시크릿 접근을 흩뿌리지 않는다.
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

export function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`환경변수 ${name} 가 없습니다. 루트 .env.local 을 확인하세요 (.env.example 참조).`);
  }
  return v;
}
