// 펫모임 허브 — 좌측 지역 지도(배지 = 열린 모임 수), 우측 패널.
// 비회원: 지역을 고르면 "모임 n개 · m명 참여 중" 집계만. 회원: 내 지역 모임·참여 중인 모임·지역별 목록·모임 만들기.
// 회원 전용 화면이라 색인하지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MeetupCard } from "@/components/meetup/meetup-card";
import { MeetupMapShell } from "@/components/meetup/meetup-map-shell";
import { MyRegionsForm } from "@/components/meetup/my-regions-form";
import { getCurrentMember } from "@/lib/member";
import { MEETUP_LIMITS, regionSummaryText } from "@/lib/meetups";
import { getUserRegions, listMeetupCountsByRegion, listMeetupsForUser, listMeetupsInRegion } from "@/lib/queries/meetups";
import { listRegionOptions } from "@/lib/queries/requests";
import { listRegionTiles } from "@/lib/queries/spots";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "펫모임 — 내 지역에서 함께 놀기",
  robots: robotsMeta(false),
};

interface Props {
  searchParams: Promise<{ region?: string }>;
}

export default async function MeetupHubPage({ searchParams }: Props) {
  const { region: regionParam } = await searchParams;
  const regionId = Number(regionParam);
  const [regions, counts, member] = await Promise.all([listRegionTiles(), listMeetupCountsByRegion(), getCurrentMember()]);
  const selected = Number.isSafeInteger(regionId) && regionId > 0 ? (regions.find((r) => r.id === regionId) ?? null) : null;
  const countsByRegion: Record<number, number> = Object.fromEntries(Object.entries(counts).map(([id, c]) => [id, c.meetups]));

  const mine = member ? await listMeetupsForUser(member.id) : null;
  const [regionMeetups, myRegions, regionOptions] = await Promise.all([
    member && selected ? listMeetupsInRegion(selected.id) : Promise.resolve([]),
    member ? getUserRegions(member.id) : Promise.resolve([]),
    member && (mine?.regionIds.length ?? 0) === 0 ? listRegionOptions() : Promise.resolve([]),
  ]);
  const selectedCounts = selected ? (counts[selected.id] ?? { meetups: 0, participants: 0 }) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "놀이", path: "/topic/play" }, { name: "펫모임", path: "/meetup" }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">펫모임</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            내 지역 {MEETUP_LIMITS.regions}곳을 골라 두면 그 지역의 모임에 참여하거나 직접 모임을 만들 수 있어요. 모임마다 참여 회원만 보는 작은 게시판이 생겨 약속과
            후기를 나눕니다.
          </p>
        </div>
        {member && (
          <Link href="/meetup/new" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:opacity-90">
            + 모임 만들기
          </Link>
        )}
      </div>

      <div className="mt-6">
        <MeetupMapShell regions={regions} countsByRegion={countsByRegion} selectedSido={selected?.sidoSlug ?? null} selectedRegionId={selected?.id ?? null}>
          {selected && selectedCounts ? (
            <section>
              <h2 className="text-lg font-bold text-ink">
                {selected.sidoName} {selected.sigunguName}
              </h2>
              <p className="mt-1 text-sm font-medium text-sea">{regionSummaryText(selectedCounts.meetups, selectedCounts.participants)}</p>
              {member ? (
                <>
                  {regionMeetups.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                      아직 모임이 없어요. {mine?.regionIds.includes(selected.id) ? "첫 모임을 만들어 보세요." : "내 지역에 추가하면 모임을 만들 수 있어요."}
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {regionMeetups.map((m) => (
                        <MeetupCard key={m.id} m={m} showRegion={false} />
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {mine?.regionIds.includes(selected.id) ? (
                      <Link href={`/meetup/new?region=${selected.id}`} className="rounded-full bg-ink px-4 py-1.5 font-medium text-cream hover:opacity-90">
                        + 이 지역에 모임 만들기
                      </Link>
                    ) : (
                      <Link href="/me/meetups" className="rounded-full border border-line bg-surface px-4 py-1.5 font-medium text-ink hover:bg-sand">
                        내 지역에 추가하기 →
                      </Link>
                    )}
                    <Link href="/meetup" className="rounded-full px-3 py-1.5 text-ink-soft hover:text-ink">
                      내 지역 모임으로
                    </Link>
                  </div>
                </>
              ) : (
                <GuestGate />
              )}
            </section>
          ) : member ? (
            <MemberHome regionIds={mine?.regionIds ?? []} myRegions={myRegions} regionOptions={regionOptions} inMyRegions={mine?.inMyRegions ?? []} joined={mine?.joined ?? []} />
          ) : (
            <section>
              <h2 className="text-lg font-bold text-ink">지역을 골라 보세요</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">지도에서 구·시·군을 누르면 그 지역에 모임이 몇 개 있고 몇 명이 참여 중인지 보여 드립니다.</p>
              <GuestGate />
            </section>
          )}
        </MeetupMapShell>
      </div>
    </div>
  );
}

function GuestGate() {
  return (
    <div className="mt-4 rounded-xl border border-line bg-sand/60 p-5 text-sm">
      <p className="font-semibold text-ink">모임 목록과 참여는 회원에게만 열려 있어요</p>
      <p className="mt-1 text-ink-soft">가입은 이메일 하나면 됩니다. 로그인하면 내 지역 {MEETUP_LIMITS.regions}곳의 모임을 보고 참여하거나 직접 만들 수 있어요.</p>
      <div className="mt-3 flex gap-2">
        <Link href="/login?next=%2Fmeetup" className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
          로그인
        </Link>
        <Link href="/signup?next=%2Fmeetup" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink hover:bg-sand">
          가입하기
        </Link>
      </div>
    </div>
  );
}

function MemberHome({
  regionIds,
  myRegions,
  regionOptions,
  inMyRegions,
  joined,
}: {
  regionIds: number[];
  myRegions: Awaited<ReturnType<typeof getUserRegions>>;
  regionOptions: Awaited<ReturnType<typeof listRegionOptions>>;
  inMyRegions: Awaited<ReturnType<typeof listMeetupsInRegion>>;
  joined: Awaited<ReturnType<typeof listMeetupsInRegion>>;
}) {
  const joinedIds = new Set(joined.map((m) => m.id));
  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">내 지역</h2>
          {regionIds.length > 0 && (
            <Link href="/me/meetups" className="text-xs font-medium text-sea hover:underline">
              바꾸기 →
            </Link>
          )}
        </div>
        {regionIds.length === 0 ? (
          <div className="mt-3 rounded-xl border border-line bg-sand/60 p-4">
            <p className="text-sm text-ink-soft">먼저 내 지역을 {MEETUP_LIMITS.regions}곳까지 골라 주세요. 고른 지역의 모임이 여기에 보이고, 모임도 그 지역에서 만들 수 있어요.</p>
            <div className="mt-3">
              <MyRegionsForm regions={regionOptions} current={[]} compact />
            </div>
          </div>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {myRegions.map((r) => (
              <li key={r.id}>
                <Link href={`/meetup?region=${r.id}`} className="rounded-full bg-sea-soft px-3 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white">
                  {r.sidoName} {r.sigunguName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {regionIds.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink">내 지역의 모임</h2>
          {inMyRegions.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
              아직 모임이 없어요.{" "}
              <Link href="/meetup/new" className="font-medium text-sea hover:underline">
                첫 모임을 만들어 보세요 →
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {inMyRegions.map((m) => (
                <MeetupCard key={m.id} m={m} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold text-ink">참여 중인 모임 {joined.length > 0 ? `${joined.length}개` : ""}</h2>
        {joined.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">아직 참여한 모임이 없어요. 지도에서 다른 지역의 모임도 볼 수 있어요.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {joined.filter((m) => joinedIds.has(m.id)).map((m) => (
              <MeetupCard key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
