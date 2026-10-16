"use server";

// 뉴스 글에 붙은 내장 도구의 회원 결과물 — 저장·목록·삭제 (tool_saves).
// 회원 본인 것만 다룬다. 도구마다 data 검사기를 따로 둔다.
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCurrentMember } from "@/lib/member";
import { parseSignData } from "@/lib/tools/sign-data";

const { toolSaves } = schema;

/** 도구별 저장 개수 상한 */
const MAX_SAVES_PER_TOOL = 20;

const PARSERS: Record<string, (raw: unknown) => unknown> = {
  "cctv-sign": parseSignData,
};

export interface ToolSaveSummary {
  id: number;
  title: string;
  updatedAt: string;
}

export type ToolResult<T> = { ok: true; value: T } | { ok: false; error: string };

export async function listToolSavesAction(toolKey: string): Promise<ToolResult<ToolSaveSummary[]>> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "로그인이 필요합니다." };
  const rows = await getDb()
    .select({ id: toolSaves.id, title: toolSaves.title, updatedAt: toolSaves.updatedAt })
    .from(toolSaves)
    .where(and(eq(toolSaves.userId, member.id), eq(toolSaves.toolKey, toolKey)))
    .orderBy(desc(toolSaves.updatedAt))
    .limit(MAX_SAVES_PER_TOOL);
  return { ok: true, value: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() })) };
}

export async function loadToolSaveAction(toolKey: string, id: number): Promise<ToolResult<unknown>> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "로그인이 필요합니다." };
  const row = (
    await getDb()
      .select({ data: toolSaves.data })
      .from(toolSaves)
      .where(and(eq(toolSaves.id, id), eq(toolSaves.userId, member.id), eq(toolSaves.toolKey, toolKey)))
      .limit(1)
  )[0];
  return row ? { ok: true, value: row.data } : { ok: false, error: "저장한 내용을 찾을 수 없습니다." };
}

/** id 가 있으면 덮어쓰고, 없으면 새로 만든다 */
export async function saveToolAction(toolKey: string, input: { id?: number | null; title: string; data: unknown }): Promise<ToolResult<{ id: number }>> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "로그인이 필요합니다." };
  const parse = PARSERS[toolKey];
  if (!parse) return { ok: false, error: "알 수 없는 도구입니다." };
  const data = parse(input.data);
  if (!data) return { ok: false, error: "저장할 내용이 올바르지 않습니다. 로고는 작은 PNG·JPG 로 다시 넣어 주세요." };
  const title = input.title.trim().slice(0, 60) || "이름 없는 안내판";
  const db = getDb();

  if (input.id) {
    const updated = await db
      .update(toolSaves)
      .set({ title, data, updatedAt: new Date() })
      .where(and(eq(toolSaves.id, input.id), eq(toolSaves.userId, member.id), eq(toolSaves.toolKey, toolKey)))
      .returning({ id: toolSaves.id });
    if (updated[0]) return { ok: true, value: { id: updated[0].id } };
  }

  const count = (
    await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(toolSaves)
      .where(and(eq(toolSaves.userId, member.id), eq(toolSaves.toolKey, toolKey)))
  )[0]?.n ?? 0;
  if (count >= MAX_SAVES_PER_TOOL) return { ok: false, error: `저장은 ${MAX_SAVES_PER_TOOL}개까지입니다. 안 쓰는 것을 지운 뒤 다시 저장하세요.` };
  const inserted = await db.insert(toolSaves).values({ userId: member.id, toolKey, title, data }).returning({ id: toolSaves.id });
  return { ok: true, value: { id: inserted[0]!.id } };
}

export async function deleteToolSaveAction(toolKey: string, id: number): Promise<ToolResult<null>> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "로그인이 필요합니다." };
  await getDb()
    .delete(toolSaves)
    .where(and(eq(toolSaves.id, id), eq(toolSaves.userId, member.id), eq(toolSaves.toolKey, toolKey)));
  return { ok: true, value: null };
}
