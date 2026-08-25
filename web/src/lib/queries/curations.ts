import { asc, desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { curations, curationEntries } = schema;

export type CurationRow = typeof curations.$inferSelect;
export type CurationEntryRow = typeof curationEntries.$inferSelect;

export async function listPublishedCurations(): Promise<CurationRow[]> {
  if (!isDbConfigured()) return [];
  return getDb().select().from(curations).where(eq(curations.status, "published")).orderBy(desc(curations.publishedAt));
}

export async function getCurationByTheme(themeSlug: string): Promise<{ curation: CurationRow; entries: CurationEntryRow[] } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db.select().from(curations).where(eq(curations.themeSlug, themeSlug)).limit(1);
  const curation = rows[0];
  if (!curation || curation.status !== "published") return null;
  const entries = await db
    .select()
    .from(curationEntries)
    .where(eq(curationEntries.curationId, curation.id))
    .orderBy(asc(curationEntries.sortOrder));
  return { curation, entries };
}
