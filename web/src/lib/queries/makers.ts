import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { makers, makerLinks, items, regions, feedLicenses } = schema;

export type MakerRow = typeof makers.$inferSelect;

export interface MakerProfile {
  maker: MakerRow;
  regionLabel: string | null; // "경기도 성남시" — 시군구까지만 (claude.md 5-6)
  links: Array<typeof makerLinks.$inferSelect>;
  items: Array<typeof items.$inferSelect>;
  feedLicense: { registeredAt: string | null; referenceDate: string | null } | null;
}

export async function getMakerProfile(id: number): Promise<MakerProfile | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ maker: makers, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
    .from(makers)
    .leftJoin(regions, eq(makers.regionId, regions.id))
    .where(eq(makers.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const links = await db.select().from(makerLinks).where(eq(makerLinks.makerId, id)).orderBy(asc(makerLinks.sortOrder));
  const makerItems = await db.select().from(items).where(eq(items.makerId, id)).orderBy(asc(items.name));

  let feedLicense: MakerProfile["feedLicense"] = null;
  if (row.maker.feedLicenseId) {
    const fl = await db
      .select({ registeredAt: feedLicenses.registeredAt, referenceDate: feedLicenses.referenceDate })
      .from(feedLicenses)
      .where(eq(feedLicenses.id, row.maker.feedLicenseId))
      .limit(1);
    feedLicense = fl[0] ?? null;
  }

  return {
    maker: row.maker,
    regionLabel: row.sidoName ? `${row.sidoName} ${row.sigunguName ?? ""}`.trim() : null,
    links,
    items: makerItems,
    feedLicense,
  };
}

export async function listPublishedMakers(limit = 50): Promise<Array<{ maker: MakerRow; regionLabel: string | null }>> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ maker: makers, sidoName: regions.sidoName, sigunguName: regions.sigunguName })
    .from(makers)
    .leftJoin(regions, eq(makers.regionId, regions.id))
    .where(eq(makers.status, "published"))
    .orderBy(desc(makers.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    maker: r.maker,
    regionLabel: r.sidoName ? `${r.sidoName} ${r.sigunguName ?? ""}`.trim() : null,
  }));
}

export async function listMakersByCategory(category: string): Promise<MakerRow[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(makers)
    .where(and(eq(makers.status, "published"), eq(makers.category, category)))
    .orderBy(asc(makers.name));
}
