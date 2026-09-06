// 재활·한방·특수치료 시행처 — 치료법이 주어인 목록 (claude.md 6-2)
// 순위·추천·평점 없음: 정렬은 시도 → 시군구 → 이름(가나다). 내부 확인 수준(internal_*)은
// 여기서 아예 select 하지 않는다 — 공개 렌더 경로에 값이 흘러갈 수 없게.
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { rehabSites, regions } = schema;

export type RegionRow = typeof regions.$inferSelect;

export interface RehabSitePublic {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  status: "operating" | "suspended" | "closed" | "unknown";
  modalities: string[];
  sourceLabel: string | null;
  evidenceNote: string | null;
  verifiedAt: string | null;
  region: RegionRow;
}

const publicColumns = {
  id: rehabSites.id,
  name: rehabSites.name,
  address: rehabSites.address,
  phone: rehabSites.phone,
  status: rehabSites.status,
  modalities: rehabSites.modalities,
  sourceLabel: rehabSites.sourceLabel,
  evidenceNote: rehabSites.evidenceNote,
  verifiedAt: rehabSites.verifiedAt,
  region: regions,
};

/** 게시 중 + 폐업 아님. 치료법 슬러그를 주면 그 치료법을 시행하는 곳만. */
export async function listRehabSites(modalitySlug?: string): Promise<RehabSitePublic[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const conds = [eq(rehabSites.published, true), ne(rehabSites.status, "closed")];
  if (modalitySlug) conds.push(sql`${modalitySlug} = any(${rehabSites.modalities})`);
  return db
    .select(publicColumns)
    .from(rehabSites)
    .innerJoin(regions, eq(rehabSites.regionId, regions.id))
    .where(and(...conds))
    .orderBy(asc(regions.sidoName), asc(regions.sigunguName), asc(rehabSites.name));
}

/** 치료법별 시행처 수 — 허브의 칩과 색인 게이트에 쓴다 */
export async function countRehabSitesByModality(): Promise<Map<string, number>> {
  if (!isDbConfigured()) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      modality: sql<string>`m.slug`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(rehabSites)
    .innerJoin(sql`unnest(${rehabSites.modalities}) as m(slug)`, sql`true`)
    .where(and(eq(rehabSites.published, true), ne(rehabSites.status, "closed")))
    .groupBy(sql`m.slug`);
  return new Map(rows.map((r) => [r.modality, r.count]));
}

export async function countRehabSites(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const rows = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(rehabSites)
    .where(and(eq(rehabSites.published, true), ne(rehabSites.status, "closed")));
  return rows[0]?.count ?? 0;
}

/** 최신 확인 기준일 — 페이지 하단 출처 표기용 */
export async function latestRehabVerifiedAt(): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const rows = await getDb()
    .select({ latest: sql<string | null>`max(${rehabSites.verifiedAt})` })
    .from(rehabSites)
    .where(eq(rehabSites.published, true));
  return rows[0]?.latest ?? null;
}
