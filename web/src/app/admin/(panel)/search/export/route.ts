// 검색 유입 원본 행 CSV — 관리자만. 현재 화면 필터(기간·검색어·페이지·기기) 그대로 내려받는다.
// 엑셀에서 한글이 깨지지 않게 UTF-8 BOM 을 붙인다. 너무 큰 파일을 막으려고 20만 행에서 자른다.
import { getSession } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { csvCell, getSearchCoverage, getSearchDetail, parseSearchFilter } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

const MAX_ROWS = 200_000;
const CHUNK = 10_000;

export async function GET(req: Request) {
  if (!(await getSession())) return new Response("로그인이 필요합니다.", { status: 401 });
  if (!isDbConfigured()) return new Response("DATABASE_URL 미설정", { status: 500 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const filter = parseSearchFilter(sp, (await getSearchCoverage()).latest);

  const lines = ["﻿날짜,검색어,페이지,기기,클릭,노출,클릭률(%),평균 순위"];
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    const rows = await getSearchDetail(filter, CHUNK, offset);
    for (const r of rows) {
      lines.push([r.date, csvCell(r.query), csvCell(r.page), r.device, r.clicks, r.impressions, (r.ctr * 100).toFixed(2), r.position.toFixed(1)].join(","));
    }
    if (rows.length < CHUNK) break;
  }
  const name = `search-console_${filter.from}_${filter.to}.csv`;
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
