import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { RehabEditor } from "./rehab-editor";

const { rehabSites, regions } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminRehabEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const siteId = Number(id);
  if (!Number.isSafeInteger(siteId)) notFound();

  const db = getDb();
  const site = (await db.select().from(rehabSites).where(eq(rehabSites.id, siteId)).limit(1))[0];
  if (!site) notFound();
  const regionRows = await db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName);

  return (
    <div>
      <AdminPageHeader
        title={site.name}
        description={site.externalRef ? `외부키 ${site.externalRef}` : "관리자 등록"}
        right={
          <Link href="/rehab" className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        }
      />
      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">등록되었습니다.</p>
      )}
      <div className="mt-5">
        <RehabEditor
          mode="edit"
          site={{
            id: site.id,
            externalRef: site.externalRef,
            name: site.name,
            regionId: site.regionId,
            address: site.address,
            phone: site.phone,
            status: site.status,
            modalities: site.modalities,
            sourceLabel: site.sourceLabel,
            evidenceNote: site.evidenceNote,
            internalLevel: site.internalLevel,
            internalNote: site.internalNote,
            verifiedAt: site.verifiedAt,
            published: site.published,
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
        />
      </div>
    </div>
  );
}
