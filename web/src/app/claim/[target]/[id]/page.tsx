import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSlugPath } from "@/lib/format";
import { getMakerProfile } from "@/lib/queries/makers";
import { getPlace } from "@/lib/queries/spots";
import { ClaimForm } from "./claim-form";

// claim 페이지는 항상 noindex — robots.ts 에서도 /claim/ 을 차단한다
export const metadata: Metadata = {
  title: "정보 관리 요청",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ target: string; id: string }>;
}

export default async function ClaimPage({ params }: Props) {
  const { target, id } = await params;
  const targetId = Number(id);
  if ((target !== "spot" && target !== "maker") || !Number.isSafeInteger(targetId) || targetId <= 0) notFound();

  let name: string;
  let backPath: string;
  if (target === "spot") {
    const place = await getPlace(targetId);
    if (!place) notFound();
    name = place.spot.name;
    backPath = idSlugPath("place", place.spot.id, place.spot.slug);
  } else {
    const profile = await getMakerProfile(targetId);
    if (!profile) notFound();
    name = profile.maker.name;
    backPath = idSlugPath("maker", profile.maker.id, profile.maker.slug);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">정보 관리 요청 (무료)</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{name}</h1>

      <p className="mt-3 text-sm text-ink-soft">
        운영자·브랜드 담당자임을 확인한 뒤 정보를 반영해 드립니다. 기본 등록은 무료이며, 잘못된 정보의 정정 요청도 이 창구로 받습니다.
      </p>
      <ClaimForm targetType={target} targetId={targetId} backPath={backPath} />
    </div>
  );
}
