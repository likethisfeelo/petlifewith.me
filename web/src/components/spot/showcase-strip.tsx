// 시도 페이지 맨 위 — 이 지역 등록 업체(상단 노출 → 프리미엄 → 등록) 가로 줄. 업체 장소 페이지로 가는 진짜 링크
import Link from "next/link";
import { assetUrl } from "@/lib/assets";
import { idSlugPath } from "@/lib/format";
import type { ShowcaseSpot } from "@/lib/queries/spot-pages";
import { TIER_LABEL } from "@/lib/spot-pages";

export function ShowcaseStrip({ title, spots }: { title: string; spots: ShowcaseSpot[] }) {
  if (spots.length === 0) return null;
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="mb-2 text-sm font-bold text-ink">{title}</h2>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {spots.map((s) => {
          const img = assetUrl(s.imageKey);
          return (
            <li key={s.id} className="w-56 shrink-0 snap-start">
              <Link
                href={idSlugPath("place", s.id, s.slug)}
                data-track={s.tier === "promoted" ? "promo_click" : "entity_click"}
                data-track-link-area="sido_showcase"
                data-track-entity-type="spot"
                data-track-entity-id={String(s.id)}
                className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-md ${s.tier === "paid" ? "border-ink/40" : "border-line"}`}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" className="aspect-[16/9] w-full bg-sand object-cover" />
                ) : (
                  <span className="flex aspect-[16/9] w-full items-center justify-center bg-sand text-2xl" aria-hidden>
                    🐾
                  </span>
                )}
                <span className="flex flex-1 flex-col p-3">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${s.tier === "promoted" ? "border border-honey/50 bg-honey-soft text-honey" : s.tier === "paid" ? "bg-ink text-cream" : "bg-sage-soft text-sage-deep"}`}
                    >
                      {TIER_LABEL[s.tier]}
                    </span>
                    <span className="truncate text-ink-faint">
                      {s.typeName} · {s.sigunguName}
                    </span>
                  </span>
                  <span className="mt-1.5 block truncate text-sm font-bold text-ink group-hover:underline">{s.name}</span>
                  {s.intro && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{s.intro}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
