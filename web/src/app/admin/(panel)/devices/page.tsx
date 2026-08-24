import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { AdminPageHeader } from "../../_components/fields";

const { deviceModels, deviceSites, guideDeviceTags } = schema;

export default async function AdminDevicesPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({
      device: deviceModels,
      siteCount: sql<number>`count(distinct ${deviceSites.id})`.mapWith(Number),
      guideCount: sql<number>`count(distinct ${guideDeviceTags.id})`.mapWith(Number),
    })
    .from(deviceModels)
    .leftJoin(deviceSites, eq(deviceSites.deviceModelId, deviceModels.id))
    .leftJoin(guideDeviceTags, eq(guideDeviceTags.deviceModelId, deviceModels.id))
    .groupBy(deviceModels.id)
    .orderBy(desc(deviceModels.updatedAt));

  return (
    <div>
      <AdminPageHeader
        title={`기기 ${rows.length}개`}
        description="기기 자체를 주어로 다룹니다. 보유처 목록은 기기 콘텐츠 안에서만 무료로 노출되며 광고 상품이 아닙니다."
        right={
          <Link href="/admin/devices/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 기기 등록
          </Link>
        }
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">기기</th>
              <th className="px-4 py-2.5 font-medium">제조사</th>
              <th className="px-4 py-2.5 font-medium">보유처</th>
              <th className="px-4 py-2.5 font-medium">연결된 글</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-faint">
                  등록된 기기가 없습니다.
                </td>
              </tr>
            )}
            {rows.map(({ device, siteCount, guideCount }) => (
              <tr key={device.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/devices/${device.id}`} className="font-medium text-ink hover:underline">
                    {device.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{device.makerName ?? "-"}</td>
                <td className="px-4 py-2.5 text-ink-soft">{siteCount}곳</td>
                <td className="px-4 py-2.5 text-ink-soft">{guideCount}편</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
