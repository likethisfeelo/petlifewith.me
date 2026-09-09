"use client";

import { useActionState, useCallback, useState } from "react";
import type { UploadPolicy } from "@/lib/settings";
import { BlockEditor } from "@/components/editor/block-editor";
import { TagInput } from "@/components/editor/tag-input";
import { HeroMediaSelect } from "@/components/media/hero-media-select";
import type { GuideCategoryDef } from "@app/data";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_components/fields";
import { createGuideAction, type ActionState } from "../../../actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "작성 중" },
  { value: "review_pending", label: "감수 대기" },
  { value: "published", label: "바로 발행" },
];

const ROLE_OPTIONS = [
  { value: "spoke", label: "스포크 (개별 글)" },
  { value: "hub", label: "허브 (클러스터 전체 지도)" },
];

const SPOKE_GROUP_OPTIONS = [
  { value: "", label: "없음" },
  { value: "body", label: "body — 신체 영역" },
  { value: "support", label: "support — 지지 서비스" },
];

const TEMPLATE = `## 이런 순간이 있었나요

- 
- 

## 무엇을 살펴볼까

## 집에서 확인해볼 수 있는 것

## 도울 수 있는 것

`;

export function NewPostForm({
  topics,
  categoriesByTopic,
  policy,
  tagSuggestions = [],
}: {
  topics: Array<{ id: number; slug: string; name: string }>;
  categoriesByTopic: Record<string, GuideCategoryDef[]>;
  policy: UploadPolicy;
  tagSuggestions?: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createGuideAction, {});
  const [body, setBody] = useState("");
  const onBody = useCallback((md: string) => setBody(md), []);
  const [topicId, setTopicId] = useState<string>("");
  const topicSlug = topics.find((t) => String(t.id) === topicId)?.slug ?? "";
  const categories = categoriesByTopic[topicSlug] ?? [];

  return (
    <form action={formAction} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextField name="title" label="제목" required />
        <TextField
          name="slug"
          label="슬러그 (선택)"
          hint="비우면 제목으로 자동 생성됩니다. URL 은 /guide/[슬러그]. data/content/guides 의 마크다운과 같은 슬러그를 쓰면 시드 재실행 시 본문이 덮어써집니다."
        />
        <TextField name="summary" label="한 줄 요약" hint="카드와 검색결과에 노출됩니다." />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="topicId">
              토픽 (클러스터) <span className="text-accent">*</span>
            </label>
            <select
              id="topicId"
              name="topicId"
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
            >
              <option value="" disabled>
                선택하세요
              </option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <SelectField
            key={topicSlug}
            name="category"
            label="카테고리 (위치)"
            defaultValue=""
            options={[{ value: "", label: "전체 (지정 안 함)" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
            hint={categories.length > 0 ? "신체 지도의 해당 부위에 관련 글로 뜹니다." : "이 토픽은 카테고리 없이 '전체'에 보입니다."}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="role" label="구조" defaultValue="spoke" options={ROLE_OPTIONS} />
          <SelectField name="spokeGroup" label="스포크 그룹" defaultValue="" options={SPOKE_GROUP_OPTIONS} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="status" label="상태" defaultValue="draft" options={STATUS_OPTIONS} />
          <div className="flex items-end pb-2">
            <CheckboxField
              name="medicalAdjacent"
              label="의료 인접 편"
              hint="켜면 수의사 감수 완료 전에는 발행할 수 없습니다."
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">본문</h2>
          <button
            type="button"
            onClick={() => setBody((prev) => (prev.trim() ? prev : TEMPLATE))}
            className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:bg-sand hover:text-ink"
          >
            4단 흐름 뼈대 넣기
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          마크다운으로 씁니다. 사진·영상은 툴바로 올리고, 외부 영상은 유튜브·인스타그램 링크 버튼으로 넣습니다(창작자명·원본 링크가
          없으면 렌더되지 않습니다). 쿠팡 링크를 넣으면 수수료 고지가 자동으로 붙습니다.
        </p>
        <div className="mt-3">
          <BlockEditor defaultValue="" policy={policy} onChange={onBody} disabled={pending} />
        </div>
        <p className="mt-1 text-right text-xs text-ink-faint">{body.length}자</p>
        <HeroMediaSelect body={body} defaultValue={null} className="mt-3" />
        <div className="mt-3">
          <TagInput defaultTags={[]} suggestions={tagSuggestions} />
        </div>
      </section>

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label="게시글 만들기" pendingLabel="만드는 중..." />
      <p className="text-xs text-ink-faint">
        저장하면 편집 화면으로 이동합니다. 상품·스팟·메이커 태깅은 거기서 붙입니다.
      </p>
    </form>
  );
}
