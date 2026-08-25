"use client";

// 상품·스팟·메이커 태깅 인터페이스 (기획서 D3) — 개체 단위 연결의 입력부.
import { useActionState, useState } from "react";
import { addGuideTagAction, removeGuideTagAction, type ActionState } from "../../../actions";

export interface TagOption {
  id: number;
  label: string;
}

export interface ExistingTag {
  kind: "item" | "spot" | "maker";
  refId: number;
  label: string;
  contextLabel: string | null;
}

const KIND_LABEL = { item: "상품", spot: "스팟", maker: "메이커" } as const;

export function TagManager({
  guideId,
  existing,
  options,
}: {
  guideId: number;
  existing: ExistingTag[];
  options: Record<"item" | "spot" | "maker", TagOption[]>;
}) {
  const [kind, setKind] = useState<"item" | "spot" | "maker">("item");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addGuideTagAction, {});

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold text-ink">개체 태깅</h2>
      <p className="mt-1 text-xs text-ink-faint">
        본문에 등장한 상품·스팟·메이커를 개체 단위로 연결합니다. 역참조 페이지가 여기서 자동 생성됩니다.
      </p>

      {existing.length > 0 && (
        <ul className="mt-3 space-y-2">
          {existing.map((t) => (
            <li key={`${t.kind}-${t.refId}`} className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2 text-sm">
              <span>
                <span className="mr-2 rounded bg-surface px-1.5 py-0.5 text-xs text-ink-soft">{KIND_LABEL[t.kind]}</span>
                <span className="font-medium text-ink">{t.label}</span>
                {t.contextLabel && <span className="ml-2 text-xs text-ink-faint">{t.contextLabel}</span>}
              </span>
              <form action={removeGuideTagAction}>
                <input type="hidden" name="guideId" value={guideId} />
                <input type="hidden" name="kind" value={t.kind} />
                <input type="hidden" name="refId" value={t.refId} />
                <button type="submit" className="text-xs text-accent-deep hover:underline">제거</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4 grid gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]">
        <input type="hidden" name="guideId" value={guideId} />
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
        >
          <option value="item">상품</option>
          <option value="spot">스팟</option>
          <option value="maker">메이커</option>
        </select>
        <select name="refId" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" defaultValue="">
          <option value="" disabled>
            대상 선택
          </option>
          {options[kind].map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="contextLabel"
          placeholder='맥락 라벨 (예: "본문에서 사용한 매트")'
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
        >
          추가
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-accent-deep">{state.error}</p>}
    </div>
  );
}
