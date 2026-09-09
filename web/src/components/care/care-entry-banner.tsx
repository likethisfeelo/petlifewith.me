// 토픽 페이지 하단 돌봄 서비스 입구 — 두 줄: "직접 강아지와 함께 방문해요" / "집으로 오거나 집 근처에서".
// 각 항목은 스팟 유형 디렉토리(/spot/type/[slug])로 간다. 커뮤니티 게시판이 아니라 업체·파트너 검색 입구다.
// 유치원·데이케어는 같은 인허가 유형(동물위탁관리업 → boarding)이라 목적지가 같고, 문구만 다르다.
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
  heading: string;
  sub: string;
  items: EntryItem[];
}

const GROUPS: EntryGroup[] = [
  {
    heading: "직접 강아지와 함께 방문해요",
    sub: "아이를 데리고 가서 맡기는 곳",
    items: [
      { key: "kindergarten", label: "유치원", typeSlug: "boarding", icon: "boarding", blurb: "정기 등원 · 낮 시간 프로그램" },
      { key: "daycare", label: "데이케어", typeSlug: "boarding", icon: "daycare", blurb: "당일 맡김 · 조용한 휴식 위주" },
      { key: "hourly-sitter", label: "시간제 시터", typeSlug: "hourly-sitter", icon: "hourly-sitter", blurb: "주인 집으로 와서 시간 단위로 봐주는 사람", isNew: true },
    ],
  },
  {
    heading: "집으로 오거나 집 근처에서",
    sub: "아이는 익숙한 곳에 두고, 사람이 움직이는 서비스",
    items: [
      { key: "pet-sitter", label: "펫시터", typeSlug: "pet-sitter", icon: "pet-sitter", blurb: "종일·1박 돌봄 · 집 또는 근처 시터 집" },
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
    <section aria-labelledby="care-entry-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="care-entry-heading" className="text-lg font-bold text-ink">
          돌봄 서비스 찾기
        </h2>
        <Link href="/spot" className="text-sm font-medium text-sea hover:underline">
          전체 디렉토리 →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">낮 시간·외출·산책, 상황에 맞는 곳을 지역별로 찾습니다. 순위·평점 없이 등록 정보만 둡니다.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.heading} className="rounded-xl border border-line bg-cream p-4">
            <h3 className="text-base font-bold text-ink">{group.heading}</h3>
            <p className="mt-0.5 text-xs text-ink-faint">{group.sub}</p>
            <ul className="mt-3 space-y-2">
              {group.items
                .filter((item) => available.has(item.typeSlug))
                .map((item) => {
                  const n = countBySlug.get(item.typeSlug) ?? 0;
                  return (
                    <li key={item.key}>
                      <Link
                        href={`/spot/type/${item.typeSlug}`}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-shadow hover:border-sea/50 hover:shadow-md"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sea-soft text-sea">
                          <SpotTypeIcon slug={item.icon} className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink group-hover:underline">
                            {item.label}
                            {item.isNew && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">신설</span>}
                            <span className="text-xs font-medium text-ink-faint">{n > 0 ? `전국 ${n.toLocaleString("ko-KR")}곳` : "등록 받는 중"}</span>
                          </span>
                          <span className="block text-xs text-ink-soft">{item.blurb}</span>
                        </span>
                        <span className="text-sm text-sea" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
