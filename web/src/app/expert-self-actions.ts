"use server";

// 회원 셀프 상담 프로필 — 멘토(선배 보호자)는 누구나 만들어 바로 공개하고, 훈련사는 자격 확인 뒤 운영자가 공개한다.
// 한 계정에 프로필 하나. 활동 지역(최대 5곳)·주간 슬롯·방식·요금·소개. 연락처는 운영자 확인용(비공개).
import { randomInt } from "node:crypto";
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { isValidObjectKey } from "@/lib/assets";
import { getCurrentMember } from "@/lib/member";
import { getExpertForUser } from "@/lib/queries/experts";
import { CONSULT_MODES, EXPERT_LIMITS, isExpertKind, parseWeeklySlots, selfPublishes } from "@/lib/reservations";
import { parseRows, rowString } from "./admin/_components/parse-rows";

const { experts, expertSlots, expertRegions, regions } = schema;

export interface ExpertSelfState {
  error?: string;
  saved?: boolean;
  notice?: string;
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveMyExpertAction(_prev: ExpertSelfState, formData: FormData): Promise<ExpertSelfState> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme%2Fexpert");
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  const db = getDb();

  const kind = str(formData, "kind");
  if (!isExpertKind(kind)) return { error: "훈련사 또는 멘토를 골라 주세요." };
  const displayName = str(formData, "displayName");
  if (displayName.length < 2 || displayName.length > EXPERT_LIMITS.name) return { error: `활동명을 2~${EXPERT_LIMITS.name}자로 적어 주세요.` };
  const introMd = str(formData, "introMd");
  if (introMd.length < 20 || introMd.length > EXPERT_LIMITS.intro) return { error: `소개를 20자 이상 ${EXPERT_LIMITS.intro}자 이내로 적어 주세요.` };
  const credentialsText = str(formData, "credentialsText").slice(0, EXPERT_LIMITS.short) || null;
  if (kind === "trainer" && !credentialsText) return { error: "훈련사는 자격·경력을 적어 주세요. 운영자가 확인한 뒤 공개됩니다." };
  const topics = [...new Set(str(formData, "topics").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, EXPERT_LIMITS.topics);
  const modes = CONSULT_MODES.filter((m) => formData.getAll("modes").includes(m));
  if (modes.length === 0) return { error: "상담 방식을 하나 이상 골라 주세요." };
  const priceText = str(formData, "priceText").slice(0, EXPERT_LIMITS.short) || null;
  const heroImageKey = str(formData, "heroImageKey") || null;
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "프로필 사진이 올바르지 않습니다." };
  const contact = str(formData, "contact").slice(0, EXPERT_LIMITS.short) || null;
  const regionIds = [...new Set(str(formData, "regionIds").split(",").map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (regionIds.length > EXPERT_LIMITS.regions) return { error: `활동 지역은 ${EXPERT_LIMITS.regions}곳까지입니다.` };
  if (regionIds.length > 0) {
    const found = await db.select({ id: regions.id }).from(regions).where(inArray(regions.id, regionIds));
    if (found.length !== regionIds.length) return { error: "활동 지역을 다시 골라 주세요." };
  }
  const slotRows = parseRows(formData, "slotsJson").map((r) => ({ weekday: rowString(r, "weekday"), start: rowString(r, "start"), end: rowString(r, "end") })).filter((r) => r.start || r.end);
  if (slotRows.length > EXPERT_LIMITS.slots) return { error: `슬롯은 ${EXPERT_LIMITS.slots}개까지입니다.` };
  const slots = parseWeeklySlots(slotRows);
  if (!slots.ok) return { error: slots.error };
  const visible = formData.get("visible") === "on";

  const existing = await getExpertForUser(member.id);
  // 멘토는 본인이 공개 여부를 정한다. 훈련사는 운영자가 자격 확인 뒤 공개 — 이미 공개된 뒤의 수정은 공개를 유지한다
  const status: "draft" | "published" = selfPublishes(kind) ? (visible ? "published" : "draft") : existing && existing.kind === "trainer" && existing.status === "published" ? "published" : "draft";
  const values = { kind, displayName, introMd, credentialsText, topics, modes, priceText, heroImageKey, contact, status, userId: member.id };

  let expertId: number;
  if (existing) {
    expertId = existing.id;
    await db.update(experts).set({ ...values, updatedAt: new Date() }).where(and(eq(experts.id, expertId), eq(experts.userId, member.id)));
  } else {
    const base = slugify(displayName, "mentor").slice(0, 40);
    let inserted: { id: number } | undefined;
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      const slug = `${base}-${randomInt(36 ** 4).toString(36).padStart(4, "0")}`;
      try {
        inserted = (await db.insert(experts).values({ ...values, slug }).returning({ id: experts.id }))[0];
      } catch (e) {
        const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
        if (code !== "23505") throw e;
      }
    }
    if (!inserted) return { error: "잠시 후 다시 시도해 주세요." };
    expertId = inserted.id;
  }
  await db.delete(expertSlots).where(eq(expertSlots.expertId, expertId));
  if (slots.value.length > 0) await db.insert(expertSlots).values(slots.value.map((s) => ({ expertId, ...s })));
  await db.delete(expertRegions).where(and(eq(expertRegions.expertId, expertId), regionIds.length > 0 ? ne(expertRegions.regionId, -1) : undefined));
  if (regionIds.length > 0) await db.insert(expertRegions).values(regionIds.map((regionId, i) => ({ expertId, regionId, sortOrder: i })));

  const slug = (await db.select({ slug: experts.slug }).from(experts).where(eq(experts.id, expertId)).limit(1))[0]?.slug;
  revalidatePath("/consult");
  if (slug) revalidatePath(`/consult/${encodeURIComponent(slug)}`);
  revalidatePath("/me/expert");
  revalidatePath("/topic/senior-life");
  return {
    saved: true,
    notice: kind === "trainer" && status !== "published" ? "저장했습니다. 훈련사 프로필은 운영자가 자격을 확인한 뒤 공개됩니다." : status === "published" ? "저장했습니다. 지금 공개 중이에요." : "저장했습니다. 비공개 상태예요.",
  };
}
