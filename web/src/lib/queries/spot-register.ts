// 업체 등록 흐름 조회 — 내 업체 찾기, 등록 직전 중복 확인 (규칙은 lib/spot-register.ts)
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { idSlugPath } from "../format";
import { nameKey, namesLookSame, ownerStateOf, phoneDigits, type OwnerState } from "../spot-register";

const { spots, spotTypes, regions } = schema;

export interface OwnerSearchHit {
  id: number;
  name: string;
  href: string;
  typeName: string;
  regionLabel: string;
  address: string | null;
  status: string;
  owner: OwnerState;
}

const cols = {
  id: spots.id,
  name: spots.name,
  slug: spots.slug,
  typeName: spotTypes.name,
  sidoName: regions.sidoName,
  sigunguName: regions.sigunguName,
  address: spots.addressRoad,
  status: spots.status,
  claimedBy: spots.claimedBy,
};

type Row = { id: number; name: string; slug: string; typeName: string; sidoName: string; sigunguName: string; address: string | null; status: string; claimedBy: string | null };

function toHit(r: Row, memberId: string | null): OwnerSearchHit {
  return {
    id: r.id,
    name: r.name,
    href: idSlugPath("place", r.id, r.slug),
    typeName: r.typeName,
    regionLabel: `${r.sidoName} ${r.sigunguName}`,
    address: r.address,
    status: r.status,
    owner: ownerStateOf(r.claimedBy, memberId),
  };
}

const phoneSql = sql`regexp_replace(coalesce(${spots.phone}, ''), '[^0-9]', '', 'g')`;

/** 내 업체 찾기 — 이름 또는 전화번호. 고른 지역·업종이 있으면 앞에 둔다(거르지는 않음: 지역을 잘못 아는 경우도 있다) */
export async function searchSpotsForOwner(
  term: { text: string; phone: string | null },
  opts: { regionId?: number | null; typeSlug?: string | null; memberId: string | null },
): Promise<OwnerSearchHit[]> {
  if (!isDbConfigured()) return [];
  const like = `%${term.text.replace(/[%_\\]/g, "")}%`;
  const match = term.phone ? or(ilike(spots.name, like), sql`${phoneSql} = ${term.phone}`) : ilike(spots.name, like);
  const rows = await getDb()
    .select(cols)
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(eq(spotTypes.listed, true), match))
    .orderBy(
      sql`case when ${spots.regionId} = ${opts.regionId ?? -1} then 0 else 1 end`,
      sql`case when ${spotTypes.slug} = ${opts.typeSlug ?? ""} then 0 else 1 end`,
      sql`case when ${spots.status} = 'operating' then 0 else 1 end`,
      asc(spots.name),
    )
    .limit(12);
  return rows.map((r) => toHit(r, opts.memberId));
}

/** 등록 요청 직전 — 같은 지역에 이름이 비슷하거나, 어디든 전화번호가 같은 업체 */
export async function findDuplicateSpots(input: { name: string | null; phone: string | null; regionId: number | null }, memberId: string | null): Promise<OwnerSearchHit[]> {
  if (!isDbConfigured()) return [];
  const conds = [];
  const key = input.name ? nameKey(input.name) : "";
  if (key.length >= 2 && input.regionId) conds.push(and(eq(spots.regionId, input.regionId), ilike(spots.name, `%${key.slice(0, 2)}%`)));
  const digits = phoneDigits(input.phone);
  if (digits) conds.push(sql`${phoneSql} = ${digits}`);
  if (conds.length === 0) return [];
  const rows = await getDb()
    .select({ ...cols, phone: spots.phone })
    .from(spots)
    .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
    .innerJoin(regions, eq(spots.regionId, regions.id))
    .where(and(eq(spotTypes.listed, true), or(...conds)))
    .limit(300);
  return rows
    .filter((r) => (digits && phoneDigits(r.phone) === digits) || (input.name && namesLookSame(input.name, r.name)))
    .slice(0, 5)
    .map((r) => toHit(r, memberId));
}

/** 업체가 정해진 채로 들어올 때 (?spot=<번호>) — 찾기를 건너뛰고 바로 고른 상태로 */
export async function getSpotForOwner(id: number, memberId: string | null): Promise<OwnerSearchHit | null> {
  if (!isDbConfigured()) return null;
  const r = (
    await getDb()
      .select(cols)
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(and(eq(spots.id, id), eq(spotTypes.listed, true)))
      .limit(1)
  )[0];
  return r ? toHit(r, memberId) : null;
}
