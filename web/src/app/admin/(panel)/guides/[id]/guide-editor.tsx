"use client";

import { useActionState, useCallback, useState } from "react";
import { categoriesForTopic } from "@app/data";
import type { UploadPolicy } from "@/lib/settings";
import { BlockEditor } from "@/components/editor/block-editor";
import { TagInput } from "@/components/editor/tag-input";
import { HeroMediaSelect } from "@/components/media/hero-media-select";
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
  curated: boolean;
  curatedOrder: number | null;
  areaOrder: number | null;
  bannerSpotTypes: string[];
  status: string;
  medicalAdjacent: boolean;
  vetReviewed: boolean;
  vetReviewerName: string | null;
  vetReviewedAt: string | null;
  heroImageKey: string | null;
  heroMedia: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageKey: string | null;
}

const input = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";

export function GuideEditor({
  guide,
  topicSlug,
  authorName,
  spotTypes,
  policy,
  tagSuggestions = [],
}: {
  guide: GuideValues;
  topicSlug: string;
  /** 회원 글이면 닉네임 — 승인 흐름 안내에 쓴다 */
  authorName?: string | null;
  /** 상단 디렉토리 배너로 고를 수 있는 공개 스팟 유형 */
  spotTypes: Array<{ slug: string; name: string }>;
  /** 업로드 상한 (관리자: 시스템 상한 + 영상 길이 상한) */
  policy: UploadPolicy;
  tagSuggestions?: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveGuideAction, {});
  const categories = categoriesForTopic(topicSlug);
  // 블록 편집기가 마크다운을 만들어 hidden input 에 싣는다. 대표 영상 목록이 본문을 따라간다
  const [body, setBody] = useState(guide.bodyMd);
  const onBody = useCallback((md: string) => setBody(md), []);

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
          <label className="block text-sm font-medium text-ink" htmlFor="areaOrder">부위 대표 순번</label>
          <select id="areaOrder" name="areaOrder" defaultValue={guide.areaOrder ?? ""} className={input}>
            <option value="">대표 아님</option>
            <option value="1">1번 (맨 위)</option>
            <option value="2">2번</option>
            <option value="3">3번</option>
          </select>
          <p className="mt-1 text-xs text-ink-faint">
            카테고리(위치)를 지정한 발행 글만. 신체 지도 패널과 부위별 게시판 맨 위에 뜹니다. 부위당 3편, 순번은 겹칠 수 없습니다.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-3">
        <p className="text-sm font-medium text-ink">큐레이션 콘텐츠</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          토픽 페이지 맨 위 카드 그리드와 "큐레이션 전체 보기"에 나오는 글입니다. 운영진 글은 기본으로 켜져 있고, 회원 글은 여기서 켜야
          올라갑니다(일반 게시판에는 그대로 남습니다). 순서를 준 글이 먼저, 나머지는 최신순 — 토픽당 순번 하나에 글 하나.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="curated" defaultChecked={guide.curated} />
            큐레이션에 노출
          </label>
          <div>
            <label className="block text-xs font-medium text-ink-soft" htmlFor="curatedOrder">노출 순서</label>
            <select id="curatedOrder" name="curatedOrder" defaultValue={guide.curatedOrder ?? ""} className={input}>
              <option value="">순서 지정 안 함 (최신순)</option>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}번{n === 1 ? " (맨 위)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {spotTypes.length > 0 && (
        <div className="rounded-lg border border-line bg-surface p-3">
          <p className="text-sm font-medium text-ink">상단 디렉토리 배너</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            체크한 스팟 유형이 글 제목 아래 배너로 뜨고, 누르면 그 유형의 디렉토리(업체 찾기·등록)로 갑니다. 3개가 보기 좋습니다.
            게시판이 아니라 업체 정보 입구입니다.
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {spotTypes.map((t) => (
              <label key={t.slug} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name={`banner:${t.slug}`} defaultChecked={guide.bannerSpotTypes.includes(t.slug)} />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}

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
        <p className="block text-sm font-medium text-ink">본문 <span className="font-normal text-ink-faint">— 블록으로 편집합니다. 사진·영상은 버튼이나 끌어다 놓기, 원문은 "마크다운" 버튼</span></p>
        <div className="mt-2">
          <BlockEditor defaultValue={guide.bodyMd} policy={policy} onChange={onBody} disabled={pending} />
        </div>
        <HeroMediaSelect body={body} defaultValue={guide.heroMedia} className="mt-3" />
        <div className="mt-3">
          <TagInput defaultTags={guide.tags} suggestions={tagSuggestions} />
        </div>
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
