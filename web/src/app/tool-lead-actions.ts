"use server";

// 뉴스 도구의 "자세한 내용을 더 받고 싶어요" — 이메일 또는 전화번호 하나를 받아 요청함(자료 요청)에 저장하고 슬랙으로 알린다.
// HTML 도구(sandbox iframe)는 사이트에 직접 요청할 수 없어 부모 페이지가 브리지 메시지를 받아 이 액션을 부른다
// (components/tools/html-tool-frame.tsx · lib/tools.ts window.petlife.requestInfo).
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { getCurrentMember } from "@/lib/member";
import { REQUEST_LIMITS, slackRequestText, validateInfoRequest } from "@/lib/requests";
import { requesterHash } from "@/lib/requester-hash";
import { sendSlackMessage } from "@/lib/slack";

const { serviceRequests } = schema;

export type InfoRequestResult = { ok: true } | { ok: false; error: string };

export async function submitInfoRequestAction(input: { email?: string; phone?: string; topic?: string; source?: string }): Promise<InfoRequestResult> {
  const v = validateInfoRequest(input);
  if (!v.ok) return { ok: false, error: v.error };
  if (!isDbConfigured()) return { ok: false, error: "지금은 요청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요." };
  const db = getDb();

  const ipHash = await requesterHash();
  const recent = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.ipHash, ipHash), gt(serviceRequests.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if ((recent[0]?.count ?? 0) >= REQUEST_LIMITS.perHour) return { ok: false, error: "요청이 많아 잠시 후 다시 시도해 주세요." };

  const member = await getCurrentMember();
  const { contact, contactType, topic, source } = v.value;
  const inserted = await db
    .insert(serviceRequests)
    .values({
      kind: "info_request",
      userId: member?.id ?? null,
      requesterName: member?.displayName ?? "(이름 없음)",
      contact,
      message: topic || null,
      payload: { contactType, topic, source },
      ipHash,
    })
    .returning({ id: serviceRequests.id });
  const id = inserted[0]!.id;

  const sent = await sendSlackMessage(
    slackRequestText({
      id,
      kind: "info_request",
      requesterName: member?.displayName ?? "비회원",
      contact: `${contactType === "email" ? "이메일" : "전화"} ${contact}`,
      summary: [source ? `페이지: ${siteUrl()}${source}` : "페이지: (알 수 없음)", `주제: ${topic || "-"}`],
      message: null,
      adminUrl: `${siteUrl()}/admin/requests?kind=info_request#request-${id}`,
    }),
    slackRequestsWebhookUrl(),
  );
  if (sent) await db.update(serviceRequests).set({ slackSentAt: new Date() }).where(eq(serviceRequests.id, id));
  return { ok: true };
}
