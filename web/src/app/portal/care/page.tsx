import type { Metadata } from "next";
import Link from "next/link";
import { MAX_EXPOSED_PER_AREA, isCareType } from "@app/data";
import { siteName } from "@/lib/config";
import { listRegionOptions } from "@/lib/queries/requests";
import { CarePartnerForm } from "./care-partner-form";

export const metadata: Metadata = {
  title: "돌봄 파트너 등록 — 사장님 페이지",
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Promise<{ type?: string; region?: string }>;
}

export default async function CarePortalPage({ searchParams }: Props) {
  const { type, region } = await searchParams;
  const regionId = Number(region);
  const regions = await listRegionOptions();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 사장님 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">펫시터 · 시간제 시터 · 도그워커 등록</h1>
      <p className="mt-4 text-ink-soft">
        돌봄 파트너는 시설이 아니라 사람이 움직이는 서비스라 주소 대신 <strong>활동 지역</strong>(시·군·구)으로 노출됩니다. 지역마다{" "}
        {MAX_EXPOSED_PER_AREA}자리이고 무료입니다. 요청을 남기면 운영자가 확인한 뒤 자리에 올리고, 예약 신청은 운영자가 받아 연결해 드립니다.
      </p>
      <CarePartnerForm regions={regions} defaultType={isCareType(type) ? type : null} defaultRegionId={Number.isSafeInteger(regionId) && regionId > 0 ? regionId : null} />
      <p className="mt-8 text-xs text-ink-faint">
        <Link href="/portal/spot" className="underline">
          사장님 페이지로
        </Link>
      </p>
    </div>
  );
}
