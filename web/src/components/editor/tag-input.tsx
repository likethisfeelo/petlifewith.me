"use client";

// 태그 입력 — 칩 + 입력칸. Enter·쉼표·공백으로 추가, 백스페이스로 마지막 칩 삭제. 값은 hidden input 에 쉼표로 이어 보낸다.
// 정규화(소문자·공백 없음·30자)는 lib/tags.ts. 본문의 #태그 는 저장 때 서버가 합친다.
import { useId, useState } from "react";
import { MAX_TAGS, normalizeTag } from "@/lib/tags";

export function TagInput({
  name = "tags",
  defaultTags,
  suggestions = [],
  label = "태그",
  hint,
}: {
  name?: string;
  defaultTags: string[];
  /** 많이 쓰인 태그 (추천) */
  suggestions?: string[];
  label?: string;
  hint?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  const add = (raw: string) => {
    const pieces = raw.split(/[,\s]+/).filter(Boolean);
    if (pieces.length === 0) return;
    setTags((cur) => {
      const next = [...cur];
      for (const piece of pieces) {
        const t = normalizeTag(piece);
        if (!t) {
          setNote("태그는 글자·숫자·_·- 만 쓸 수 있고 글자가 하나는 있어야 합니다.");
          continue;
        }
        if (next.length >= MAX_TAGS) {
          setNote(`태그는 ${MAX_TAGS}개까지입니다.`);
          break;
        }
        if (!next.includes(t)) next.push(t);
      }
      return next;
    });
    setDraft("");
  };
  const remove = (t: string) => setTags((cur) => cur.filter((x) => x !== t));
  const available = suggestions.filter((s) => !tags.includes(s));

  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={`${listId}-input`}>
        {label} <span className="font-normal text-ink-faint">— 글과 별도로 붙는 키워드. 본문에 #태그 로 써도 같이 붙습니다</span>
      </label>
      <input type="hidden" name={name} value={tags.join(",")} />
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-ink">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
            #{t}
            <button type="button" onClick={() => remove(t)} aria-label={`${t} 태그 삭제`} className="text-ink-faint hover:text-ink">
              ×
            </button>
          </span>
        ))}
        <input
          id={`${listId}-input`}
          list={`${listId}-list`}
          value={draft}
          onChange={(e) => {
            setNote(null);
            const v = e.target.value;
            if (/[,\s]$/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              setTags((cur) => cur.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={tags.length === 0 ? "예: 노즈워크, 실내놀이 (쉼표·Enter 로 추가)" : ""}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          autoComplete="off"
        />
        <datalist id={`${listId}-list`}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {available.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
          <span className="text-ink-faint">추천:</span>
          {available.slice(0, 12).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-2 py-0.5 text-ink-soft hover:bg-sand hover:text-ink">
              #{s}
            </button>
          ))}
        </div>
      )}
      {(note || hint) && <p className={`mt-1 text-xs ${note ? "text-accent-deep" : "text-ink-faint"}`}>{note ?? hint}</p>}
    </div>
  );
}
