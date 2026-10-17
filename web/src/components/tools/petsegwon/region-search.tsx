"use client";

// 지역 검색창 — 키워드를 치면 가장 작은 단위(시군구)부터 목록이 뜨고, 골라서 바로 분석한다 (lib/petsegwon/stats.ts searchRegions).
// 접근성: combobox + listbox, ↑↓ 로 이동, Enter 로 선택, Esc 로 닫기.
import { useId, useMemo, useRef, useState } from "react";
import { searchRegions, type PetsegwonStats, type RegionOption } from "@/lib/petsegwon/stats";

export function RegionSearch({
  stats,
  value,
  onSelect,
  className,
}: {
  stats: PetsegwonStats;
  /** 지금 고른 지역 표시 (예: 서울 강남구) */
  value: string;
  onSelect: (o: RegionOption) => void;
  className: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const options = useMemo(() => searchRegions(stats, text), [stats, text]);
  const hasSigungu = stats.sigungu.length > 0;

  const choose = (o: RegionOption) => {
    onSelect(o);
    setText("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="지역 검색"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // 닫혀 있을 때는 고른 지역을, 열면 입력한 키워드를 보여 준다
        value={open ? text : value}
        placeholder={hasSigungu ? "시군구 이름 입력 (예: 강남, 수원, 여수)" : "시·도 이름 입력"}
        onFocus={() => {
          setText("");
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const o = options[active];
            if (open && o) choose(o);
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className={`${className} pr-10`}
      />
      <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-ink-faint">
        ⌕
      </span>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="지역 검색 결과"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-xl"
        >
          {options.length === 0 && <li className="px-4 py-3 text-sm text-ink-faint">&ldquo;{text}&rdquo; 지역이 없습니다.</li>}
          {options.map((o, i) => (
            <li
              key={`${o.sido}|${o.sigungu}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // 누르는 동안 입력창이 먼저 닫히지 않게
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`cursor-pointer px-4 py-2.5 text-sm ${i === active ? "bg-sand" : ""} ${o.sigungu ? "font-semibold text-ink" : "text-ink-soft"}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
