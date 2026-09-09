"use client";

// 회원 글쓰기 폼 — 등록(create)·수정(edit) 공용. 승인 규칙을 폼 안에서 미리 알려준다.
// 본문에는 사진·영상 업로드와 유튜브·인스타그램 링크를 툴바로 넣고(숏코드), 대표 영상을 고를 수 있다.
import { useActionState, useEffect, useRef, useState } from "react";
import type { GuideCategoryDef } from "@app/data";
import { createMemberPostAction, updateMemberPostAction, type MemberActionState } from "@/app/member-actions";
import { POST_BODY_MAX, POST_BODY_MIN, POST_SUMMARY_MAX, POST_TITLE_MAX } from "@/lib/member-limits";
import { uploadedKeysIn } from "@/lib/media-ref";
import type { MemberMediaSettings, UploadPolicy } from "@/lib/settings";
import { Field, FormMessage, SubmitButton, TextField, inputClass } from "@/app/admin/_components/fields";
import { HeroMediaSelect } from "@/components/media/hero-media-select";
import { MediaToolbar } from "@/components/media/media-toolbar";

export interface PostFormValues {
  id?: number;
  topicId: number | null;
  category: string | null;
  title: string;
  summary: string | null;
  bodyMd: string;
  heroMedia: string | null;
  status?: string;
}

export function MemberPostForm({
  mode,
  post,
  topics,
  categoriesByTopic,
  policy,
  limits,
}: {
  mode: "create" | "edit";
  post: PostFormValues;
  topics: Array<{ id: number; slug: string; name: string }>;
  categoriesByTopic: Record<string, GuideCategoryDef[]>;
  /** 업로드 상한 (관리자 설정 member_media 반영) */
  policy: UploadPolicy;
  /** 글당 개수 한도·승인 대기 여부 */
  limits: MemberMediaSettings;
}) {
  const action = mode === "create" ? createMemberPostAction : updateMemberPostAction;
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(action, {});
  const [topicId, setTopicId] = useState<number | null>(post.topicId);
  // 카테고리·본문은 제어 컴포넌트 — React 19 는 액션 후 비제어 폼을 초기화하므로 실패해도 값이 남게
  const [category, setCategory] = useState(post.category ?? "");
  const [body, setBody] = useState(post.bodyMd);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const topicSlug = topics.find((t) => t.id === topicId)?.slug ?? "";
  const categories = categoriesByTopic[topicSlug] ?? [];
  const categoryValue = categories.some((c) => c.slug === category) ? category : "";
  // 액션이 끝나 폼이 초기화된 뒤에도 select 의 DOM 값을 상태와 다시 맞춘다
  const categoryRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (categoryRef.current && categoryRef.current.value !== categoryValue) categoryRef.current.value = categoryValue;
  }, [state, categoryValue]);

  const counts = uploadedKeysIn(body);
  const countHint = [
    limits.maxImagesPerPost > 0 ? `사진 ${counts.images.length}/${limits.maxImagesPerPost}장` : null,
    limits.maxVideosPerPost > 0 ? `영상 ${counts.videos.length}/${limits.maxVideosPerPost}개` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
          마크다운을 쓸 수 있습니다 (## 소제목, - 목록, **강조**, [링크](https://…)). 사진·영상은 아래 버튼으로 올리면 커서 자리에 들어갑니다.
          {countHint ? ` 이 글: ${countHint}.` : ""}
        </p>
        <div className="mt-3">
          <MediaToolbar policy={policy} textareaRef={bodyRef} value={body} onChange={setBody} disabled={pending} />
        </div>
        <textarea
          ref={bodyRef}
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
        <HeroMediaSelect body={body} defaultValue={state.values?.heroMedia ?? post.heroMedia} className="mt-3" />
      </section>

      <div className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-xs leading-relaxed text-sage-deep">
        <p className="font-semibold">{limits.requireApproval ? "승인 기준" : "게시 기준"}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>직접 겪은 이야기와 관찰한 변화를 씁니다. &quot;이 병에는 이 약&quot; 같은 진단·처방 단정은 승인되지 않습니다.</li>
          <li>특정 병원·상품·업체를 홍보하는 글, 연락처·주소 같은 개인정보가 들어간 글은 승인되지 않습니다.</li>
          <li>사진·영상은 직접 찍은 것만 올립니다. 남의 영상은 유튜브·인스타그램 링크로 넣고 창작자를 표기합니다.</li>
          <li>
            {limits.requireApproval
              ? mode === "edit" && post.status === "published"
                ? "발행된 글을 고치면 다시 승인 대기로 바뀝니다."
                : "저장하면 관리자 확인 후 공개됩니다."
              : "저장하면 바로 공개됩니다. 기준에 어긋난 글은 운영진이 내릴 수 있습니다."}
          </li>
        </ul>
      </div>

      <FormMessage error={state.error} saved={state.saved} />
      {state.notice && <p className="rounded-lg border border-honey/30 bg-honey-soft px-3 py-2 text-sm text-honey">{state.notice}</p>}
      <SubmitButton pending={pending} label={mode === "create" ? (limits.requireApproval ? "승인 요청 (저장)" : "게시") : "수정 저장"} pendingLabel="저장 중..." />
    </form>
  );
}
