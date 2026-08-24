import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { idSlugPath } from "@/lib/format";
import { SpotEditor } from "./spot-editor";

const { spots, spotTypes, regions } = schema;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSpotEditPage({ params }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isSafeInteger(spotId)) notFound();

  const db = getDb();
  const row = (
    await db
      .select({ spot: spots, sigunguName: regions.sigunguName, sidoName: regions.sidoName })
      .from(spots)
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row) notFound();
  const types = await db.select({ id: spotTypes.id, name: spotTypes.name }).from(spotTypes).orderBy(spotTypes.sortOrder);

  const { spot } = row;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{spot.name}</h1>
        <Link href={idSlugPath("place", spot.id, spot.slug)} className="text-sm font-medium text-sea hover:underline">
          공개 페이지 보기 →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {row.sidoName} {row.sigunguName}
        {spot.addressRoad ? ` · ${spot.addressRoad}` : ""}
        {spot.licenseMgmtNo ? ` · 관리번호 ${spot.licenseMgmtNo}` : ""}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        인허가 원천 필드(이름·주소·영업상태·기준일)는 ETL 재실행 시 갱신됩니다. 여기서 채우는 에디토리얼
        필드는 ETL 이 덮어쓰지 않습니다.
      </p>

      <div className="mt-5 rounded-xl border border-line bg-surface p-4">
        <SpotEditor
          spot={{
            id: spot.id,
            typeId: spot.typeId,
            status: spot.status,
            phone: spot.phone,
            descriptionMd: spot.descriptionMd,
            hoursText: spot.hoursText,
            priceText: spot.priceText,
            parkingText: spot.parkingText,
            reservationUrl: spot.reservationUrl,
            homepageUrl: spot.homepageUrl,
            instagramUrl: spot.instagramUrl,
          }}
          types={types}
        />
      </div>
    </div>
  );
}
