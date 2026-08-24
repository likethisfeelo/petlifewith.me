// 스크립트(시드·ETL)용 DB 클라이언트.
// 연결 문자열은 여기 한 곳에서만 읽는다 (claude.md 10-2).
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requiredEnv } from "../env.js";
import * as schema from "./schema.js";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requiredEnv("DATABASE_URL"),
      max: Number(process.env.DB_POOL_MAX ?? 5),
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
