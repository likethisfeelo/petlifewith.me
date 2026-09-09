import Link from "next/link";
import { carePersonLabel, isCareType } from "@app/data";
import { isDbConfigured, getDb, schema } from "@/lib/db";
import { getServiceRequest } from "@/lib/queries/requests";
import { REQUEST_KIND_LABEL, type CarePartnerPayload, type SpotRegisterPayload } from "@/lib/requests";
import { AdminPageHeader } from "../../../_components/fields";
import type { RowValue } from "../../../_components/rows-editor";
import type { ServiceAreaRow } from "../[id]/service-areas-editor";
import { SpotEditor, type SpotFormValues } from "../[id]/spot-editor";

const { spotTypes, regions } = schema;

interface Props {
  searchParams: Promise<{ from?: string }>;
}

const EMPTY: SpotFormValues = {
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
};

/** 요청함의 업체 등록·돌봄 파트너 요청 → 등록 폼 초기값. 담당자 연락처는 옮기지 않는다(요청함에서만 본다). */
function prefillFromRequest(
  req: NonNullable<Awaited<ReturnType<typeof getServiceRequest>>>,
  typeIdBySlug: Map<string, number>,
): { spot: SpotFormValues; links: RowValue[]; serviceAreas: ServiceAreaRow[]; label: string } | null {
  const link = (kind: string, url: string | null): RowValue[] => (url ? [{ kind, url, label: "" }] : []);
  if (req.kind === "spot_register") {
    const p = req.payload as SpotRegisterPayload;
    return {
      spot: { ...EMPTY, name: p.businessName, typeId: typeIdBySlug.get(p.typeSlug) ?? "", regionId: p.regionId, addressRoad: p.addressRoad, phone: p.phone, descriptionMd: p.intro },
      links: [...link("website", p.website), ...link("kakao", p.kakaoUrl), ...link("instagram", p.instagramUrl)],
      serviceAreas: [],
      label: `${REQUEST_KIND_LABEL[req.kind]} · ${p.businessName}`,
    };
  }
  if (req.kind === "care_partner") {
    const p = req.payload as CarePartnerPayload;
    return {
      spot: { ...EMPTY, name: p.displayName, typeId: typeIdBySlug.get(p.typeSlug) ?? "", regionId: p.regionIds[0] ?? "", priceText: p.priceText, hoursText: p.hoursText, descriptionMd: p.intro },
      links: link("kakao", p.kakaoUrl),
      serviceAreas: p.regionIds.map((regionId) => ({ regionId, exposed: true })),
      label: `${REQUEST_KIND_LABEL[req.kind]} · ${carePersonLabel(p.typeSlug)} ${p.displayName}`,
    };
  }
  return null;
}

export default async function AdminSpotNewPage({ searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();
  const { from } = await searchParams;

  const [types, regionRows] = await Promise.all([
    db.select({ id: spotTypes.id, slug: spotTypes.slug, name: spotTypes.name, listed: spotTypes.listed }).from(spotTypes).orderBy(spotTypes.sortOrder),
    db.select().from(regions).orderBy(regions.sidoName, regions.sigunguName),
  ]);

  const fromId = Number(from);
  const request = Number.isSafeInteger(fromId) && fromId > 0 ? await getServiceRequest(fromId) : null;
  const prefill = request ? prefillFromRequest(request, new Map(types.map((t) => [t.slug, t.id]))) : null;

  return (
    <div>
      <AdminPageHeader
        title="스팟 등록"
        description="공공데이터에 없는 곳을 직접 넣는 경로입니다. 셀프목욕·방문목욕·재활처럼 인허가로 잡히지 않는 시설이 여기로 들어옵니다. 출처는 '직접 발굴'로 기록됩니다."
      />
      {prefill && request && (
        <p className="mt-4 rounded-lg border border-sea/30 bg-sea-soft px-3 py-2 text-sm text-sea">
          요청함 #{request.id} ({prefill.label}) 의 내용으로 채웠습니다. 확인·다듬은 뒤 등록하면 요청에 이 스팟이 연결되고 상태가 &quot;처리 중&quot;이 됩니다.{" "}
          <Link href={`/admin/requests#request-${request.id}`} className="underline">
            요청 보기
          </Link>
        </p>
      )}
      {request && !prefill && (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">요청함 #{request.id} 은(는) 등록 요청이 아니라 값을 채우지 않았습니다.</p>
      )}
      <div className="mt-5">
        <SpotEditor
          mode="create"
          spot={prefill?.spot ?? EMPTY}
          types={types.map((t) => ({ id: t.id, label: t.listed ? t.name : `${t.name} (B2B 참고)` }))}
          regions={regionRows.map((r) => ({ id: r.id, label: `${r.sidoName} ${r.sigunguName}` }))}
          links={prefill?.links ?? []}
          careTypeIds={types.filter((t) => isCareType(t.slug)).map((t) => t.id)}
          areaOptions={regionRows.map((r) => ({ id: r.id, sidoName: r.sidoName, sidoSlug: r.sidoSlug, sigunguName: r.sigunguName }))}
          serviceAreas={prefill?.serviceAreas ?? []}
          fromRequestId={prefill && request ? request.id : undefined}
        />
      </div>
    </div>
  );
}
