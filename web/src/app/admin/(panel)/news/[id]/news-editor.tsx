"use client";

// 뉴스 글 편집 — 본문(블록 편집기) + 붙일 도구(없음 / 내장 도구 / HTML 업로드)
import { useState } from "react";
import type { UploadPolicy } from "@/lib/settings";
import { BlockEditor } from "@/components/editor/block-editor";
import { BUILTIN_TOOLS, NEWS_CATEGORIES, TOOL_HTML_MAX_BYTES } from "@/lib/tools";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField, inputClass } from "../../../_components/fields";
import { SeoFields, type SeoDefaults } from "../../../_components/seo-fields";
import { UploadField } from "../../../_components/upload-field";
import { useKeptForm } from "../../../_components/use-kept-form";
import { createNewsAction, saveNewsAction, type ActionState } from "../../../news-actions";

export interface NewsFormValues {
  id?: number;
  title: string;
  category: string;
  status: string;
  summary: string | null;
  bodyMd: string | null;
  heroImageKey: string | null;
  toolKey: string | null;
  toolHtml: string | null;
  toolHeight: number | null;
  seo?: SeoDefaults;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "작성 중" },
  { value: "published", label: "발행" },
  { value: "archived", label: "보관" },
];

type ToolMode = "none" | "builtin" | "html";

export function NewsEditor({ mode, post, policy }: { mode: "create" | "edit"; post: NewsFormValues; policy: UploadPolicy }) {
  const action = mode === "create" ? createNewsAction : saveNewsAction;
  const { state, pending, onSubmit } = useKeptForm<ActionState>(action, {});
  const [toolMode, setToolMode] = useState<ToolMode>(post.toolKey ? "builtin" : post.toolHtml ? "html" : "none");
  const [html, setHtml] = useState(post.toolHtml ?? "");
  const bytes = new TextEncoder().encode(html).length;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {post.id !== undefined && <input type="hidden" name="id" value={post.id} />}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextField name="title" label="제목" defaultValue={post.title} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField name="category" label="분류" defaultValue={post.category} options={[...NEWS_CATEGORIES]} />
          <SelectField name="status" label="상태" defaultValue={post.status} options={STATUS_OPTIONS} />
          {mode === "create" && <TextField name="slug" label="주소 (선택)" hint="/news/[주소] — 비우면 제목으로 만듭니다" />}
        </div>
        <TextAreaField name="summary" label="요약 (목록·검색 설명)" defaultValue={post.summary} rows={2} hint="한두 문장, 300자 이하" />
        <UploadField name="heroImageKey" label="대표 이미지" defaultKey={post.heroImageKey} hint="목록 카드와 글 상단, 공유 미리보기에 쓰입니다." />
      </section>

      <div>
        <p className="block text-sm font-medium text-ink">
          본문 <span className="font-normal text-ink-faint">— 검색에 걸리는 글입니다. 도구 안의 내용은 색인되지 않으니 핵심 내용은 본문에 씁니다.</span>
        </p>
        <div className="mt-2">
          <BlockEditor defaultValue={post.bodyMd ?? ""} policy={policy} disabled={pending} />
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <input type="hidden" name="toolMode" value={toolMode} />
        <div>
          <p className="text-sm font-bold text-ink">도구 붙이기</p>
          <p className="mt-1 text-xs text-ink-faint">본문 아래에 도구가 붙습니다. 도구 메뉴는 따로 없고, 이 글이 도구의 자리입니다.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["none", "없음"],
              ["builtin", "내장 도구"],
              ["html", "HTML 올리기"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setToolMode(value)}
              aria-pressed={toolMode === value}
              className={`rounded-full border px-3 py-1.5 ${toolMode === value ? "border-ink bg-ink text-cream" : "border-line text-ink-soft hover:bg-sand"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {toolMode === "builtin" && (
          <div>
            <select name="toolKey" defaultValue={post.toolKey ?? BUILTIN_TOOLS[0]?.key} className={inputClass}>
              {BUILTIN_TOOLS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                  {t.membersOnly ? " (회원 전용)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-faint">{BUILTIN_TOOLS.find((t) => t.key === (post.toolKey ?? BUILTIN_TOOLS[0]?.key))?.description}</p>
          </div>
        )}

        {toolMode === "html" && (
          <div className="space-y-3">
            <p className="rounded-lg border border-line bg-sand/50 px-3 py-2 text-xs leading-relaxed text-ink-soft">
              HTML 한 장을 그대로 붙여 넣습니다. 공개 페이지에서는 <strong>격리된 iframe</strong>으로 열려 사이트 로그인·쿠키에 접근할 수 없습니다.
              높이는 내용에 맞춰 자동으로 늘어납니다. 도구 안에서 <code>localStorage</code> 를 쓰면 방문자 브라우저에 글별로 저장되고,
              <code>window.petlife.print(html)</code> 로 인쇄, <code>window.petlife.download(파일명, 내용)</code> 로 파일 저장을 할 수 있습니다.
              사이트 안 링크는 <code>target=&quot;_top&quot;</code> 으로 겁니다.
            </p>
            <textarea
              name="toolHtml"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={14}
              spellCheck={false}
              placeholder="<!doctype html>..."
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
              <span className={bytes > TOOL_HTML_MAX_BYTES ? "font-semibold text-accent-deep" : ""}>
                {Math.round(bytes / 1000)}KB / {Math.round(TOOL_HTML_MAX_BYTES / 1000)}KB
              </span>
              <label className="flex items-center gap-2">
                첫 화면 높이(px)
                <input name="toolHeight" type="number" min={200} max={6000} defaultValue={post.toolHeight ?? 900} className={`${inputClass} w-24`} />
              </label>
              <label className="flex items-center gap-2">
                파일에서 읽기
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void f.text().then(setHtml);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      <SeoFields defaults={post.seo ?? {}} />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
