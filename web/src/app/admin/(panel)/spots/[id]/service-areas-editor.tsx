"use client";

// 돌봄 파트너의 서비스 지역 — 시도 → 시군구를 골라 추가하고, 지역마다 노출 ON/OFF 를 정한다.
// 행 전체를 JSON 으로 hidden input 하나에 담는다 (rows-editor 와 같은 방식). 저장 시 서버 액션이
// 지역 x 유형 5자리 상한을 검사한다.
import { useMemo, useState } from "react";
import { MAX_EXPOSED_PER_AREA } from "@app/data";

export interface AreaOption {
  id: number;
  sidoName: string;
  sidoSlug: string;
  sigunguName: string;
}

export interface ServiceAreaRow {
  regionId: number;
  exposed: boolean;
}

const selectClass = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-ink";

export function ServiceAreasEditor({
  name,
  options,
  initialRows,
  homeRegionId,
}: {
  name: string;
  options: AreaOption[];
  initialRows: ServiceAreaRow[];
  /** 등록 지역 — 비어 있으면 저장 시 이 지역 하나가 기본으로 들어간다 */
  homeRegionId?: number | "";
}) {
  const [rows, setRows] = useState<ServiceAreaRow[]>(initialRows);
  const sidos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of options) if (!seen.has(o.sidoSlug)) seen.set(o.sidoSlug, o.sidoName);
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
  }, [options]);
  const [sido, setSido] = useState<string>(sidos[0]?.slug ?? "");
  const sigungus = useMemo(() => options.filter((o) => o.sidoSlug === sido), [options, sido]);
  const [regionId, setRegionId] = useState<number | "">("");
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const add = () => {
    if (regionId === "" || rows.some((r) => r.regionId === regionId)) return;
    setRows((prev) => [...prev, { regionId, exposed: true }]);
    setRegionId("");
  };
  const toggle = (i: number) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, exposed: !r.exposed } : r)));
  const remove = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div>
        <p className="text-sm font-medium text-ink">서비스 지역 · 노출</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          돌봄 파트너는 주소 대신 활동 지역(시군구)으로 노출됩니다. 지역마다 유형당 {MAX_EXPOSED_PER_AREA}자리 — 자리가 찬 지역은 노출을 켤 수
          없습니다. 순서는 그 지역 목록의 자리 순서입니다.
          {homeRegionId !== undefined && homeRegionId !== "" && rows.length === 0 && " 비워 두면 등록 지역 하나가 노출 ON 으로 들어갑니다."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="시도" value={sido} onChange={(e) => { setSido(e.target.value); setRegionId(""); }} className={selectClass}>
          {sidos.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="시군구" value={regionId} onChange={(e) => setRegionId(e.target.value ? Number(e.target.value) : "")} className={selectClass}>
          <option value="">시군구 선택</option>
          {sigungus.map((o) => (
            <option key={o.id} value={o.id} disabled={rows.some((r) => r.regionId === o.id)}>
              {o.sigunguName}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={regionId === ""} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
          지역 추가
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-faint">추가된 서비스 지역이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {rows.map((r, i) => {
            const o = byId.get(r.regionId);
            return (
              <li key={r.regionId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="w-6 text-xs text-ink-faint">{i + 1}</span>
                <span className="min-w-0 flex-1 text-ink">{o ? `${o.sidoName} ${o.sigunguName}` : `지역 #${r.regionId}`}</span>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={r.exposed}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.exposed ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-soft"}`}
                >
                  {r.exposed ? "노출 ON" : "노출 OFF"}
                </button>
                <span className="flex items-center gap-1 text-xs text-ink-faint">
                  <button type="button" onClick={() => move(i, -1)} aria-label="위로" className="rounded px-1 hover:bg-sand">↑</button>
                  <button type="button" onClick={() => move(i, 1)} aria-label="아래로" className="rounded px-1 hover:bg-sand">↓</button>
                  <button type="button" onClick={() => remove(i)} aria-label="삭제" className="rounded px-1 hover:bg-sand hover:text-accent-deep">✕</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
