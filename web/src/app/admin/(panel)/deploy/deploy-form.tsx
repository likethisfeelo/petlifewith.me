"use client";

// 배포 버튼 — dev 는 바로, prod 는 확인 칸에 "prod" 를 입력해야 실행된다.
import { useState } from "react";
import { useKeptForm } from "../../_components/use-kept-form";
import { startDeployAction, type DeployActionState } from "../../deploy-actions";

export function DeployForm({ branch }: { branch: string }) {
  const { state, pending, onSubmit } = useKeptForm<DeployActionState>(startDeployAction, {});
  const [confirm, setConfirm] = useState("");

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">
        브랜치 <code className="rounded bg-sand px-1.5 py-0.5 text-xs">{branch}</code> 의 최신 커밋을 배포합니다. 설치·타입체크·테스트 →
        마이그레이션 → 배포 순서로 10~15분 걸립니다. 진행 중에도 사이트는 이전 버전으로 계속 열립니다.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="stage"
          value="dev"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
        >
          dev 배포
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <input
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="운영 배포하려면 prod 입력"
          autoComplete="off"
          className="w-56 rounded-lg border border-line bg-cream px-3 py-2 text-sm"
        />
        <button
          type="submit"
          name="stage"
          value="prod"
          disabled={pending || confirm.trim() !== "prod"}
          className="rounded-full bg-accent-deep px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-40"
        >
          운영(prod) 배포
        </button>
      </div>

      {pending && <p className="text-sm text-ink-faint">요청 중...</p>}
      {state.error && <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>}
      {state.started && (
        <p className="text-sm text-sea">
          {state.started} 배포를 시작했습니다. 아래 기록에 몇 초 뒤 나타납니다 — 새로고침해서 확인하세요.
        </p>
      )}
    </form>
  );
}
