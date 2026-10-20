"use client";

// 시도 안의 시·군·구 칩 줄 — 맨 앞 작은 검색창 + 많은 순 상위 칩 + "+N곳 더". 칩은 진짜 링크(SEO).
// 검색은 이름 앞부분·포함·일반구("영통" → 수원시) — lib/spot-search.ts filterAreas
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { filterAreas, type AreaChip } from "@/lib/spot-search";

export function AreaChips({ areas, label = "많은 지역", placeholder, preview = 8 }: { areas: AreaChip[]; label?: string; placeholder: string; preview?: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => [...areas].sort((a, b) => b.count - a.count), [areas]);
  const found = useMemo(() => filterAreas(sorted, q), [sorted, q]);
  const searching = q.trim().length > 0;
  const visible = searching || all ? found : found.slice(0, preview);
  const rest = sorted.length - preview;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (found[0]) router.push(found[0].href);
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-[34px] w-44 rounded-full border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-sea focus:outline-none sm:w-52"
        />
      </form>
      {visible.map((a) => (
        <Link key={a.href} href={a.href} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-sea hover:text-sea">
          {a.name}
          {"via" in a && a.via ? <span className="ml-1 text-xs font-medium text-ink-soft">({a.via as string} 포함)</span> : null}{" "}
          <span className="text-xs font-medium text-ink-faint">{a.count.toLocaleString("ko-KR")}</span>
        </Link>
      ))}
      {searching && found.length === 0 && <span className="text-xs text-ink-faint">맞는 지역이 없어요</span>}
      {!searching && rest > 0 && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="rounded-full px-3 py-1.5 text-sm font-semibold text-sea hover:bg-sea-soft">
          {all ? "접기 ▴" : `+${rest}곳 더 ▾`}
        </button>
      )}
    </nav>
  );
}
