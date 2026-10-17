// 로컬에서 Search Console 받아 쌓기 — 처음 16개월치를 한 번에 채울 때 등
//   pnpm --filter @app/data gsc:sync            (최대 120일분)
//   pnpm --filter @app/data gsc:sync -- --all   (빠진 날 전부)
// 루트 .env.local 에 DATABASE_URL·GSC_CLIENT_EMAIL·GSC_PRIVATE_KEY 가 있어야 한다.
import { closeDb, getDb } from "../db/client.js";
import { runSearchConsoleSync } from "./sync.js";

const all = process.argv.includes("--all");
try {
  const r = await runSearchConsoleSync(getDb(), "cli", { maxDays: all ? 10_000 : 120, refreshDays: 5 });
  console.log(`받은 날짜 ${r.fetchedDays.length}일 · 행 ${r.rows}개 · 남은 빈 날짜 ${r.remainingMissing}일`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await closeDb();
}
