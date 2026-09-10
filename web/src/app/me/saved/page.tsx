// 저장한 것 — 종류별 필터. 본인만 본다.
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listSaved } from "@/lib/queries/reactions";
import { REACTION_TARGETS, REACTION_TARGET_LABEL, isReactionTarget } from "@/lib/reactions";

export default async function MeSavedPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const member = (await getCurrentMember())!;
  const { type } = await searchParams;
  const all = await listSaved(member.id);
  const filter = isReactionTarget(type) ? type : null;
  const rows = filter ? all.filter((s) => s.target === filter) : all;
  const counts: Record<string, number> = Object.fromEntries(REACTION_TARGETS.map((t) => [t, all.filter((s) => s.target === t).length]));

  return (
    <div>
      <h2 className="text-lg font-bold text-ink">저장 {all.length > 0 ? `${all.length}개` : ""}</h2>
      <p className="mt-1 text-xs text-ink-faint">게시글·업체·파트너·브랜드·상품·모임 페이지의 &quot;저장&quot;을 누르면 여기에 모입니다. 나만 볼 수 있어요.</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Link href="/me/saved" className={`rounded-full px-3 py-1 font-medium ${!filter ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
          전체
        </Link>
        {REACTION_TARGETS.filter((t) => (counts[t] ?? 0) > 0).map((t) => (
          <Link key={t} href={`/me/saved?type=${t}`} className={`rounded-full px-3 py-1 font-medium ${filter === t ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {REACTION_TARGET_LABEL[t]} {counts[t] ?? 0}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 저장한 것이 없어요.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((s) => (
            <li key={`${s.target}-${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-ink-soft">{REACTION_TARGET_LABEL[s.target]}</span>
              {s.gone ? (
                <span className="text-ink-faint">{s.title}</span>
              ) : (
                <Link href={s.path} className="font-medium text-ink hover:underline">
                  {s.title}
                </Link>
              )}
              {s.sub && <span className="text-xs text-ink-faint">{s.sub}</span>}
              <span className="ml-auto text-xs text-ink-faint">{formatDate(s.savedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
