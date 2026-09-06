// 재활·한방·특수치료 시행처 — 치료법 카드 + 시도별 가나다순 목록 (claude.md 6-2)
// 순위·추천·평점·광고 없음. 내부 확인 수준은 쿼리에서 select 되지 않아 여기 도달할 수 없다.
import Link from "next/link";
import { REHAB_MODALITIES, getRehabModality } from "@app/data";
import type { RehabSitePublic } from "@/lib/queries/rehab";
import { SPOT_STATUS_LABEL, formatNumber } from "@/lib/format";

export function ModalityGrid({ counts, current }: { counts: Map<string, number>; current?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {REHAB_MODALITIES.map((m) => {
        const n = counts.get(m.slug) ?? 0;
        const active = m.slug === current;
        return (
          <Link
            key={m.slug}
            href={`/rehab/${m.slug}`}
            className={`group flex h-full flex-col rounded-xl border p-4 transition-shadow hover:shadow-md ${
              active ? "border-sage bg-sage-soft" : "border-line bg-surface"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-ink group-hover:underline">{m.name}</h3>
              <span className="shrink-0 text-xs text-ink-faint">{n > 0 ? `${formatNumber(n)}곳` : "준비 중"}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-soft">{m.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

export function ModalityChips({ slugs, current }: { slugs: string[]; current?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {slugs.map((slug) => {
        const m = getRehabModality(slug);
        if (!m) return null;
        const active = slug === current;
        return (
          <Link
            key={slug}
            href={`/rehab/${slug}`}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              active ? "bg-sage text-white" : "bg-sage-soft text-sage-deep hover:bg-sage hover:text-white"
            }`}
          >
            {m.short}
          </Link>
        );
      })}
    </div>
  );
}

/** 시도 → 시행처 (쿼리가 시도·시군구·이름 가나다순으로 정렬해 준다) */
export function groupBySido(sites: RehabSitePublic[]): Array<{ sidoName: string; sidoSlug: string; items: RehabSitePublic[] }> {
  const groups = new Map<string, { sidoName: string; sidoSlug: string; items: RehabSitePublic[] }>();
  for (const s of sites) {
    const g = groups.get(s.region.sidoSlug) ?? { sidoName: s.region.sidoName, sidoSlug: s.region.sidoSlug, items: [] };
    g.items.push(s);
    groups.set(s.region.sidoSlug, g);
  }
  return [...groups.values()];
}

/** "서울특별시 강동구 길동" → "강동구 길동" (시도는 섹션 제목에 이미 있다) */
function localAddress(site: RehabSitePublic): string {
  const a = site.address?.trim();
  if (!a) return site.region.sigunguName;
  return a.startsWith(site.region.sidoName) ? a.slice(site.region.sidoName.length).trim() || site.region.sigunguName : a;
}

export function RehabSiteList({ sites, current }: { sites: RehabSitePublic[]; current?: string }) {
  const groups = groupBySido(sites);
  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
        아직 확인된 곳이 없습니다. 직접 확인한 곳부터 채워집니다.
      </p>
    );
  }
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.sidoSlug} id={g.sidoSlug}>
          <h3 className="text-base font-bold text-ink">
            {g.sidoName} <span className="text-sm font-medium text-ink-faint">{g.items.length}곳</span>
          </h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {g.items.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-bold text-ink">{s.name}</span>
                  <span className="text-xs text-ink-soft">{localAddress(s)}</span>
                  {s.status !== "operating" && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink-soft">
                      {SPOT_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  )}
                  {s.phone && (
                    <a className="text-xs text-sea hover:underline" href={`tel:${s.phone}`}>
                      {s.phone}
                    </a>
                  )}
                </div>
                <div className="mt-1.5">
                  <ModalityChips slugs={s.modalities} current={current} />
                </div>
                {(s.sourceLabel || s.evidenceNote) && (
                  <p className="mt-1.5 text-xs text-ink-faint">
                    근거: {[s.sourceLabel, s.evidenceNote].filter(Boolean).join(" — ")}
                    {s.verifiedAt ? ` · 기준일 ${s.verifiedAt}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** 시도 앵커 내비 — 긴 목록에서 지역으로 바로 이동 */
export function SidoJump({ sites }: { sites: RehabSitePublic[] }) {
  const groups = groupBySido(sites);
  if (groups.length < 2) return null;
  return (
    <nav aria-label="지역 바로가기" className="flex flex-wrap gap-1.5 text-xs">
      {groups.map((g) => (
        <a key={g.sidoSlug} href={`#${g.sidoSlug}`} className="rounded-full border border-line px-2.5 py-1 text-ink-soft hover:bg-sand hover:text-ink">
          {g.sidoName} {g.items.length}
        </a>
      ))}
    </nav>
  );
}
