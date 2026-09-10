// 토픽 페이지 하단 디렉토리 입구 배너 — 섹션 두 개, 섹션마다 큰 카드 버튼이 가로로.
// 노견생활: "직접 강아지와 함께 방문해요" / "집으로 오거나 집 근처에서" (돌봄 서비스).
// 놀이: "함께 가서 놀아요" (수영장·운동장·카페) / "사람과 함께" (펫시터·펫산책·펫모임).
// 각 항목은 스팟 유형 디렉토리(/spot/type/[slug])로 가고, 펫모임처럼 디렉토리가 아닌 항목은 href 를 따로 준다.
// 커뮤니티 게시판이 아니라 업체·파트너·모임 검색 입구다. 유치원·데이케어는 같은 인허가 유형(boarding)이라 목적지가 같다.
import Link from "next/link";
import { isCareType } from "@app/data";
import { countIndexableCareProviders } from "@/lib/queries/care";
import { countPublishedExpertsByKind } from "@/lib/queries/experts";
import { countOpenMeetups } from "@/lib/queries/meetups";
import { countIndexableSpotsForType, listSpotTypesBySlugs } from "@/lib/queries/spots";
import { SpotTypeIcon } from "@/components/spot-type-banners";

interface EntryItem {
  key: string;
  label: string;
  /** 스팟 유형 — 있으면 /spot/type/[slug] 로 가고 등록 수를 센다 */
  typeSlug?: string;
  /** 상담 전문가 종류 — 공개 전문가 수를 상태 문구로 */
  expertKind?: string;
  /** 디렉토리가 아닌 목적지 (예: 펫모임 /meetup) */
  href?: string;
  /** typeSlug 가 없을 때 수 자리에 보여 줄 문구 */
  status?: string;
  icon: string;
  blurb: string;
  isNew?: boolean;
  cta?: string;
}

interface EntryGroup {
  id: string;
  heading: string;
  sub: string;
  /** 항목 수에 맞춘 가로 배치 — 모바일은 한 줄에 하나 */
  cols: string;
  items: EntryItem[];
}

const SENIOR_GROUPS: EntryGroup[] = [
  {
    id: "care-entry-visit",
    heading: "직접 강아지와 함께 방문해요",
    sub: "아이를 데리고 가서 맡기는 곳",
    cols: "sm:grid-cols-3",
    items: [
      { key: "kindergarten", label: "유치원", typeSlug: "boarding", icon: "boarding", blurb: "정기 등원 · 낮 시간 프로그램" },
      { key: "daycare", label: "데이케어", typeSlug: "boarding", icon: "daycare", blurb: "당일 맡김 · 조용한 휴식 위주" },
      { key: "hourly-sitter", label: "시간제 시터", typeSlug: "hourly-sitter", icon: "hourly-sitter", blurb: "시터 집에 맡기는 시간 단위 돌봄", isNew: true },
    ],
  },
  {
    id: "care-entry-home",
    heading: "집으로 오거나 집 근처에서",
    sub: "아이는 익숙한 곳에 두고, 사람이 움직이는 서비스",
    cols: "sm:grid-cols-2",
    items: [
      { key: "pet-sitter", label: "펫시터", typeSlug: "pet-sitter", icon: "pet-sitter", blurb: "집으로 와서 돌보는 방문 돌봄" },
      { key: "dog-walk", label: "산책", typeSlug: "dog-walk", icon: "dog-walk", blurb: "산책 대행·동행 · 노견 맞춤 코스" },
    ],
  },
  {
    id: "care-entry-consult",
    heading: "노견 생활 상담하기",
    sub: "온라인으로 묻고 답하는 생활 상담 — 진단·처방이 아닌 일상의 이야기",
    cols: "sm:grid-cols-4",
    items: [
      { key: "consult-trainer", label: "훈련사", href: "/consult?kind=trainer", expertKind: "trainer", icon: "consult", blurb: "행동·훈련·산책·분리불안 온라인 상담", cta: "상담 보기 →" },
      { key: "consult-vet", label: "수의사", href: "/consult?kind=vet", expertKind: "vet", icon: "consult", blurb: "돌봄 루틴·식이·생활 관리 — 생활 상담", cta: "상담 보기 →" },
      { key: "consult-vet-tech", label: "수의 테크니션", href: "/consult?kind=vet_tech", expertKind: "vet_tech", icon: "consult", blurb: "투약·간호·재활 보조 등 집에서의 돌봄", cta: "상담 보기 →" },
      { key: "consult-mentor", label: "멘토", href: "/consult?kind=mentor", expertKind: "mentor", icon: "consult", blurb: "먼저 노견을 돌본 보호자의 경험", cta: "상담 보기 →", isNew: true },
    ],
  },
];

const PLAY_GROUPS: EntryGroup[] = [
  {
    id: "play-entry-go",
    heading: "함께 가서 놀아요",
    sub: "아이와 같이 가는 곳",
    cols: "sm:grid-cols-3",
    items: [
      { key: "pool", label: "수영장", typeSlug: "pool", icon: "pool", blurb: "실내·야외 반려견 수영장 · 물놀이" },
      { key: "playground", label: "운동장", typeSlug: "playground", icon: "playground", blurb: "놀이터 · 넓은 마당 · 마음껏 뛰는 곳" },
      { key: "cafe", label: "카페", typeSlug: "cafe", icon: "cafe", blurb: "반려동물 동반 카페 · 실내 놀이 공간" },
    ],
  },
  {
    id: "play-entry-people",
    heading: "사람과 함께",
    sub: "돌봐 주고, 걸어 주고, 같이 모이는",
    cols: "sm:grid-cols-3",
    items: [
      { key: "pet-sitter", label: "펫시터", typeSlug: "pet-sitter", icon: "pet-sitter", blurb: "집으로 와서 돌보는 방문 돌봄" },
      { key: "dog-walk", label: "펫산책", typeSlug: "dog-walk", icon: "dog-walk", blurb: "산책 대행·동행 · 산책 친구" },
      { key: "meetup", label: "펫모임", href: "/meetup", icon: "meetup", blurb: "내 지역 3곳에서 모임에 참여하거나 직접 만들기", isNew: true, cta: "모임 보기 →" },
    ],
  },
];

async function EntryBanner({ groups, directoryHref = "/spot" }: { groups: EntryGroup[]; directoryHref?: string }) {
  const slugs = [...new Set(groups.flatMap((g) => g.items.flatMap((i) => (i.typeSlug ? [i.typeSlug] : []))))];
  const types = await listSpotTypesBySlugs(slugs);
  const countBySlug = new Map<string, number>();
  await Promise.all(
    types.map(async (t) => {
      const n = isCareType(t.slug) ? await countIndexableCareProviders(t.id) : await countIndexableSpotsForType(t.id);
      countBySlug.set(t.slug, n);
    }),
  );
  const available = new Set(types.map((t) => t.slug));
  // 펫모임 카드 — 열린 모임 수 (비회원에게도 보이는 집계)
  const meetupTotal = groups.some((g) => g.items.some((i) => i.key === "meetup")) ? await countOpenMeetups() : 0;
  const expertCounts = groups.some((g) => g.items.some((i) => i.expertKind)) ? await countPublishedExpertsByKind() : {};

  return (
    <div className="space-y-5">
      {groups.map((group, groupIndex) => (
        <section key={group.id} aria-labelledby={group.id} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id={group.id} className="text-xl font-extrabold tracking-tight text-ink">
                {group.heading}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{group.sub}</p>
            </div>
            {groupIndex === 0 && (
              <Link href={directoryHref} className="text-sm font-medium text-sea hover:underline">
                전체 디렉토리 →
              </Link>
            )}
          </div>

          <div className={`mt-5 grid gap-3 ${group.cols}`}>
            {group.items
              .filter((item) => !item.typeSlug || available.has(item.typeSlug))
              .map((item) => {
                const n = item.typeSlug ? (countBySlug.get(item.typeSlug) ?? 0) : 0;
                const href = item.href ?? `/spot/type/${item.typeSlug}`;
                const statusText = item.typeSlug
                  ? n > 0
                    ? `전국 ${n.toLocaleString("ko-KR")}곳`
                    : "등록 받는 중"
                  : item.key === "meetup"
                    ? meetupTotal > 0
                      ? `열린 모임 ${meetupTotal.toLocaleString("ko-KR")}개`
                      : "첫 모임을 열어 보세요"
                    : item.expertKind
                      ? (expertCounts[item.expertKind] ?? 0) > 0
                        ? `전문가 ${expertCounts[item.expertKind]}명`
                        : "모집 중"
                      : (item.status ?? "");
                return (
                  <Link
                    key={item.key}
                    href={href}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-cream px-5 py-5 transition-all hover:border-sea/60 hover:bg-surface hover:shadow-md"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sea-soft text-sea transition-colors group-hover:bg-sea group-hover:text-white">
                        <SpotTypeIcon slug={item.icon} className="h-6 w-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-lg font-extrabold text-ink group-hover:underline">{item.label}</span>
                          {item.isNew && (
                            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">신설</span>
                          )}
                        </span>
                        {statusText && <span className="mt-0.5 block text-xs font-medium text-ink-faint">{statusText}</span>}
                      </span>
                    </span>
                    <span className="mt-3 block text-sm leading-relaxed text-ink-soft">{item.blurb}</span>
                    <span className="mt-auto flex items-center justify-end pt-3 text-sm font-semibold text-sea">{item.cta ?? "지역별로 찾기 →"}</span>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 노견생활 하단 — 돌봄 서비스 입구 */
export function CareEntryBanner() {
  return <EntryBanner groups={SENIOR_GROUPS} />;
}

/** 놀이 하단 — 같이 가는 곳 · 사람과 함께 */
export function PlayEntryBanner() {
  return <EntryBanner groups={PLAY_GROUPS} />;
}
