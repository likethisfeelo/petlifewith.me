// 토픽 페이지 하단 디렉토리 입구 배너 — 섹션마다 큰 카드 버튼이 가로로.
// 노견생활: "직접 강아지와 함께 방문해요" / "집으로 오거나 집 근처에서" (돌봄 서비스) / "노견 생활 상담하기" (훈련사·멘토, 지역별)
//          / "운동 및 재활" (장비 보유처 지도 + 치료법 기준 시행처) / "관리·재활 도구" (기기 → 본사 → 대리점 → 체험 가능 업체).
// 놀이: "함께 가서 놀아요" (수영장·운동장·카페) / "사람과 함께" (펫시터·펫산책·펫모임).
// 각 항목은 스팟 유형 디렉토리(/spot/type/[slug])로 가고, 펫모임·상담·기기처럼 디렉토리가 아닌 항목은 href 를 따로 준다.
// 커뮤니티 게시판이 아니라 업체·파트너·모임 검색 입구다. 유치원·데이케어는 같은 인허가 유형(boarding)이라 목적지가 같다.
import Link from "next/link";
import { isCareType } from "@app/data";
import { DEVICE_CATEGORY_BLURB, DEVICE_CATEGORY_LABEL } from "@/lib/devices";
import { countIndexableCareProviders } from "@/lib/queries/care";
import { countPublishedDevicesByCategory } from "@/lib/queries/devices";
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
  /** 기기 분류 — 공개 기기 수를 상태 문구로 ("all" 은 전체) */
  deviceCategory?: string;
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
    sub: "지역에서 활동하는 훈련사와 먼저 노견을 돌본 멘토 — 온라인 상담 시간을 예약하거나 연락을 받습니다",
    cols: "sm:grid-cols-2",
    items: [
      { key: "consult-trainer", label: "훈련사", href: "/consult?kind=trainer", expertKind: "trainer", icon: "consult", blurb: "행동·훈련·산책·분리불안 — 자격을 확인한 훈련사의 온라인 상담", cta: "지역별로 찾기 →" },
      { key: "consult-mentor", label: "멘토", href: "/consult?kind=mentor", expertKind: "mentor", icon: "consult", blurb: "먼저 노견을 돌본 보호자의 경험 — 회원 누구나 멘토로 참여할 수 있습니다", cta: "지역별로 찾기 →", isNew: true },
    ],
  },
  {
    id: "care-entry-rehab",
    heading: "운동 및 재활",
    sub: "관절·근력을 지키는 운동과 재활 — 장비를 갖춘 곳만 지도로, 치료법은 시행처 기준으로",
    cols: "sm:grid-cols-2",
    items: [
      { key: "rehab", label: "운동·재활", typeSlug: "rehab", icon: "rehab", blurb: "수중 러닝머신·밸런스 기구 등 재활·특수 훈련 장비를 갖춘 곳 — 장비를 등록한 곳만 소개", isNew: true },
      { key: "rehab-modality", label: "재활·한방 시행처", href: "/rehab", icon: "rehab-site", status: "치료법 기준 · 광고·순위 없음", blurb: "침치료·한방재활·체외충격파 등 치료법 기준으로, 시행한다고 공개된 동물병원을 지역별 가나다순으로", cta: "치료법으로 찾기 →" },
    ],
  },
  {
    id: "care-entry-device",
    heading: "관리·재활 도구",
    sub: "기기 → 본사 → 대리점 → 지역별 체험 가능 업체까지 한 번에 — 집에서 쓰는 관리 도구부터 재활 장비까지",
    cols: "sm:grid-cols-4",
    items: [
      { key: "device-all", label: "도구 전체", href: "/device", deviceCategory: "all", icon: "device", blurb: "어떤 기기가 있고, 어디서 사고, 어디서 써 볼 수 있는지", cta: "기기 보기 →", isNew: true },
      { key: "device-rehab", label: DEVICE_CATEGORY_LABEL.rehab_equipment, href: "/device?category=rehab_equipment", deviceCategory: "rehab_equipment", icon: "rehab", blurb: DEVICE_CATEGORY_BLURB.rehab_equipment, cta: "기기 보기 →" },
      { key: "device-laser", label: DEVICE_CATEGORY_LABEL.laser, href: "/device?category=laser", deviceCategory: "laser", icon: "device", blurb: DEVICE_CATEGORY_BLURB.laser, cta: "기기 보기 →" },
      { key: "device-monitor", label: DEVICE_CATEGORY_LABEL.monitor, href: "/device?category=monitor", deviceCategory: "monitor", icon: "monitor", blurb: DEVICE_CATEGORY_BLURB.monitor, cta: "기기 보기 →" },
    ],
  },
];

/** 글 하단 전용 — 미용·목욕 (토픽 페이지에는 두지 않는다). 집으로 오는 쪽 / 데리고 가는 쪽 두 묶음. */
const GROOM_GROUPS: EntryGroup[] = [
  {
    id: "care-entry-groom",
    heading: "집으로 오는 미용·목욕",
    sub: "이동이 부담스러운 아이를 위해, 사람과 장비가 집으로 오는 서비스",
    cols: "sm:grid-cols-2",
    items: [
      { key: "visiting-groom", label: "방문미용", typeSlug: "visiting-groom", icon: "visiting-groom", blurb: "집에서 짧게 끝내는 미용 · 노령견 대응 여부를 먼저 확인" },
      { key: "visiting-bath", label: "방문목욕", typeSlug: "visiting-bath", icon: "visiting-bath", blurb: "출장 차량·장비가 오는 목욕 · 이동 부담이 적은 선택지" },
    ],
  },
  {
    id: "care-entry-groom-shop",
    heading: "데리고 가서 하는 미용·목욕",
    sub: "가까운 곳으로 짧게 다녀오거나, 보호자가 직접 씻기는 방법",
    cols: "sm:grid-cols-2",
    items: [
      { key: "grooming", label: "미용·스파", typeSlug: "grooming", icon: "grooming", blurb: "동물미용업 인허가 기준 · 노령견 예약 가능 여부를 확인하세요" },
      { key: "self-wash", label: "셀프목욕", typeSlug: "self-wash", icon: "self-wash", blurb: "보호자가 직접 씻기는 곳 · 계단 없는 욕조·건조 설비를 확인" },
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
  const deviceCounts = groups.some((g) => g.items.some((i) => i.deviceCategory)) ? await countPublishedDevicesByCategory() : {};
  const deviceTotal = Object.values(deviceCounts).reduce((a, b) => a + b, 0);

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
                        ? `${expertCounts[item.expertKind]}명 활동 중`
                        : "모집 중"
                      : item.deviceCategory
                        ? (item.deviceCategory === "all" ? deviceTotal : (deviceCounts[item.deviceCategory] ?? 0)) > 0
                          ? `기기 ${item.deviceCategory === "all" ? deviceTotal : deviceCounts[item.deviceCategory]}개`
                          : "정리 중"
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

// ---------- 글 하단 입구 배너 ----------
// 노견생활 글 아래에 "이 글에서 다룬 서비스를 지역별로" 큰 카드로 잇는다. 두 갈래:
//  · care  — 유치원·데이케어·시간제 시터 / 펫시터·산책
//  · groom — 방문미용·방문목욕
// 어떤 갈래를 붙일지는 ① 글 슬러그 지정 ② 관리자 편집기의 "디렉토리 배너"(guides.banner_spot_types) 순으로 정한다.

export type GuideEntryKind = "care" | "groom";

export const GUIDE_ENTRY_COPY: Record<GuideEntryKind, { heading: string; sub: string }> = {
  care: {
    heading: "돌봄 맡길 곳, 지역별로 찾기",
    sub: "이 글에서 다룬 유형을 지도에서 지역별로 볼 수 있어요. 업체 페이지에서 바로 예약 요청을 보낼 수 있습니다.",
  },
  groom: {
    heading: "미용·목욕할 곳, 지역별로 찾기",
    sub: "집으로 부르는 방법과 데리고 가는 방법을 함께 봅니다. 노령견을 받아 주는 곳인지 먼저 확인하고, 업체 페이지에서 바로 예약 요청을 보낼 수 있어요.",
  },
};

/** 슬러그로 지정하는 글 — 관리자 배너 설정과 무관하게 붙는다 */
const GUIDE_ENTRY_BY_SLUG: Record<string, GuideEntryKind> = {
  "senior-visiting-groom": "groom",
  "senior-visiting-bath": "groom",
};

/** 관리자 "디렉토리 배너"로 고른 스팟 유형 → 갈래 */
const GUIDE_ENTRY_BY_TYPE: Record<string, GuideEntryKind> = {
  boarding: "care",
  "pet-sitter": "care",
  "hourly-sitter": "care",
  "dog-walk": "care",
  "visiting-groom": "groom",
  "visiting-bath": "groom",
  grooming: "groom",
  "self-wash": "groom",
};

/** 이 글 하단에 붙일 입구 갈래 (없으면 null) */
export function guideEntryKind(topicSlug: string, guideSlug: string, bannerSpotTypes: string[]): GuideEntryKind | null {
  if (topicSlug !== "senior-life") return null;
  const bySlug = GUIDE_ENTRY_BY_SLUG[guideSlug];
  if (bySlug) return bySlug;
  for (const slug of bannerSpotTypes) {
    const kind = GUIDE_ENTRY_BY_TYPE[slug];
    if (kind) return kind;
  }
  return null;
}

/** 글 하단 입구 배너 — 토픽 페이지와 같은 카드 디자인, 갈래에 맞는 섹션만 */
export function GuideEntryBanner({ kind }: { kind: GuideEntryKind }) {
  const groups = kind === "groom" ? GROOM_GROUPS : SENIOR_GROUPS.filter((g) => g.id === "care-entry-visit" || g.id === "care-entry-home");
  return <EntryBanner groups={groups} />;
}

/** 놀이 하단 — 같이 가는 곳 · 사람과 함께 */
export function PlayEntryBanner() {
  return <EntryBanner groups={PLAY_GROUPS} />;
}
