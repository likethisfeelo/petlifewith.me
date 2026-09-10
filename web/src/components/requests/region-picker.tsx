"use client";

// 공개 요청 폼의 지역 고르기 — 시도 → 시군구. 서울·광역시는 구, 도는 시·군 (regions 테이블 그대로).
// RegionSelect: 하나 고르기 (name 으로 regionId 전송). RegionMultiPicker: 여러 곳 (돌봄 파트너 활동 지역, hidden 에 "1,2,3").
import { useMemo, useState } from "react";
import type { RegionOption } from "@/lib/queries/requests";

export const selectClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

function useSidos(options: RegionOption[]) {
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of options) if (!seen.has(o.sidoSlug)) seen.set(o.sidoSlug, o.sidoName);
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
  }, [options]);
}

export function RegionSelect({
  name,
  options,
  defaultRegionId,
  required,
}: {
  name: string;
  options: RegionOption[];
  defaultRegionId?: number | null;
  required?: boolean;
}) {
  const sidos = useSidos(options);
  const initial = defaultRegionId ? options.find((o) => o.id === defaultRegionId) : undefined;
  const [sido, setSido] = useState<string>(initial?.sidoSlug ?? "");
  const [regionId, setRegionId] = useState<string>(initial ? String(initial.id) : "");
  const sigungus = options.filter((o) => o.sidoSlug === sido);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select
        aria-label="시도"
        value={sido}
        onChange={(e) => {
          setSido(e.target.value);
          setRegionId("");
        }}
        className={selectClass}
      >
        <option value="">시·도 선택</option>
        {sidos.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>
      <select name={name} aria-label="시군구" value={regionId} onChange={(e) => setRegionId(e.target.value)} required={required} className={selectClass} disabled={!sido}>
        <option value="">시·군·구 선택</option>
        {sigungus.map((o) => (
          <option key={o.id} value={o.id}>
            {o.sigunguName}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RegionMultiPicker({
  name,
  options,
  defaultIds = [],
  max,
}: {
  name: string;
  options: RegionOption[];
  defaultIds?: number[];
  max: number;
}) {
  const sidos = useSidos(options);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const [ids, setIds] = useState<number[]>(defaultIds.filter((id) => byId.has(id)).slice(0, max));
  const [sido, setSido] = useState<string>(() => (defaultIds[0] && byId.get(defaultIds[0])?.sidoSlug) || "");
  const [pick, setPick] = useState<string>("");
  const sigungus = options.filter((o) => o.sidoSlug === sido && !ids.includes(o.id));
  const full = ids.length >= max;

  const add = () => {
    const id = Number(pick);
    if (!id || ids.includes(id) || full) return;
    setIds((prev) => [...prev, id]);
    setPick("");
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={ids.join(",")} />
      {ids.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const o = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-1 rounded-full bg-sea-soft px-2.5 py-1 text-xs font-medium text-sea">
                {o ? `${o.sidoName} ${o.sigunguName}` : id}
                <button type="button" aria-label="지역 빼기" onClick={() => setIds((prev) => prev.filter((x) => x !== id))} className="text-sea/70 hover:text-sea">
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select
          aria-label="시도"
          value={sido}
          onChange={(e) => {
            setSido(e.target.value);
            setPick("");
          }}
          className={selectClass}
          disabled={full}
        >
          <option value="">시·도 선택</option>
          {sidos.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="시군구" value={pick} onChange={(e) => setPick(e.target.value)} className={selectClass} disabled={!sido || full}>
          <option value="">시·군·구 선택</option>
          {sigungus.map((o) => (
            <option key={o.id} value={o.id}>
              {o.sigunguName}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={!pick || full} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-sand disabled:opacity-50">
          추가
        </button>
      </div>
      <p className="text-[11px] text-ink-faint">
        {ids.length}/{max}곳 {full ? "· 더 고르려면 하나를 빼세요" : ""}
      </p>
    </div>
  );
}
