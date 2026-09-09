"use server";

// 사이트 설정 저장 — /admin/settings. 값 정규화는 lib/settings.ts, 저장은 lib/queries/settings.ts.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { saveMemberMediaSettings, savePromoPlanSettings } from "@/lib/queries/settings";
import { normalizeMemberMedia, normalizePromoPlans } from "@/lib/settings";
import type { ActionState } from "./actions";

export async function saveMemberMediaSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getSession())) redirect("/admin/login");
  if (!isDbConfigured()) return { error: "DATABASE_URL 미설정" };
  const num = (name: string) => Number(String(formData.get(name) ?? "").trim() || 0);
  // 용량은 MB 단위로 입력받아 바이트로 저장한다
  const next = normalizeMemberMedia({
    maxImagesPerPost: num("maxImagesPerPost"),
    maxVideosPerPost: num("maxVideosPerPost"),
    maxImageBytes: Math.round(num("maxImageMb") * 1024 * 1024),
    maxVideoBytes: Math.round(num("maxVideoMb") * 1024 * 1024),
    maxVideoSeconds: Math.round(num("maxVideoSeconds")),
    requireApproval: formData.get("requireApproval") === "on",
  });
  await saveMemberMediaSettings(next);
  return { saved: true };
}

export async function savePromoPlansAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getSession())) redirect("/admin/login");
  if (!isDbConfigured()) return { error: "DATABASE_URL 미설정" };
  const text = (name: string) => String(formData.get(name) ?? "");
  const plan = (p: "a" | "b" | "c") => ({ description: text(`${p}_description`), priceText: text(`${p}_priceText`) });
  await savePromoPlanSettings(normalizePromoPlans({ a: plan("a"), b: plan("b"), c: plan("c") }));
  return { saved: true };
}
