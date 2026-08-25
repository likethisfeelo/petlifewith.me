import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../../_components/fields";
import { DeviceEditor } from "./device-editor";

const { deviceModels, deviceSites, regions } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminDeviceEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const deviceId = Number(id);
  if (!Number.isSafeInteger(deviceId)) notFound();

  const db = getDb();
  const device = (await db.select().from(deviceModels).where(eq(deviceModels.id, deviceId)).limit(1))[0];
  if (!device) notFound();

  const [sites, regionRows] = await Promise.all([
    db.select().from(deviceSites).where(eq(deviceSites.deviceModelId, deviceId)).orderBy(asc(deviceSites.facilityName)),
    db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName),
  ]);

  return (
    <div>
      <AdminPageHeader title={device.name} description={`슬러그 /${device.slug}`} />
      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다. 게시글 편집에서 이 기기를 글에 연결하면 보유처 목록이 함께 노출됩니다.
        </p>
      )}
      <div className="mt-5">
        <DeviceEditor
          mode="edit"
          device={{
            id: device.id,
            name: device.name,
            makerName: device.makerName,
            category: device.category,
            summaryMd: device.summaryMd,
            specsMd: device.specsMd,
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          sites={sites.map((s) => ({
            facilityName: s.facilityName,
            regionId: s.regionId ? String(s.regionId) : "",
            verifiedAt: s.verifiedAt ?? "",
            note: s.note ?? "",
          }))}
        />
      </div>
    </div>
  );
}
