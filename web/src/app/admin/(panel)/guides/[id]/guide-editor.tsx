"use client";

import { useActionState } from "react";
import { saveGuideAction, type ActionState } from "../../../actions";

interface GuideValues {
  id: number;
  title: string;
  summary: string | null;
  bodyMd: string;
  role: "hub" | "spoke";
  spokeGroup: string | null;
  status: string;
  medicalAdjacent: boolean;
  vetReviewed: boolean;
  vetReviewerName: string | null;
  vetReviewedAt: string | null;
}

const input = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function GuideEditor({ guide }: { guide: GuideValues }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveGuideAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={guide.id} />

      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="title">제목</label>
        <input id="title" name="title" defaultValue={guide.title} required className={input} />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="summary">요약 (카드·검색결과)</label>
        <input id="summary" name="summary" defaultValue={guide.summary ?? ""} className={input} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="role">구조</label>
          <select id="role" name="role" defaultValue={guide.role} className={input}>
            <option value="spoke">스포크</option>
            <option value="hub">허브</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="spokeGroup">스포크 그룹</label>
          <select id="spokeGroup" name="spokeGroup" defaultValue={guide.spokeGroup ?? ""} className={input}>
            <option value="">없음</option>
            <option value="body">body — 신체 영역</option>
            <option value="support">support — 지지 서비스</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="status">상태</label>
          <select id="status" name="status" defaultValue={guide.status} className={input}>
            <option value="draft">작성 중</option>
            <option value="review_pending">감수 대기</option>
            <option value="published">발행</option>
            <option value="archived">보관</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-1.5 pb-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="medicalAdjacent" defaultChecked={guide.medicalAdjacent} />
            의료 인접
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="vetReviewed" defaultChecked={guide.vetReviewed} />
            감수 완료
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="vetReviewerName">감수 수의사명</label>
          <input id="vetReviewerName" name="vetReviewerName" defaultValue={guide.vetReviewerName ?? ""} placeholder="○○○" className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="vetReviewedAt">감수일</label>
          <input id="vetReviewedAt" name="vetReviewedAt" type="date" defaultValue={guide.vetReviewedAt ?? ""} className={input} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="bodyMd">
          본문 (마크다운 · 임베드는 {"{{youtube:ID|창작자|원본URL}}"} 형식만)
        </label>
        <textarea id="bodyMd" name="bodyMd" rows={24} defaultValue={guide.bodyMd} className={`${input} font-mono text-xs leading-relaxed`} />
      </div>

      {state.error && (
        <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>
      )}
      {state.saved && (
        <p className="rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">저장되었습니다.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
