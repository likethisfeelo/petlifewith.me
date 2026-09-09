// 토픽 페이지 하단 돌봄 서비스 입구 — 섹션 두 개: "직접 강아지와 함께 방문해요" / "집으로 오거나 집 근처에서".
// 각 항목은 스팟 유형 디렉토리(/spot/type/[slug])로 간다. 커뮤니티 게시판이 아니라 업체·파트너 검색 입구다.
// 유치원·데이케어는 같은 인허가 유형(동물위탁관리업 → boarding)이라 목적지가 같고, 문구만 다르다.
// 두 섹션을 가르는 기준은 "누가 이동하나" — 위 섹션은 아이가 가는 곳(시간제 시터는 시터 집에 맡긴다),
// 아래 섹션은 사람이 오는 서비스(펫시터는 보호자 집으로 방문).
import Link from "next/link";
import { isCareType } from "@app/data";
import { countIndexableCareProviders } from "@/lib/queries/care";
import { countIndexableSpotsForType, listSpotTypesBySlugs } from "@/lib/queries/spots";
import { SpotTypeIcon } from "@/components/spot-type-banners";

interface EntryItem {
  key: string;
  label: string;
  typeSlug: string;
  icon: string;
  blurb: string;
  isNew?: boolean;
}

interface EntryGroup {
  id: string;
  heading: string;
  sub: string;
  /** 항목 수에 맞춘 가로 배치 — 모바일은 한 줄에 하나 */
  cols: string;
  items: EntryItem[];
}

const GROUPS: EntryGroup[] = [
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
];

export async function CareEntryBanner() {
  const slugs = [...new Set(GROUPS.flatMap((g) => g.items.map((i) => i.typeSlug)))];
  const types = await listSpotTypesBySlugs(slugs);
  const countBySlug = new Map<string, number>();
  await Promise.all(
    types.map(async (t) => {
      const n = isCareType(t.slug) ? await countIndexableCareProviders(t.id) : await countIndexableSpotsForType(t.id);
      countBySlug.set(t.slug, n);
    }),
  );
  const available = new Set(types.map((t) => t.slug));

  return (
    <div className="space-y-5">
      {GROUPS.map((group, groupIndex) => (
        <section key={group.id} aria-labelledby={group.id} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id={group.id} className="text-xl font-extrabold tracking-tight text-ink">
                {group.heading}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{group.sub}</p>
            </div>
            {groupIndex === 0 && (
              <Link href="/spot" className="text-sm font-medium text-sea hover:underline">
                전체 디렉토리 →
              </Link>
            )}
          </div>

          <div className={`mt-5 grid gap-3 ${group.cols}`}>
            {group.items
              .filter((item) => available.has(item.typeSlug))
              .map((item) => {
                const n = countBySlug.get(item.typeSlug) ?? 0;
                return (
                  <Link
                    key={item.key}
                    href={`/spot/type/${item.typeSlug}`}
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
                        <span className="mt-0.5 block text-xs font-medium text-ink-faint">
                          {n > 0 ? `전국 ${n.toLocaleString("ko-KR")}곳` : "등록 받는 중"}
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 block text-sm leading-relaxed text-ink-soft">{item.blurb}</span>
                    <span className="mt-auto flex items-center justify-end pt-3 text-sm font-semibold text-sea">지역별로 찾기 →</span>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
