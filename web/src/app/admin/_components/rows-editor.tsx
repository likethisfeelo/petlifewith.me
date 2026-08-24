"use client";

// 반복행 에디터 — 링크·구매링크·보유처·큐레이션 항목처럼
// "필요한 만큼만 골라서 넣는" 목록을 다루는 공통 컴포넌트.
//
// 행 전체를 JSON 으로 직렬화해 hidden input 하나로 보낸다. 서버 액션은
// parseRows() 로 읽어 전량 교체(delete-all → insert)한다. 행 단위 액션이
// 없으니 추가·삭제·순서 변경이 저장 한 번으로 끝난다.
import { useState } from "react";

export type RowValue = Record<string, string | boolean>;

export interface RowFieldDef {
  key: string;
  label: string;
  type?: "text" | "url" | "select" | "textarea" | "checkbox" | "date";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Tailwind 그리드 span (기본 col-span-3) */
  span?: string;
  rows?: number;
}

const baseInput =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-ink";

export function RowsEditor({
  name,
  title,
  hint,
  fields,
  initialRows,
  emptyRow,
  addLabel = "행 추가",
  emptyHint = "등록된 항목이 없습니다. 필요한 것만 추가하세요.",
}: {
  name: string;
  title: string;
  hint?: string;
  fields: RowFieldDef[];
  initialRows: RowValue[];
  emptyRow: RowValue;
  addLabel?: string;
  emptyHint?: string;
}) {
  const [rows, setRows] = useState<RowValue[]>(initialRows);

  const update = (index: number, key: string, value: string | boolean) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };
  const remove = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index]!;
      const b = next[target]!;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft hover:bg-sand hover:text-ink"
        >
          + {addLabel}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-faint">
          {emptyHint}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="rounded-lg bg-sand/60 p-3">
              <div className="grid grid-cols-12 gap-2">
                {fields.map((f) => {
                  const value = row[f.key];
                  const span = f.span ?? "col-span-3";
                  if (f.type === "select") {
                    return (
                      <div key={f.key} className={span}>
                        <label className="mb-1 block text-[11px] text-ink-faint">{f.label}</label>
                        <select
                          className={baseInput}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => update(i, f.key, e.target.value)}
                        >
                          {(f.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (f.type === "checkbox") {
                    return (
                      <div key={f.key} className={`${span} flex items-end pb-1.5`}>
                        <label className="flex items-center gap-1.5 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={value === true}
                            onChange={(e) => update(i, f.key, e.target.checked)}
                          />
                          {f.label}
                        </label>
                      </div>
                    );
                  }
                  if (f.type === "textarea") {
                    return (
                      <div key={f.key} className={span}>
                        <label className="mb-1 block text-[11px] text-ink-faint">{f.label}</label>
                        <textarea
                          className={baseInput}
                          rows={f.rows ?? 3}
                          placeholder={f.placeholder}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => update(i, f.key, e.target.value)}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className={span}>
                      <label className="mb-1 block text-[11px] text-ink-faint">{f.label}</label>
                      <input
                        type={f.type === "date" ? "date" : "text"}
                        className={baseInput}
                        placeholder={f.placeholder}
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button type="button" onClick={() => move(i, -1)} className="text-ink-faint hover:text-ink" aria-label="위로">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} className="text-ink-faint hover:text-ink" aria-label="아래로">
                  ↓
                </button>
                <button type="button" onClick={() => remove(i)} className="ml-auto text-accent-deep hover:underline">
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input type="hidden" name={name} value={JSON.stringify(rows)} />
    </section>
  );
}
