import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { CurationEditor } from "./curation-editor";

const { curations, curationEntries } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminCurationEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const curationId = Number(id);
  if (!Number.isSafeInteger(curationId)) notFound();

  const db = getDb();
  const curation = (await db.select().from(curations).where(eq(curations.id, curationId)).limit(1))[0];
  if (!curation) notFound();

  const entries = await db
    .select()
    .from(curationEntries)
    .where(eq(curationEntries.curationId, curationId))
    .orderBy(asc(curationEntries.sortOrder));

  return (
    <div>
      <AdminPageHeader title={curation.title} description={`URL /curation/${curation.themeSlug}`} />
      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다.
        </p>
      )}
      <div className="mt-5">
        <CurationEditor
          mode="edit"
          curation={{
            id: curation.id,
            title: curation.title,
            introMd: curation.introMd,
            status: curation.status,
          }}
          entries={entries.map((e) => ({
            embedSource: e.embedSource,
            embedRef: e.embedRef ?? "",
            creatorName: e.creatorName,
            originalUrl: e.originalUrl,
            summaryMd: e.summaryMd,
          }))}
        />
      </div>
    </div>
  );
}
