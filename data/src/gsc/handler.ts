// 매일 Search Console 받아 쌓기 — SST Cron 이 부른다 (sst.config.ts "GscSync", prod 에 GSC_* 가 있을 때만 생성)
// 처음 며칠은 16개월치를 하루 120일분씩 채우고, 그 뒤로는 최근 5일만 다시 받는다.
import { closeDb, getDb } from "../db/client.js";
import { runSearchConsoleSync } from "./sync.js";

export async function handler() {
  try {
    const result = await runSearchConsoleSync(getDb(), "cron", { maxDays: 120, refreshDays: 5 });
    console.log(JSON.stringify({ gscSync: "ok", days: result.fetchedDays.length, rows: result.rows, remaining: result.remainingMissing }));
    return { ok: true, ...result, fetchedDays: result.fetchedDays.length };
  } finally {
    await closeDb();
  }
}
