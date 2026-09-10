import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { DeviceEditor } from "../[id]/device-editor";

const { regions } = schema;

export default async function AdminDeviceNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const regionRows = await getDb().select().from(regions).orderBy(regions.sidoName, regions.sigunguName);

  return (
    <div>
      <AdminPageHeader title="기기 등록" description="관리·재활 도구를 기기 자체를 주어로 정리합니다. 본사·대리점·체험 가능 업체로 이어집니다." />
      <div className="mt-5">
        <DeviceEditor
          mode="create"
          device={{ name: "", makerName: null, category: "rehab_equipment", summaryMd: null, specsMd: null, makerUrl: null, makerContactUrl: null, imageKey: null, priceText: null, published: false, homeUse: false, featuredOrder: null }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          sites={[]}
        />
      </div>
    </div>
  );
}
