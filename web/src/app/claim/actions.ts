"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";

const { claims, spots, makers } = schema;

export interface ClaimFormState {
  error?: string;
}

// 클레임 접수 — 로그인 없이 받는다 (런칭 시점 인증 범위는 관리자뿐, claude.md 10-5).
// 연락처·사업자번호는 관리자 확인용으로만 저장하고 어디에도 렌더하지 않는다.
export async function submitClaim(_prev: ClaimFormState, formData: FormData): Promise<ClaimFormState> {
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };

  const targetType = String(formData.get("targetType") ?? "");
  const targetId = Number(formData.get("targetId") ?? 0);
  const claimantName = String(formData.get("claimantName") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const bizRegistrationNo = String(formData.get("bizRegistrationNo") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (targetType !== "spot" && targetType !== "maker") return { error: "잘못된 요청입니다." };
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return { error: "잘못된 요청입니다." };
  if (claimantName.length < 2) return { error: "성함(담당자명)을 입력해 주세요." };
  if (contact.length < 5) return { error: "회신받을 연락처(이메일 또는 전화)를 입력해 주세요." };

  const db = getDb();
  const exists =
    targetType === "spot"
      ? (await db.select({ id: spots.id }).from(spots).where(eq(spots.id, targetId)).limit(1))[0]
      : (await db.select({ id: makers.id }).from(makers).where(eq(makers.id, targetId)).limit(1))[0];
  if (!exists) return { error: "대상을 찾을 수 없습니다." };

  await db.insert(claims).values({
    targetType,
    spotId: targetType === "spot" ? targetId : null,
    makerId: targetType === "maker" ? targetId : null,
    claimantName,
    contact,
    bizRegistrationNo: bizRegistrationNo || null,
    message: message || null,
  });

  redirect(`/claim/${targetType}/${targetId}?done=1`);
}
