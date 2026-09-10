// 모임 만들기 — 회원 전용. 내 지역이 없으면 먼저 고르게 한다.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MeetupForm } from "@/components/meetup/meetup-form";
import { MyRegionsForm } from "@/components/meetup/my-regions-form";
import { requireMember } from "@/lib/member";
import { MEETUP_LIMITS } from "@/lib/meetups";
import { getUserRegions } from "@/lib/queries/meetups";
import { listRegionOptions } from "@/lib/queries/requests";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모임 만들기 — 펫모임",
  robots: robotsMeta(false),
};

interface Props {
  searchParams: Promise<{ region?: string }>;
}

export default async function MeetupNewPage({ searchParams }: Props) {
  const member = await requireMember("/meetup/new");
  const { region } = await searchParams;
  const myRegions = await getUserRegions(member.id);
  const regionId = Number(region);
  const defaultRegion = myRegions.find((r) => r.id === regionId)?.id ?? myRegions[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "펫모임", path: "/meetup" }, { name: "모임 만들기", path: "/meetup/new" }]} />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">모임 만들기</h1>
      <p className="mt-2 text-sm text-ink-soft">승인 없이 바로 열립니다. 주최자는 참여 회원과 게시판에서 약속을 잡고, 언제든 마감할 수 있어요.</p>

      {myRegions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-sand/60 p-5">
          <p className="text-sm font-semibold text-ink">먼저 내 지역을 골라 주세요</p>
          <p className="mt-1 text-sm text-ink-soft">모임은 내 지역({MEETUP_LIMITS.regions}곳까지)에서만 만들 수 있어요. 저장한 뒤 이 페이지를 새로 고치면 폼이 열립니다.</p>
          <div className="mt-3">
            <MyRegionsForm regions={await listRegionOptions()} current={[]} compact />
          </div>
          <p className="mt-3 text-xs">
            <Link href="/meetup/new" className="font-medium text-sea hover:underline">
              지역을 저장했어요 → 폼 열기
            </Link>
          </p>
        </div>
      ) : (
        <MeetupForm mode="create" regions={myRegions} initial={{ title: "", regionId: defaultRegion, descriptionMd: null, placeText: null, meetingAt: null, capacity: null }} />
      )}
    </div>
  );
}
