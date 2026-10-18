"use client";

// 스팟 검색창 — [지역명 검색] [유형] [찾기]. 고르면 목록 SEO 주소(/spot/시도/시군구/유형)로 간다.
// 지역은 시군구 이름·일반구(영통구 → 수원시)·시도로 찾는다 (lib/spot-search.ts). ↑↓·Enter·Esc.
import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RegionTile } from "@/lib/regions";
import { searchSpotRegions, spotSearchHref, type SpotRegionOption } from "@/lib/spot-search";

export function SpotSearchBox({
  tiles,
  types,
  size = "lg",
  placeholder = "지역명 검색 (예: 영통구, 해운대, 강남)",
  defaultType = "",
}: {
  /** 처음 골라 둘 유형 (유형 페이지) */
  defaultType?: string;
  tiles: RegionTile[];
  types: Array<{ slug: string; name: string }>;
  size?: "lg" | "md";
  placeholder?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<SpotRegionOption | null>(null);
  const [type, setType] = useState(defaultType);
  const [hint, setHint] = useState<string | null>(null);
  const options = useMemo(() => searchSpotRegions(tiles, text), [tiles, text]);

  const go = (o: SpotRegionOption | null = picked) => {
    const target = o ?? options[0] ?? null;
    if (!target) {
      setHint("지역을 먼저 골라 주세요.");
      inputRef.current?.focus();
      return;
    }
    router.push(spotSearchHref(target, type || null));
  };

  const choose = (o: SpotRegionOption) => {
    setPicked(o);
    setText(o.label);
    setOpen(false);
    setHint(null);
  };

  const h = size === "lg" ? "h-14 text-base" : "h-11 text-sm";
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="지역 검색"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setText(e.target.value);
            setPicked(null);
            setActive(0);
            setOpen(true);
            setHint(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && options[active] && !picked) {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className={`w-full rounded-xl bg-cream px-4 text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-sea/40 ${h}`}
        />
        {open && options.length > 0 && !picked && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
            {options.map((o, i) => (
              <li
                key={`${o.sidoSlug}-${o.sigunguSlug ?? "all"}-${o.label}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2 text-sm ${i === active ? "bg-sea-soft text-sea" : "text-ink"}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <select aria-label="유형" value={type} onChange={(e) => setType(e.target.value)} className={`rounded-xl bg-cream px-3 text-ink sm:w-44 ${h}`}>
        <option value="">모든 유형</option>
        {types.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" className={`rounded-xl bg-ink px-6 font-bold text-cream hover:opacity-90 ${h}`}>
        찾기
      </button>
      {hint && <p className="px-2 text-xs text-rose-600 sm:hidden">{hint}</p>}
    </form>
  );
}
