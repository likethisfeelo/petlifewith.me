"use server";

// 뉴스 글 등록·편집·삭제 — 관리자만 (lib/auth.ts).
// 글에 붙는 도구는 내장 도구(tool_key) 또는 업로드 HTML(tool_html) 중 하나다 (lib/tools.ts).
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isValidObjectKey } from "@/lib/assets";
import { TOOL_HTML_MAX_BYTES, builtinTool, isNewsCategory } from "@/lib/tools";
import { STARTER_NEWS } from "@/lib/tools/starter-news";

const { newsPosts } = schema;

export interface ActionState {
  error?: string;
  saved?: boolean;
}

type NewsStatus = "draft" | "published" | "archived";
const STATUSES: readonly NewsStatus[] = ["draft", "published", "archived"];

async function requireDb() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function nullable(formData: FormData, name: string): string | null {
  return str(formData, name) || null;
}

function readValues(formData: FormData): { error: string } | { values: Omit<typeof newsPosts.$inferInsert, "slug" | "publishedAt"> } {
  const title = str(formData, "title");
  if (title.length < 2) return { error: "제목을 입력하세요." };
  const category = str(formData, "category") || "news";
  if (!isNewsCategory(category)) return { error: "분류가 올바르지 않습니다." };
  const statusRaw = str(formData, "status") || "draft";
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as NewsStatus) : "draft";

  const summary = nullable(formData, "summary");
  if (summary && summary.length > 300) return { error: "요약은 300자 이하로 쓰세요." };
  const seoTitle = nullable(formData, "seoTitle");
  const seoDescription = nullable(formData, "seoDescription");
  if (seoTitle && seoTitle.length > 70) return { error: "검색·공유 제목은 70자 이하로 쓰세요." };
  if (seoDescription && seoDescription.length > 200) return { error: "검색·공유 설명은 200자 이하로 쓰세요." };
  const heroImageKey = nullable(formData, "heroImageKey");
  const ogImageKey = nullable(formData, "ogImageKey");
  if ((heroImageKey && !isValidObjectKey(heroImageKey)) || (ogImageKey && !isValidObjectKey(ogImageKey))) {
    return { error: "이미지 키가 올바르지 않습니다." };
  }

  // 도구: none | builtin | html
  const toolMode = str(formData, "toolMode");
  let toolKey: string | null = null;
  let toolHtml: string | null = null;
  let toolHeight: number | null = null;
  if (toolMode === "builtin") {
    toolKey = str(formData, "toolKey");
    if (!builtinTool(toolKey)) return { error: "내장 도구를 고르세요." };
  } else if (toolMode === "html") {
    toolHtml = str(formData, "toolHtml");
    if (!toolHtml) return { error: "HTML 도구 내용을 붙여 넣으세요." };
    if (new TextEncoder().encode(toolHtml).length > TOOL_HTML_MAX_BYTES) {
      return { error: `HTML 도구는 ${Math.round(TOOL_HTML_MAX_BYTES / 1000)}KB 이하만 넣을 수 있습니다. 이미지는 미디어로 올리고 주소로 쓰세요.` };
    }
    const h = Number(str(formData, "toolHeight"));
    toolHeight = Number.isSafeInteger(h) && h >= 200 && h <= 6000 ? h : null;
  }

  return {
    values: {
      title,
      category,
      status,
      summary,
      bodyMd: nullable(formData, "bodyMd"),
      heroImageKey,
      toolKey,
      toolHtml,
      toolHeight,
      seoTitle,
      seoDescription,
      ogImageKey,
    },
  };
}

function revalidateNews(slug: string) {
  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath("/admin/news");
}

async function uniqueSlug(db: Awaited<ReturnType<typeof requireDb>>, base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const dup = await db.select({ id: newsPosts.id }).from(newsPosts).where(eq(newsPosts.slug, slug)).limit(1);
    if (!dup[0]) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function createNewsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const read = readValues(formData);
  if ("error" in read) return { error: read.error };
  const raw = str(formData, "slug");
  const base = slugify(raw || read.values.title, "news");
  if (raw) {
    const dup = await db.select({ id: newsPosts.id }).from(newsPosts).where(eq(newsPosts.slug, base)).limit(1);
    if (dup[0]) return { error: `주소 ${base} 가 이미 사용 중입니다.` };
  }
  const slug = raw ? base : await uniqueSlug(db, base);
  const inserted = await db
    .insert(newsPosts)
    .values({ ...read.values, slug, publishedAt: read.values.status === "published" ? new Date() : null })
    .returning({ id: newsPosts.id });
  revalidateNews(slug);
  redirect(`/admin/news/${inserted[0]!.id}?created=1`);
}

export async function saveNewsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };
  const existing = (await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1))[0];
  if (!existing) return { error: "글을 찾을 수 없습니다." };
  const read = readValues(formData);
  if ("error" in read) return { error: read.error };
  await db
    .update(newsPosts)
    .set({
      ...read.values,
      publishedAt: read.values.status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(newsPosts.id, id));
  revalidateNews(existing.slug);
  revalidatePath(`/admin/news/${id}`);
  return { saved: true };
}

export async function deleteNewsAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (await db.delete(newsPosts).where(eq(newsPosts.id, id)).returning({ slug: newsPosts.slug }))[0];
  if (row) revalidateNews(row.slug);
  redirect("/admin/news");
}

/** 처음 쓰는 글 — CCTV 점검표(HTML 도구)·안내판 만들기(내장 도구). 같은 주소가 없을 때만 작성 중으로 넣는다 */
export async function insertStarterNewsAction(): Promise<void> {
  const db = await requireDb();
  for (const post of STARTER_NEWS) {
    const dup = await db.select({ id: newsPosts.id }).from(newsPosts).where(eq(newsPosts.slug, post.slug)).limit(1);
    if (dup[0]) continue;
    await db.insert(newsPosts).values({ ...post, status: "draft" });
  }
  revalidatePath("/admin/news");
  redirect("/admin/news?starter=1");
}
