import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { SPOT_SOURCE_LABEL, idSlugPath } from "@/lib/format";
import { isCareType } from "@app/data";
import { listServiceAreasForSpot } from "@/lib/queries/care";
import { getSpotLinks } from "@/lib/queries/spots";
import { AdminPageHeader } from "../../../_components/fields";
import { SpotEditor } from "./spot-editor";

const { spots, spotTypes, regions } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminSpotEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
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

  const [types, links, serviceAreas, regionRows] = await Promise.all([
    db
      .select({ id: spotTypes.id, slug: spotTypes.slug, name: spotTypes.name, listed: spotTypes.listed })
      .from(spotTypes)
      .orderBy(spotTypes.sortOrder),
    getSpotLinks(spotId),
    listServiceAreasForSpot(spotId),
    db
      .select({ id: regions.id, sidoName: regions.sidoName, sidoSlug: regions.sidoSlug, sigunguName: regions.sigunguName })
      .from(regions)
      .orderBy(regions.id),
  ]);

  const { spot } = row;

  return (
    <div>
      <AdminPageHeader
        title={spot.name}
        description={`${row.sidoName} ${row.sigunguName}${spot.addressRoad ? ` · ${spot.addressRoad}` : ""}${
          spot.licenseMgmtNo ? ` · 관리번호 ${spot.licenseMgmtNo}` : ""
        }`}
        right={
          <Link href={idSlugPath("place", spot.id, spot.slug)} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        }
      />

      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          등록되었습니다. 이어서 정보를 보강하세요 — 정보 3항목을 채워야 검색 색인 대상이 됩니다.
        </p>
      )}

      <p className="mt-2 text-xs text-ink-faint">
        인허가 원천 필드(이름·주소·영업상태·기준일)는 ETL 재실행 시 갱신됩니다. 여기서 채우는 에디토리얼
        필드와 링크는 ETL 이 덮어쓰지 않습니다.
      </p>

      {/* 원천 데이터 명시 — 어디서 온 행인지 관리 화면에서도 그대로 보인다 */}
      <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-xl border border-line bg-surface p-4 text-xs text-ink-soft sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-ink-faint">출처</dt>
          <dd>{SPOT_SOURCE_LABEL[spot.source] ?? spot.source}</dd>
        </div>
        {spot.externalRef && (
          <div className="flex gap-2">
            <dt className="text-ink-faint">직접 발굴 외부키</dt>
            <dd>{spot.externalRef} <span className="text-ink-faint">(CSV 재적재 시 이 키로 갱신 — &quot;#&quot; 셀은 여기서 채운 값을 유지)</span></dd>
          </div>
        )}
        {spot.licenseMgmtNo && (
          <div className="flex gap-2">
            <dt className="text-ink-faint">인허가 관리번호</dt>
            <dd>{spot.licenseMgmtNo}</dd>
          </div>
        )}
        {spot.licenseDate && (
          <div className="flex gap-2">
            <dt className="text-ink-faint">인허가일</dt>
            <dd>{spot.licenseDate}</dd>
          </div>
        )}
        {spot.dataReferenceDate && (
          <div className="flex gap-2">
            <dt className="text-ink-faint">데이터 기준일</dt>
            <dd>{spot.dataReferenceDate}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        <SpotEditor
          mode="edit"
          spot={{
            id: spot.id,
            name: spot.name,
            typeId: spot.typeId,
            status: spot.status,
            addressRoad: spot.addressRoad,
            phone: spot.phone,
            hoursText: spot.hoursText,
            priceText: spot.priceText,
            parkingText: spot.parkingText,
            descriptionMd: spot.descriptionMd,
            heroImageKey: spot.heroImageKey,
            seo: { seoTitle: spot.seoTitle, seoDescription: spot.seoDescription, ogImageKey: spot.ogImageKey },
          }}
          types={types.map((t) => ({ id: t.id, label: t.listed ? t.name : `${t.name} (B2B 참고)` }))}
          links={links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? "" }))}
          careTypeIds={types.filter((t) => isCareType(t.slug)).map((t) => t.id)}
          areaOptions={regionRows}
          serviceAreas={serviceAreas.map((a) => ({ regionId: a.regionId, exposed: a.exposed }))}
        />
      </div>
    </div>
  );
}
