import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { ITEM_CATEGORY_LABEL, idSlugPath } from "@/lib/format";
import { AdminPageHeader } from "../../../_components/fields";
import { MakerEditor } from "./maker-editor";

const { makers, makerLinks, regions, items } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminMakerEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const makerId = Number(id);
  if (!Number.isSafeInteger(makerId)) notFound();

  const db = getDb();
  const maker = (await db.select().from(makers).where(eq(makers.id, makerId)).limit(1))[0];
  if (!maker) notFound();

  const [links, regionRows, makerItems] = await Promise.all([
    db.select().from(makerLinks).where(eq(makerLinks.makerId, makerId)).orderBy(asc(makerLinks.sortOrder)),
    db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName),
    db.select().from(items).where(eq(items.makerId, makerId)).orderBy(asc(items.name)),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={maker.name}
        description={`슬러그 /${maker.slug}`}
        right={
          maker.status === "published" ? (
            <Link href={idSlugPath("maker", maker.id, maker.slug)} className="text-sm font-medium text-sea hover:underline">
              공개 페이지 보기 →
            </Link>
          ) : undefined
        }
      />

      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다. 소개(스토리)를 채우고 공개로 전환하세요.
        </p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]">
        <MakerEditor
          mode="edit"
          maker={{
            id: maker.id,
            name: maker.name,
            category: maker.category,
            regionId: maker.regionId ?? "",
            storyMd: maker.storyMd,
            badgeFeedRegistered: maker.badgeFeedRegistered,
            badgeIngredientRegistered: maker.badgeIngredientRegistered,
            badgeVerifiedAt: maker.badgeVerifiedAt,
            badgeNote: maker.badgeNote,
            selectionMemo: maker.selectionMemo,
            status: maker.status,
            heroImageKey: maker.heroImageKey,
            seo: { seoTitle: maker.seoTitle, seoDescription: maker.seoDescription, ogImageKey: maker.ogImageKey },
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          links={links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? "" }))}
        />

        <aside className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-ink">이 브랜드의 상품</h2>
              <Link href="/admin/items/new" className="text-xs text-sea hover:underline">
                + 추가
              </Link>
            </div>
            {makerItems.length === 0 ? (
              <p className="mt-2 text-xs text-ink-faint">아직 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {makerItems.map((it) => (
                  <li key={it.id}>
                    <Link href={`/admin/items/${it.id}`} className="text-ink hover:underline">
                      {it.name}
                    </Link>
                    <span className="ml-1.5 text-xs text-ink-faint">
                      {ITEM_CATEGORY_LABEL[it.category] ?? it.category}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
