"use client";

// 펫세권 분석 통계 — scripts/petsegwon 파이프라인이 만든 out/stats.json 을 올린다 (lib/petsegwon/stats.ts).
// 올리기 전에는 실태조사 시도 값만으로 동작하고, 올리면 시군구 선택이 열린다.
import { FormMessage, SubmitButton } from "../../_components/fields";
import { useKeptForm } from "../../_components/use-kept-form";
import { clearPetsegwonStatsAction, uploadPetsegwonStatsAction, type ActionState } from "../../news-actions";

export interface PetsegwonStatsInfo {
  source: "baseline" | "pipeline";
  generatedAt: string;
  referenceDate: string;
  sigungu: number;
  industries: string[];
}

export function PetsegwonStatsForm({ info }: { info: PetsegwonStatsInfo }) {
  const { state, pending, onSubmit } = useKeptForm<ActionState>(uploadPetsegwonStatsAction, {});
  return (
    <details className="mt-4 rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-bold text-ink">
        펫세권 분석 통계 <span className="ml-1 font-normal text-ink-faint">— 업장 1곳당 반려견 수 도구의 자료</span>
      </summary>
      <div className="mt-3 space-y-3 text-sm text-ink-soft">
        <p>
          지금:{" "}
          {info.source === "pipeline" ? (
            <strong className="text-ink">
              시군구 {info.sigungu}곳 · {info.industries.join("·")} (만든 시각 {info.generatedAt.slice(0, 10)})
            </strong>
          ) : (
            <strong className="text-ink">실태조사 시도 값만 (시군구 선택 없음)</strong>
          )}{" "}
          · 기준일 {info.referenceDate}
        </p>
        <p className="text-xs leading-relaxed">
          PC 의 <code>scripts\petsegwon</code> 에서 <code>.\run.ps1</code> 을 돌린 뒤 <code>out\validation.csv</code> 를 확인하고, <code>out\stats.json</code> 을
          올리세요. 시도·전국 평균은 늘 실태조사 값으로 계산합니다.
        </p>
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
          <input type="file" name="statsFile" accept="application/json,.json" required className="text-xs" />
          <SubmitButton pending={pending} label="stats.json 올리기" />
        </form>
        <FormMessage error={state.error} saved={state.saved} />
        {info.source === "pipeline" && (
          <form
            action={clearPetsegwonStatsAction}
            onSubmit={(e) => {
              if (!window.confirm("올린 시군구 통계를 지우고 실태조사 시도 값만 쓸까요?")) e.preventDefault();
            }}
          >
            <button type="submit" className="text-xs text-ink-faint underline hover:text-ink">
              시군구 통계 지우기
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
