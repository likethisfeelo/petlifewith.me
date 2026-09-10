import type { Metadata } from "next";
import Link from "next/link";
import { isCareType } from "@app/data";
import { siteName } from "@/lib/config";
import { idSlugPath } from "@/lib/format";
import { listRegionOptions } from "@/lib/queries/requests";
import { canPromoteRehabSpot } from "@/lib/queries/devices";
import { getPromoPlanSettings } from "@/lib/queries/settings";
import { getPlace } from "@/lib/queries/spots";
import { PromoForm, type PromoSpot } from "./promo-form";

export const metadata: Metadata = {
  title: "지역 상단 노출 요청 — 사장님 페이지",
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Promise<{ spot?: string }>;
}

export default async function PromoPortalPage({ searchParams }: Props) {
  const { spot: spotParam } = await searchParams;
  const spotId = Number(spotParam);
  let spot: PromoSpot | null = null;
  let blocked: string | null = null;
  if (Number.isSafeInteger(spotId) && spotId > 0) {
    const place = await getPlace(spotId);
    if (place) {
      if (!place.typeMonetizable) blocked = "이 유형의 업체에는 상단 노출을 제공하지 않습니다.";
      else if (isCareType(place.typeSlug)) blocked = "돌봄 파트너는 지역별 자리로 노출되며 유료 상단 노출 대상이 아닙니다.";
      // 운동·재활은 장비를 등록한 곳만, 동물병원은 제외 (claude.md 6-2)
      else if (place.typeSlug === "rehab" && !(await canPromoteRehabSpot(place.spot.id)))
        blocked = place.spot.isHospital
          ? "동물병원은 재활·특수 훈련 장비 보유처로 무료로만 소개합니다. 상단 노출·순위·추천은 붙이지 않습니다."
          : "운동·재활은 재활·특수 훈련 장비를 등록한 곳만 상단 노출이 가능합니다. 보유 장비를 먼저 알려 주세요.";
      else
        spot = {
          id: place.spot.id,
          name: place.spot.name,
          path: idSlugPath("place", place.spot.id, place.spot.slug),
          regionLabel: `${place.region.sidoName} ${place.region.sigunguName}`,
          regionId: place.region.id,
        };
    }
  }
  const [regions, plans] = await Promise.all([spot ? Promise.resolve([]) : listRegionOptions(), getPromoPlanSettings()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 사장님 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">지역 상단 노출 요청</h1>
      <p className="mt-4 text-ink-soft">
        지역 페이지(시·군·구 × 업종) 상단에 업체를 고정 노출하는 유료 상품입니다. 요청을 남기면 운영자가 형별 내용과 결제 방법을 안내하고, 확인
        후 노출을 켭니다. 기본 등록과 정보 관리는 계속 무료입니다.
      </p>
      <p className="mt-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
        운동·재활 유형은 재활·특수 훈련 장비를 등록한 곳만 상단 노출을 받을 수 있습니다. 동물병원은 장비 보유처로 무료 노출만 하며 상단 노출·순위·추천 대상이 아닙니다.
      </p>
      {blocked && <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{blocked}</p>}
      <PromoForm spot={spot} regions={regions} plans={plans} />
      <p className="mt-8 text-xs text-ink-faint">
        <Link href="/portal/spot" className="underline">
          사장님 페이지로
        </Link>
      </p>
    </div>
  );
}
