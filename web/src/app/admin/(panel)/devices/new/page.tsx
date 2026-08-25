import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { DeviceEditor } from "../[id]/device-editor";

const { regions } = schema;

export default async function AdminDeviceNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const regionRows = await getDb().select().from(regions).orderBy(regions.sidoName, regions.sigunguName);

  return (
    <div>
      <AdminPageHeader title="기기 등록" description="치료·진단 기기를 기기 자체를 주어로 정리합니다." />
      <div className="mt-5">
        <DeviceEditor
          mode="create"
          device={{ name: "", makerName: null, category: "other", summaryMd: null, specsMd: null }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          sites={[]}
        />
      </div>
    </div>
  );
}
