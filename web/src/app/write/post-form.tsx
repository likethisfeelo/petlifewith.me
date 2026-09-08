"use client";

// 회원 글쓰기 폼 — 등록(create)·수정(edit) 공용. 승인 규칙을 폼 안에서 미리 알려준다.
import { useActionState, useEffect, useRef, useState } from "react";
import type { GuideCategoryDef } from "@app/data";
import { createMemberPostAction, updateMemberPostAction, type MemberActionState } from "@/app/member-actions";
import { POST_BODY_MAX, POST_BODY_MIN, POST_SUMMARY_MAX, POST_TITLE_MAX } from "@/lib/member-limits";
import { Field, FormMessage, SubmitButton, TextField, inputClass } from "@/app/admin/_components/fields";

export interface PostFormValues {
  id?: number;
  topicId: number | null;
  category: string | null;
  title: string;
  summary: string | null;
  bodyMd: string;
  status?: string;
}

export function MemberPostForm({
  mode,
  post,
  topics,
  categoriesByTopic,
}: {
  mode: "create" | "edit";
  post: PostFormValues;
  topics: Array<{ id: number; slug: string; name: string }>;
  categoriesByTopic: Record<string, GuideCategoryDef[]>;
}) {
  const action = mode === "create" ? createMemberPostAction : updateMemberPostAction;
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(action, {});
  const [topicId, setTopicId] = useState<number | null>(post.topicId);
  // 카테고리·본문은 제어 컴포넌트 — React 19 는 액션 후 비제어 폼을 초기화하므로 실패해도 값이 남게
  const [category, setCategory] = useState(post.category ?? "");
  const [body, setBody] = useState(post.bodyMd);
  const topicSlug = topics.find((t) => t.id === topicId)?.slug ?? "";
  const categories = categoriesByTopic[topicSlug] ?? [];
  const categoryValue = categories.some((c) => c.slug === category) ? category : "";
  // 액션이 끝나 폼이 초기화된 뒤에도 select 의 DOM 값을 상태와 다시 맞춘다
  const categoryRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (categoryRef.current && categoryRef.current.value !== categoryValue) categoryRef.current.value = categoryValue;
  }, [state, categoryValue]);

  return (
    <form action={formAction} className="space-y-5">
      {post.id !== undefined && <input type="hidden" name="id" value={post.id} />}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="topicId">
              주제 <span className="text-accent">*</span>
            </label>
            <select
              id="topicId"
              name="topicId"
              required
              value={topicId ?? ""}
              onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
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
          <Field
            label="카테고리 (위치)"
            htmlFor="category"
            hint={categories.length > 0 ? "해당하는 부위가 있으면 고르세요. 없으면 '전체'에만 보입니다." : "이 주제는 카테고리 없이 '전체'에 보입니다."}
          >
            <select ref={categoryRef} id="category" name="category" value={categoryValue} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">전체 (지정 안 함)</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <TextField name="title" label="제목" defaultValue={state.values?.title ?? post.title} required placeholder={`2~${POST_TITLE_MAX}자`} />
        <TextField name="summary" label="한 줄 요약 (선택)" defaultValue={state.values?.summary ?? post.summary} placeholder={`${POST_SUMMARY_MAX}자 이하`} hint="목록 카드에 보입니다." />
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <label className="block text-sm font-bold text-ink" htmlFor="bodyMd">
          본문
        </label>
        <p className="mt-1 text-xs text-ink-faint">
          마크다운을 쓸 수 있습니다 (## 소제목, - 목록, **강조**, [링크](https://…)). 사진은 아직 회원 글에 넣을 수 없습니다.
        </p>
        <textarea
          id="bodyMd"
          name="bodyMd"
          rows={18}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink"
        />
        <p className="mt-1 text-right text-xs text-ink-faint">
          {body.trim().length.toLocaleString("ko-KR")}자 (최소 {POST_BODY_MIN}자 · 최대 {POST_BODY_MAX.toLocaleString("ko-KR")}자)
        </p>
      </section>

      <div className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-xs leading-relaxed text-sage-deep">
        <p className="font-semibold">승인 기준</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>직접 겪은 이야기와 관찰한 변화를 씁니다. &quot;이 병에는 이 약&quot; 같은 진단·처방 단정은 승인되지 않습니다.</li>
          <li>특정 병원·상품·업체를 홍보하는 글, 연락처·주소 같은 개인정보가 들어간 글은 승인되지 않습니다.</li>
          <li>{mode === "edit" && post.status === "published" ? "발행된 글을 고치면 다시 승인 대기로 바뀝니다." : "저장하면 관리자 확인 후 공개됩니다."}</li>
        </ul>
      </div>

      <FormMessage error={state.error} saved={state.saved} />
      {state.notice && <p className="rounded-lg border border-honey/30 bg-honey-soft px-3 py-2 text-sm text-honey">{state.notice}</p>}
      <SubmitButton pending={pending} label={mode === "create" ? "승인 요청 (저장)" : "수정 저장"} pendingLabel="저장 중..." />
    </form>
  );
}
