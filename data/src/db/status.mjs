// 접속한 DB 의 적재 현황 요약 — 배포 DB 가 제대로 채워졌는지 확인용.
// 사용: DATABASE_URL=... node src/db/status.mjs   (scripts/db.ps1 -Task status 가 호출)
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다.");
  process.exit(2);
}

const masked = url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
console.log(`대상: ${masked}`);

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await client.connect();
try {
  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  const names = tables.rows.map((r) => r.table_name);
  console.log(`테이블 ${names.length}개`);
  if (names.length === 0) {
    console.log("마이그레이션이 적용되지 않았습니다 — db.ps1 -Task migrate 를 먼저 실행하세요.");
    process.exit(0);
  }

  for (const [label, sql] of [
    ["토픽", "select count(*)::int c from topics"],
    ["지역", "select count(*)::int c from regions"],
    ["스팟 유형", "select count(*)::int c from spot_types"],
    ["스팟", "select count(*)::int c from spots"],
    ["게시글", "select count(*)::int c from guides"],
    ["메이커", "select count(*)::int c from makers"],
    ["상품", "select count(*)::int c from items"],
    ["미디어", "select count(*)::int c from media_assets"],
  ]) {
    try {
      const r = await client.query(sql);
      console.log(`  ${label}: ${Number(r.rows[0].c).toLocaleString("ko-KR")}`);
    } catch {
      console.log(`  ${label}: (테이블 없음)`);
    }
  }

  const byType = await client.query(
    `select st.name, st.listed, count(*)::int c
       from spots s join spot_types st on st.id = s.type_id
      group by st.name, st.listed order by c desc limit 15`,
  );
  if (byType.rowCount > 0) {
    console.log("스팟 유형별:");
    for (const r of byType.rows) {
      console.log(`  ${r.name}${r.listed ? "" : " (비공개)"}: ${Number(r.c).toLocaleString("ko-KR")}`);
    }
  }
} finally {
  await client.end();
}
