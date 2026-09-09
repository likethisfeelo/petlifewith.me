"use client";

// 회원 글쓰기 폼 — 등록(create)·수정(edit) 공용.
// 흐름: ① 주제 고르기 → ② 카테고리 고르기(주제에 카테고리가 있을 때만) → ③ 편집. 편집 화면 위에 고른 주제·카테고리가 보이고
// "바꾸기"로 돌아갈 수 있다 (편집 중인 내용은 남는다 — 단계 화면은 숨기기만 한다).
// 본문은 블록 편집기(사진·영상 끌어다 놓기, 섬네일, 제목/본문), 태그는 칩 입력, 대표 영상은 본문 영상 가운데 선택.
import { useActionState, useCallback, useState } from "react";
import type { GuideCategoryDef } from "@app/data";
import { createMemberPostAction, updateMemberPostAction, type MemberActionState } from "@/app/member-actions";
import { POST_BODY_MAX, POST_BODY_MIN, POST_SUMMARY_MAX, POST_TITLE_MAX } from "@/lib/member-limits";
import { uploadedKeysIn } from "@/lib/media-ref";
import type { MemberMediaSettings, UploadPolicy } from "@/lib/settings";
import { FormMessage, SubmitButton, TextField } from "@/app/admin/_components/fields";
import { BlockEditor } from "@/components/editor/block-editor";
import { TagInput } from "@/components/editor/tag-input";
import { HeroMediaSelect } from "@/components/media/hero-media-select";

export interface PostFormValues {
  id?: number;
  topicId: number | null;
  category: string | null;
  title: string;
  summary: string | null;
  bodyMd: string;
  heroMedia: string | null;
  tags: string[];
  status?: string;
}

export interface TopicOption {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

type Step = "topic" | "category" | "editor";

export function MemberPostForm({
  mode,
  post,
  topics,
  categoriesByTopic,
  policy,
  limits,
  tagSuggestions = [],
  /** 주소로 카테고리까지 정해져 들어왔는가 (게시판의 글쓰기 버튼) — 그러면 바로 편집 */
  categoryPreset = false,
}: {
  mode: "create" | "edit";
  post: PostFormValues;
  topics: TopicOption[];
  categoriesByTopic: Record<string, GuideCategoryDef[]>;
  policy: UploadPolicy;
  limits: MemberMediaSettings;
  tagSuggestions?: string[];
  categoryPreset?: boolean;
}) {
  const action = mode === "create" ? createMemberPostAction : updateMemberPostAction;
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(action, {});
  const [topicId, setTopicId] = useState<number | null>(post.topicId);
  const [category, setCategory] = useState<string>(post.category ?? "");
  const [body, setBody] = useState(post.bodyMd);
  const onBody = useCallback((md: string) => setBody(md), []);

  const topic = topics.find((t) => t.id === topicId) ?? null;
  const categories = topic ? (categoriesByTopic[topic.slug] ?? []) : [];
  const categoryValue = categories.some((c) => c.slug === category) ? category : "";
  const initialStep = (): Step => {
    if (mode === "edit") return "editor";
    if (!topic) return "topic";
    if (categories.length > 0 && !categoryPreset) return "category";
    return "editor";
  };
  const [step, setStep] = useState<Step>(initialStep);

  const chooseTopic = (t: TopicOption) => {
    setTopicId(t.id);
    const cats = categoriesByTopic[t.slug] ?? [];
    if (cats.length === 0) {
      setCategory("");
      setStep("editor");
    } else setStep("category");
  };
  const chooseCategory = (slug: string) => {
    setCategory(slug);
    setStep("editor");
  };

  const counts = uploadedKeysIn(body);
  const countHint = [
    limits.maxImagesPerPost > 0 ? `사진 ${counts.images.length}/${limits.maxImagesPerPost}장` : null,
    limits.maxVideosPerPost > 0 ? `영상 ${counts.videos.length}/${limits.maxVideosPerPost}개` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const categoryName = categories.find((c) => c.slug === categoryValue)?.name ?? null;

  return (
    <form action={formAction} className="space-y-5">
      {post.id !== undefined && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="topicId" value={topicId ?? ""} />
      <input type="hidden" name="category" value={categoryValue} />

      {/* ① 주제 */}
      <section hidden={step !== "topic"} aria-label="주제 고르기" className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">어느 주제에 올릴까요?</h2>
        <p className="mt-1 text-xs text-ink-faint">글이 올라갈 게시판입니다. 나중에 바꿀 수 있습니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {topics.map((t) => (
            <button key={t.id} type="button" onClick={() => chooseTopic(t)} aria-pressed={t.id === topicId} className={`rounded-xl border p-4 text-left transition-shadow hover:shadow-md ${t.id === topicId ? "border-ink bg-cream" : "border-line bg-surface"}`}>
              <span className="block text-base font-bold text-ink">{t.name}</span>
              {t.description && <span className="mt-1 block text-xs leading-relaxed text-ink-soft">{t.description}</span>}
            </button>
          ))}
        </div>
      </section>

      {/* ② 카테고리 — 주제에 카테고리가 있을 때만 */}
      <section hidden={step !== "category"} aria-label="카테고리 고르기" className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">{topic?.name} · 어느 부위 이야기인가요?</h2>
          <button type="button" onClick={() => setStep("topic")} className="text-xs font-medium text-sea hover:underline">← 주제 바꾸기</button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">고르면 그 부위 게시판과 신체 지도에도 보입니다. 특정 부위가 아니면 아래 "전체"를 누르세요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.slug} type="button" onClick={() => chooseCategory(c.slug)} aria-pressed={c.slug === categoryValue} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${c.slug === categoryValue ? "border-ink bg-ink text-cream" : "border-line bg-surface text-ink-soft hover:bg-sand hover:text-ink"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => chooseCategory("")} className="mt-3 rounded-full border border-dashed border-line px-3.5 py-1.5 text-sm text-ink-soft hover:bg-sand hover:text-ink">
          특정 부위가 아니에요 — 전체에 올리기
        </button>
      </section>

      {/* ③ 편집 */}
      <div hidden={step !== "editor"} className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm">
          <span className="text-ink-faint">주제</span>
          <span className="font-semibold text-ink">{topic?.name ?? "미정"}</span>
          {categories.length > 0 && (
            <>
              <span className="text-ink-faint">· 카테고리</span>
              <span className="font-semibold text-ink">{categoryName ?? "전체"}</span>
            </>
          )}
          <button type="button" onClick={() => setStep("topic")} className="ml-auto text-xs font-medium text-sea hover:underline">바꾸기</button>
        </div>

        <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <TextField name="title" label="제목" defaultValue={state.values?.title ?? post.title} required placeholder={`2~${POST_TITLE_MAX}자`} />
          <TextField name="summary" label="한 줄 요약 (선택)" defaultValue={state.values?.summary ?? post.summary} placeholder={`${POST_SUMMARY_MAX}자 이하`} hint="목록 카드에 보입니다." />
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-bold text-ink">본문</p>
          <p className="mt-1 text-xs text-ink-faint">
            사진·영상은 버튼으로 올리거나 끌어다 놓으세요. 올린 것은 섬네일로 보이고, 저장하면 글 안에 그 자리에 들어갑니다.
            {countHint ? ` 이 글: ${countHint}.` : ""}
          </p>
          <div className="mt-3">
            <BlockEditor defaultValue={state.values?.bodyMd ?? post.bodyMd} policy={policy} onChange={onBody} disabled={pending} />
          </div>
          <p className="mt-1 text-right text-xs text-ink-faint">
            {body.trim().length.toLocaleString("ko-KR")}자 (최소 {POST_BODY_MIN}자 · 최대 {POST_BODY_MAX.toLocaleString("ko-KR")}자)
          </p>
          <HeroMediaSelect body={body} defaultValue={state.values?.heroMedia ?? post.heroMedia} className="mt-3" />
          <div className="mt-3">
            <TagInput defaultTags={state.values?.tags ? state.values.tags.split(",").filter(Boolean) : post.tags} suggestions={tagSuggestions} />
          </div>
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
      </div>
    </form>
  );
}
