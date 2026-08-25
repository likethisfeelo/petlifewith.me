// ============================================================
// DB 클라이언트 — Lambda 전환 대비 (claude.md 10-2)
//  - 커넥션은 모듈 스코프에서 재사용. 핸들러 안에서 new Client() 금지.
//  - 커넥션 상한: DB_POOL_MAX (기본 5)
//  - 연결 문자열은 lib/config.ts 한 곳에서만 읽는다.
//
// DATABASE_URL 미설정이면 isDbConfigured() 가 false — 페이지는 빈 상태를
// 렌더한다 (DB 없는 CI 빌드 허용). 설정돼 있는데 접속 실패면 그대로 던진다.
// ============================================================
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@app/data";
import { databaseUrl, dbPoolMax } from "./config";

export { schema };

// dev HMR 로 모듈이 재평가돼도 풀이 새로 만들어지지 않도록 globalThis 에 붙인다.
const globalForDb = globalThis as unknown as {
  __appDbPool?: Pool;
  __appDb?: NodePgDatabase<typeof schema>;
};

export function isDbConfigured(): boolean {
  return Boolean(databaseUrl());
}

export function getDb(): NodePgDatabase<typeof schema> {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL 이 설정되지 않았습니다. isDbConfigured() 로 먼저 확인하세요.");
  }
  if (!globalForDb.__appDb) {
    globalForDb.__appDbPool = new Pool({
      connectionString: url,
      max: dbPoolMax(),
      idleTimeoutMillis: 30_000,
    });
    globalForDb.__appDb = drizzle(globalForDb.__appDbPool, { schema });
  }
  return globalForDb.__appDb;
}
