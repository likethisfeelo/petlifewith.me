import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { idSlugPath } from "@/lib/format";
import { guidesMentioningItem } from "@/lib/queries/guides";
import { AdminPageHeader } from "../../../_components/fields";
import { ItemEditor } from "./item-editor";

const { items, itemOffers, makers } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminItemEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId)) notFound();

  const db = getDb();
  const item = (await db.select().from(items).where(eq(items.id, itemId)).limit(1))[0];
  if (!item) notFound();

  const [offers, makerRows, mentions] = await Promise.all([
    db.select().from(itemOffers).where(eq(itemOffers.itemId, itemId)).orderBy(asc(itemOffers.sortOrder)),
    db.select({ id: makers.id, name: makers.name }).from(makers).orderBy(asc(makers.name)),
    guidesMentioningItem(itemId),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={item.name}
        description={`슬러그 /${item.slug} · 언급된 글 ${mentions.length}편`}
        right={
          <Link href={idSlugPath("item", item.id, item.slug)} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        }
      />

      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다. 게시글 편집 화면의 개체 태깅에서 이 상품을 글에 연결하세요.
        </p>
      )}

      <div className="mt-5">
        <ItemEditor
          mode="edit"
          item={{
            id: item.id,
            name: item.name,
            category: item.category,
            makerId: item.makerId ?? "",
            summary: item.summary,
            descriptionMd: item.descriptionMd,
          }}
          makers={makerRows.map((m) => ({ id: m.id, label: m.name }))}
          offers={offers.map((o) => ({
            vendor: o.vendor,
            url: o.url,
            label: o.label ?? "",
            isAffiliate: o.isAffiliate,
          }))}
        />
      </div>
    </div>
  );
}
