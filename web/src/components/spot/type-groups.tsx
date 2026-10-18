// 유형 묶음 카드 (서버) — 스팟 첫 화면·시도 페이지. 목적별로 묶어 17개 칩 나열을 줄인다.
import Link from "next/link";
import { groupTypes } from "@/lib/spot-search";

const ICON: Record<string, string> = {
  playground: "🌳", pool: "🏊", rehab: "🦮", cafe: "☕", grooming: "✂️", "self-wash": "🛁", "visiting-bath": "🚿", "visiting-groom": "💇",
  boarding: "🏠", "pet-sitter": "🧑", "hourly-sitter": "⏱️", "dog-walk": "🐕", transport: "🚗", memorial: "🕊️", pharmacy: "💊",
};

export function TypeGroups({
  types,
  counts,
  hrefFor,
  unitFor,
  gridClass = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  gridClass?: string;
  types: Array<{ slug: string; name: string; monetizable: boolean }>;
  counts: Map<string, number>;
  hrefFor: (slug: string) => string;
  unitFor?: (slug: string) => string;
}) {
  const { groups, facts } = groupTypes(types);
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${gridClass}`}>
        {groups.map((g) => (
          <section key={g.key} className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-sm font-bold text-ink">
              {g.title} {g.hint && <span className="ml-1 text-xs font-normal text-ink-faint">{g.hint}</span>}
            </h3>
            <ul className="mt-3 space-y-1">
              {g.types.map((t) => {
                const n = counts.get(t.slug) ?? 0;
                return (
                  <li key={t.slug}>
                    <Link href={hrefFor(t.slug)} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-sand">
                      <span>
                        <span aria-hidden className="mr-2">{ICON[t.slug] ?? "📍"}</span>
                        {t.name}
                      </span>
                      <span className={`text-xs ${n > 0 ? "text-ink-soft" : "text-ink-faint"}`}>{n > 0 ? `${n.toLocaleString("ko-KR")}${unitFor?.(t.slug) ?? "곳"}` : "준비 중"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {facts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-sand/60 px-4 py-3 text-sm">
          <span className="font-semibold text-ink">사실 정보</span>
          <span className="text-xs text-ink-faint">광고·순위 없이 인허가 정보만</span>
          {facts.map((t) => (
            <Link key={t.slug} href={hrefFor(t.slug)} className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink">
              {ICON[t.slug] ?? ""} {t.name} {(counts.get(t.slug) ?? 0) > 0 && <span className="opacity-60">{(counts.get(t.slug) ?? 0).toLocaleString("ko-KR")}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
