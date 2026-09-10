// 업체·돌봄 파트너 예약 요청 — 로그인 회원만. 요청 → 제공자(소유 회원)나 운영자가 확인 → 결제 확인 → 채팅.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carePersonLabel, isCareType } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReservationForm } from "@/components/reservation/reservation-form";
import { idSlugPath } from "@/lib/format";
import { requireMember } from "@/lib/member";
import { getPlace, getSpotLinks } from "@/lib/queries/spots";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "예약 요청", robots: robotsMeta(false) };

export default async function BookSpotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isSafeInteger(spotId)) notFound();
  const member = await requireMember(`/book/spot/${spotId}`);
  const place = await getPlace(spotId);
  if (!place) notFound();
  const { spot, typeName, typeSlug, region } = place;
  const links = await getSpotLinks(spotId);
  const kakao = links.find((l) => l.kind === "kakao")?.url ?? null;
  const care = isCareType(typeSlug);
  const path = idSlugPath("place", spot.id, spot.slug);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "스팟", path: "/spot" }, { name: spot.name, path }, { name: "예약 요청", path: `/book/spot/${spot.id}` }]} />
      <p className="mt-6 text-xs font-semibold text-sea">{care ? carePersonLabel(typeSlug) : typeName} · 예약 요청</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{spot.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {region.sidoName} {region.sigunguName}
        {spot.priceText ? ` · ${spot.priceText}` : ""}
      </p>
      {spot.status !== "operating" ? (
        <p className="mt-6 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">지금은 예약 요청을 받지 않는 곳입니다.</p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-line bg-sand/60 p-4 text-sm text-ink-soft">
            <p>요청을 보내면 {spot.claimedBy ? "운영자 또는 이 업체 담당자" : "운영자"}가 확인하고 결제 방법을 안내합니다. 결제가 확인되면 서비스 안 채팅이 열려 세부 약속을 잡을 수 있어요. 진행 상황은 내 페이지에서 봅니다.</p>
            {kakao && (
              <p className="mt-2">
                바로 이야기하고 싶다면{" "}
                <a href={kakao} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline">
                  카카오톡 상담
                </a>
                도 열려 있어요.
              </p>
            )}
          </div>
          <ReservationForm target={{ spotId: spot.id, name: spot.name }} defaultName={member.displayName} nextPath={`/book/spot/${spot.id}`} />
        </>
      )}
      <p className="mt-6 text-xs">
        <Link href={path} className="text-sea hover:underline">
          ← {spot.name} 페이지로
        </Link>
      </p>
    </div>
  );
}
