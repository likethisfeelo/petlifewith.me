"use client";

import { useActionState } from "react";
import { categoriesForTopic } from "@app/data";
import { saveGuideAction, type ActionState } from "../../../actions";
import { SeoFields } from "../../../_components/seo-fields";
import { UploadField } from "../../../_components/upload-field";

interface GuideValues {
  id: number;
  title: string;
  summary: string | null;
  bodyMd: string;
  role: "hub" | "spoke";
  spokeGroup: string | null;
  category: string | null;
  pinnedOrder: number | null;
  status: string;
  medicalAdjacent: boolean;
  vetReviewed: boolean;
  vetReviewerName: string | null;
  vetReviewedAt: string | null;
  heroImageKey: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageKey: string | null;
}

const input = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function GuideEditor({
  guide,
  topicSlug,
  authorName,
}: {
  guide: GuideValues;
  topicSlug: string;
  /** 회원 글이면 닉네임 — 승인 흐름 안내에 쓴다 */
  authorName?: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveGuideAction, {});
  const categories = categoriesForTopic(topicSlug);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={guide.id} />

      {authorName && (
        <p className="rounded-lg border border-honey/30 bg-honey-soft px-3 py-2 text-xs leading-relaxed text-honey">
          <strong>회원 글</strong> — {authorName} 님이 썼습니다. 상태를 <strong>발행</strong>으로 바꾸면 공개됩니다. 진단·처방 단정, 병원·업체 홍보, 개인정보가 있으면
          발행하지 말고 &apos;보관&apos;으로 두세요. 회원이 발행된 글을 고치면 다시 &apos;승인 대기&apos;로 돌아옵니다.
        </p>
      )}

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
            <option value="pending">승인 대기 (회원 글)</option>
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
          <label className="block text-sm font-medium text-ink" htmlFor="category">카테고리 (위치)</label>
          <select id="category" name="category" defaultValue={guide.category ?? ""} className={input}>
            <option value="">전체 (지정 안 함)</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-faint">
            {categories.length > 0 ? "신체 지도의 해당 부위 패널에 관련 글로 뜹니다. 지정하지 않으면 '전체'에만 보입니다." : "이 토픽에는 카테고리가 없어 '전체'에만 보입니다."}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="pinnedOrder">최상단 고정</label>
          <select id="pinnedOrder" name="pinnedOrder" defaultValue={guide.pinnedOrder ?? ""} className={input}>
            <option value="">고정 안 함</option>
            <option value="1">1번 (맨 위)</option>
            <option value="2">2번</option>
            <option value="3">3번</option>
          </select>
          <p className="mt-1 text-xs text-ink-faint">토픽 페이지에서 고정 글이 먼저, 나머지는 최신순. 토픽당 최대 3편, 발행 글만.</p>
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

      <UploadField
        name="heroImageKey"
        label="대표 이미지"
        defaultKey={guide.heroImageKey}
        hint="글 상단과 카드·공유 미리보기에 쓰입니다. 직접 촬영·제작한 이미지만."
      />

      <SeoFields defaults={{ seoTitle: guide.seoTitle, seoDescription: guide.seoDescription, ogImageKey: guide.ogImageKey }} />

      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="bodyMd">
          본문 (마크다운 · 이미지는 {"{{image:키|대체텍스트|캡션}}"} — 미디어 탭에서 업로드 후 복사 · 외부 임베드는 {"{{youtube:ID|창작자|원본URL}}"})
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
