// 모임·내 지역 — 내 지역(최대 3곳) 고르기 + 참여 중인 모임
import Link from "next/link";
import { MeetupCard } from "@/components/meetup/meetup-card";
import { MyRegionsForm } from "@/components/meetup/my-regions-form";
import { getCurrentMember } from "@/lib/member";
import { MEETUP_LIMITS } from "@/lib/meetups";
import { listMeetupsForUser } from "@/lib/queries/meetups";
import { listRegionOptions } from "@/lib/queries/requests";

export default async function MeMeetupsPage() {
  const member = (await getCurrentMember())!;
  const [mine, regionOptions] = await Promise.all([listMeetupsForUser(member.id), listRegionOptions()]);
  return (
    <div className="space-y-8">
      <section id="regions" className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">내 지역 (펫모임, 최대 {MEETUP_LIMITS.regions}곳)</h2>
          <Link href="/meetup" className="text-xs font-medium text-sea hover:underline">
            펫모임으로 →
          </Link>
        </div>
        <div className="mt-3">
          <MyRegionsForm regions={regionOptions} current={mine.regionIds} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold text-ink">참여 중인 모임 {mine.joined.length > 0 ? `${mine.joined.length}개` : ""}</h2>
        {mine.joined.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            아직 참여한 모임이 없어요.{" "}
            <Link href="/meetup" className="font-medium text-sea hover:underline">
              내 지역의 모임 보기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.joined.map((m) => (
              <MeetupCard key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
