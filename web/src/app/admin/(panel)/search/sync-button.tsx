"use client";

import { useState, useTransition } from "react";
import { startSearchSyncAction, type SearchSyncState } from "../../search-actions";

export function SearchSyncButton({ disabled }: { disabled?: boolean }) {
  const [state, setState] = useState<SearchSyncState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={disabled || pending || state.started}
        onClick={() => start(async () => setState(await startSearchSyncAction()))}
        className="rounded-full border border-ink px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand disabled:opacity-40"
      >
        {pending ? "요청 중..." : state.started ? "가져오는 중" : "지금 가져오기"}
      </button>
      {state.started && <span className="text-xs text-sage-deep">시작했습니다. 처음 16개월치는 몇 분씩 여러 번에 나눠 채워집니다 — 잠시 뒤 새로고침하세요.</span>}
      {state.error && <span className="text-xs text-accent-deep">{state.error}</span>}
    </div>
  );
}
