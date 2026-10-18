import Link from "next/link";
import { notFound } from "next/navigation";
import { isCareType } from "@app/data";
import { idSlugPath } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { getOwnedSpot } from "@/lib/queries/owner";
import { getPlace } from "@/lib/queries/spots";
import { SpotPagePanel } from "@/components/linkpage/spot-page-panel";
import { OwnerSpotForm } from "./owner-spot-form";

export default async function OwnerSpotPage({ params }: { params: Promise<{ id: string }> }) {
  const member = (await getCurrentMember())!;
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isSafeInteger(spotId)) notFound();
  const found = await getOwnedSpot(spotId, member.id);
  if (!found) notFound();
  const { spot, typeName, typeSlug, sidoName, sigunguName, links } = found;
  const monetizable = (await getPlace(spot.id))?.typeMonetizable ?? false;

  return (
    <div>
      <p className="text-xs text-ink-faint">
        <Link href="/me/business" className="hover:underline">
          내 업체·브랜드
        </Link>{" "}
        › {spot.name}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{spot.name}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {typeName} · {sidoName} {sigunguName}
            {spot.addressRoad ? ` · ${spot.addressRoad}` : ""}
          </p>
        </div>
        <Link href={idSlugPath("place", spot.id, spot.slug)} className="text-sm font-medium text-sea hover:underline">
          공개 페이지 보기 →
        </Link>
      </div>
      <p className="mt-3 rounded-lg border border-line bg-sand/60 px-3 py-2 text-xs text-ink-soft">
        이름·업종·지역·주소를 바꾸려면{" "}
        <Link href={`/claim/spot/${spot.id}`} className="font-medium text-sea underline">
          정정 요청
        </Link>
        을 보내 주세요. 저장하면 바로 공개 페이지에 반영됩니다.
        {isCareType(typeSlug) ? " 활동 지역(시군구)과 노출 자리는 운영자가 관리합니다." : ""}
      </p>
      <div className="mt-5">
        <OwnerSpotForm
          spot={{
            id: spot.id,
            status: spot.status,
            phone: spot.phone,
            hoursText: spot.hoursText,
            priceText: spot.priceText,
            parkingText: spot.parkingText,
            descriptionMd: spot.descriptionMd,
            heroImageKey: spot.heroImageKey,
            isCare: isCareType(typeSlug),
          }}
          links={links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? "" }))}
        />
      </div>
      <div className="mt-6">
        <SpotPagePanel spotId={spot.id} admin={false} monetizable={monetizable} />
      </div>
    </div>
  );
}
