// RDS 인스턴스 안에 스테이지별 데이터베이스가 없으면 만든다.
// 사용: ADMIN_DATABASE_URL=<마스터 접속 URL> node src/db/ensure-database.mjs <db_name>
// (scripts/aws-db.ps1 이 호출한다. psql 없이 동작하도록 pg 클라이언트를 쓴다.)
import pg from "pg";

const { Client } = pg;
const dbName = process.argv[2];
const url = process.env.ADMIN_DATABASE_URL;

if (!dbName || !/^[a-z_][a-z0-9_]{0,62}$/.test(dbName)) {
  console.error("usage: ADMIN_DATABASE_URL=... node src/db/ensure-database.mjs <db_name>");
  process.exit(2);
}
if (!url) {
  console.error("ADMIN_DATABASE_URL is not set");
  process.exit(2);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    // CREATE DATABASE 는 파라미터 바인딩이 불가 — dbName 은 위 정규식으로 검증됨
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log(`created database ${dbName}`);
  } else {
    console.log(`database ${dbName} already exists`);
  }
} finally {
  await client.end();
}
