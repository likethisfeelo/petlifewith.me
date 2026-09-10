import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getDeviceById } from "@/lib/queries/devices";
import { AdminPageHeader } from "../../../_components/fields";
import { DeviceEditor } from "./device-editor";

const { deviceModels, deviceSites, deviceDealers, regions } = schema;

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

  const [sites, dealers, regionRows, detail] = await Promise.all([
    db.select().from(deviceSites).where(and(eq(deviceSites.deviceModelId, deviceId), eq(deviceSites.kind, "hospital"))).orderBy(asc(deviceSites.facilityName)),
    db.select().from(deviceDealers).where(eq(deviceDealers.deviceModelId, deviceId)).orderBy(asc(deviceDealers.sortOrder), asc(deviceDealers.id)),
    db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName),
    getDeviceById(deviceId),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={device.name}
        description={`${device.published ? "공개 중" : "비공개"} · 슬러그 /${device.slug}`}
        right={
          device.published ? (
            <Link href={`/device/${encodeURIComponent(device.slug)}`} className="text-sm font-medium text-sea hover:underline">
              공개 페이지 보기 →
            </Link>
          ) : undefined
        }
      />
      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다. 공개 체크를 켜면 관리·재활 도구 허브(/device)에 보이고, 게시글 편집에서 기기를 글에 연결하면 기기 페이지에 그 글이 실립니다.
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
            makerUrl: device.makerUrl,
            makerContactUrl: device.makerContactUrl,
            imageKey: device.imageKey,
            priceText: device.priceText,
            published: device.published,
            homeUse: device.homeUse,
            featuredOrder: device.featuredOrder,
          }}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          sites={sites.map((s) => ({
            facilityName: s.facilityName,
            regionId: s.regionId ? String(s.regionId) : "",
            verifiedAt: s.verifiedAt ?? "",
            note: s.note ?? "",
          }))}
          dealers={dealers.map((x) => ({
            name: x.name,
            regionId: x.regionId ? String(x.regionId) : "",
            url: x.url ?? "",
            phone: x.phone ?? "",
            note: x.note ?? "",
          }))}
          trials={(detail?.trials ?? []).map((t) => ({ spotId: t.spotId, name: t.name, regionLabel: t.regionLabel }))}
        />
      </div>
    </div>
  );
}
