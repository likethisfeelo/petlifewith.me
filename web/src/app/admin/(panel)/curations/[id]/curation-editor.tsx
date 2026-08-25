"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { SeoFields, type SeoDefaults } from "../../../_components/seo-fields";
import { createCurationAction, saveCurationAction, type ActionState } from "../../../directory-actions";

export interface CurationFormValues {
  id?: number;
  title: string;
  themeSlug?: string;
  introMd: string | null;
  status: string;
  seo?: SeoDefaults;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "작성 중" },
  { value: "published", label: "발행" },
  { value: "archived", label: "보관" },
];

// 공식 임베드만 허용하고, 창작자명·원본 링크·우리 요약이 없으면 저장이 거부된다.
const ENTRY_FIELDS = [
  {
    key: "embedSource",
    label: "임베드",
    type: "select" as const,
    span: "col-span-2",
    options: [
      { value: "none", label: "링크만" },
      { value: "youtube", label: "유튜브" },
      { value: "instagram", label: "인스타그램" },
    ],
  },
  {
    key: "embedRef",
    label: "영상 ID 또는 게시물 URL",
    span: "col-span-4",
    placeholder: "dQw4w9WgXcQ 또는 https://www.instagram.com/p/...",
  },
  { key: "creatorName", label: "창작자명 (필수)", span: "col-span-3" },
  { key: "originalUrl", label: "원본 링크 (필수)", span: "col-span-3", placeholder: "https://..." },
  {
    key: "summaryMd",
    label: "우리 언어로 쓴 요약 (필수)",
    type: "textarea" as const,
    span: "col-span-12",
    rows: 3,
    placeholder: "임베드를 전부 제거해도 이 페이지가 읽을 가치가 있어야 합니다.",
  },
];

export function CurationEditor({
  mode,
  curation,
  entries,
}: {
  mode: "create" | "edit";
  curation: CurationFormValues;
  entries: RowValue[];
}) {
  const action = mode === "create" ? createCurationAction : saveCurationAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {curation.id !== undefined && <input type="hidden" name="id" value={curation.id} />}

      <p className="rounded-lg border border-plum/30 bg-plum-soft px-4 py-3 text-xs leading-relaxed text-plum">
        <strong>저작권 규칙</strong> — 이미지·썸네일·프레임을 내려받아 올리지 않습니다(스크린샷 포함). 유튜브와
        인스타그램의 <strong>공식 임베드</strong>만 사용하고, 막히면 그 콘텐츠는 포기합니다. 모든 항목에 창작자명과
        원본 링크를 해당 위치에 표기하며, 인용은 15단어 미만으로 두고 나머지는 우리 언어로 다시 씁니다.
      </p>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="title" label="테마 제목" defaultValue={curation.title} required />
          {mode === "create" && (
            <TextField name="themeSlug" label="테마 슬러그 (선택)" hint="URL: /curation/[슬러그]" />
          )}
        </div>
        <SelectField name="status" label="상태" defaultValue={curation.status} options={STATUS_OPTIONS} />
        <TextAreaField
          name="introMd"
          label="도입글 (마크다운)"
          defaultValue={curation.introMd}
          rows={8}
          mono
          hint="여러 소스를 비교한 정리, 직접 해본 기록, 초보자가 막히는 지점 보완 중 최소 두 가지가 들어가야 발행할 수 있습니다."
        />
      </section>

      <RowsEditor
        name="entriesJson"
        title="큐레이션 항목"
        hint="창작자명·원본 링크·요약은 필수입니다. 하나라도 비면 저장이 거부됩니다."
        fields={ENTRY_FIELDS}
        initialRows={entries}
        emptyRow={{ embedSource: "none", embedRef: "", creatorName: "", originalUrl: "", summaryMd: "" }}
        addLabel="항목 추가"
        emptyHint="항목이 없습니다. 항목이 하나도 없으면 발행해도 색인되지 않습니다."
      />

      <SeoFields defaults={curation.seo ?? {}} />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
