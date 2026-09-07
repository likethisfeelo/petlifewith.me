import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { RehabEditor } from "../[id]/rehab-editor";

const { regions } = schema;

export default async function AdminRehabNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const regionRows = await getDb().select().from(regions).orderBy(regions.sidoName, regions.sigunguName);

  return (
    <div>
      <AdminPageHeader title="재활·한방·특수치료 시행처 등록" description="직접 확인한 곳만 넣습니다. 확인 출처와 기준일을 함께 남기세요." />
      <div className="mt-5">
        <RehabEditor
          mode="create"
          site={{
            externalRef: null,
            name: "",
            regionId: null,
            address: null,
            phone: null,
            status: "operating",
            modalities: [],
            sourceLabel: null,
            evidenceNote: null,
            internalLevel: null,
            internalNote: null,
            verifiedAt: new Date().toISOString().slice(0, 10),
            published: true,
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
        />
      </div>
    </div>
  );
}
