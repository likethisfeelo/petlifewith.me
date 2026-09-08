import { isCareType } from "@app/data";
import { isDbConfigured, getDb, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { SpotEditor } from "../[id]/spot-editor";

const { spotTypes, regions } = schema;

export default async function AdminSpotNewPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const [types, regionRows] = await Promise.all([
    db.select({ id: spotTypes.id, slug: spotTypes.slug, name: spotTypes.name, listed: spotTypes.listed }).from(spotTypes).orderBy(spotTypes.sortOrder),
    db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="스팟 등록"
        description="공공데이터에 없는 곳을 직접 넣는 경로입니다. 셀프목욕·방문목욕·재활처럼 인허가로 잡히지 않는 시설이 여기로 들어옵니다. 출처는 '직접 발굴'로 기록됩니다."
      />
      <div className="mt-5">
        <SpotEditor
          mode="create"
          spot={{
            name: "",
            typeId: "",
            regionId: "",
            status: "operating",
            addressRoad: null,
            phone: null,
            hoursText: null,
            priceText: null,
            parkingText: null,
            descriptionMd: null,
          }}
          types={types.map((t) => ({ id: t.id, label: t.listed ? t.name : `${t.name} (B2B 참고)` }))}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          links={[]}
          careTypeIds={types.filter((t) => isCareType(t.slug)).map((t) => t.id)}
          areaOptions={regionRows.map((r) => ({ id: r.id, sidoName: r.sidoName, sidoSlug: r.sidoSlug, sigunguName: r.sigunguName }))}
        />
      </div>
    </div>
  );
}
