import { asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { items, itemOffers, makers } = schema;

export type ItemRow = typeof items.$inferSelect;
export type ItemOfferRow = typeof itemOffers.$inferSelect;

export interface ItemDetail {
  item: ItemRow;
  maker: { id: number; name: string; slug: string } | null;
  offers: ItemOfferRow[];
  hasAffiliateOffers: boolean;
}

export async function getItemDetail(id: number): Promise<ItemDetail | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ item: items, makerId: makers.id, makerName: makers.name, makerSlug: makers.slug })
    .from(items)
    .leftJoin(makers, eq(items.makerId, makers.id))
    .where(eq(items.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const offers = await db.select().from(itemOffers).where(eq(itemOffers.itemId, id)).orderBy(asc(itemOffers.sortOrder));
  return {
    item: row.item,
    maker: row.makerId && row.makerName && row.makerSlug ? { id: row.makerId, name: row.makerName, slug: row.makerSlug } : null,
    offers,
    hasAffiliateOffers: offers.some((o) => o.isAffiliate),
  };
}
