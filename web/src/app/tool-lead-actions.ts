"use server";

// 뉴스 도구의 리드 폼 — "자세한 내용을 더 받고 싶어요"(자료 요청)·뉴스레터 구독.
// 자료 요청: 이메일 또는 전화번호 하나를 받아 요청함(자료 요청)에 저장하고 슬랙으로 알린다.
// HTML 도구(sandbox iframe)는 사이트에 직접 요청할 수 없어 부모 페이지가 브리지 메시지를 받아 이 액션을 부른다
// (components/tools/html-tool-frame.tsx · lib/tools.ts window.petlife.requestInfo).
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { getCurrentMember } from "@/lib/member";
import { REQUEST_LIMITS, slackRequestText, validateInfoRequest, validateNewsletter } from "@/lib/requests";
import { requesterHash } from "@/lib/requester-hash";
import { sendSlackMessage } from "@/lib/slack";

const { serviceRequests } = schema;

export type InfoRequestResult = { ok: true } | { ok: false; error: string };

/** 같은 IP(해시)에서 최근 한 시간 요청 수가 한도를 넘었나 */
async function overHourlyLimit(ipHash: string): Promise<boolean> {
  const recent = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.ipHash, ipHash), gt(serviceRequests.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  return (recent[0]?.count ?? 0) >= REQUEST_LIMITS.perHour;
}

export async function submitInfoRequestAction(input: { email?: string; phone?: string; topic?: string; source?: string }): Promise<InfoRequestResult> {
  const v = validateInfoRequest(input);
  if (!v.ok) return { ok: false, error: v.error };
  if (!isDbConfigured()) return { ok: false, error: "지금은 요청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요." };
  const db = getDb();

  const ipHash = await requesterHash();
  if (await overHourlyLimit(ipHash)) return { ok: false, error: "요청이 많아 잠시 후 다시 시도해 주세요." };

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

/**
 * 뉴스레터 구독 — 이메일을 요청함(뉴스레터 구독)에 저장하고 슬랙으로 알린다. 발송은 운영자가 따로 한다.
 * 이미 구독한 이메일이면 새로 넣지 않고 성공으로 답한다(구독 여부를 남에게 알려 주지 않는다).
 */
export async function submitNewsletterAction(input: { email?: string; agree?: boolean; topic?: string; source?: string }): Promise<InfoRequestResult> {
  const v = validateNewsletter(input);
  if (!v.ok) return { ok: false, error: v.error };
  if (!isDbConfigured()) return { ok: false, error: "지금은 구독을 받을 수 없습니다. 잠시 후 다시 시도해 주세요." };
  const db = getDb();

  const ipHash = await requesterHash();
  if (await overHourlyLimit(ipHash)) return { ok: false, error: "요청이 많아 잠시 후 다시 시도해 주세요." };

  const { email, topic, source } = v.value;
  const dup = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.kind, "newsletter"), eq(serviceRequests.contact, email)))
    .limit(1);
  if (dup[0]) return { ok: true };

  const member = await getCurrentMember();
  const inserted = await db
    .insert(serviceRequests)
    .values({
      kind: "newsletter",
      userId: member?.id ?? null,
      requesterName: member?.displayName ?? "(이름 없음)",
      contact: email,
      message: topic || null,
      payload: { topic, source, agreedAt: new Date().toISOString() },
      ipHash,
    })
    .returning({ id: serviceRequests.id });
  const id = inserted[0]!.id;

  const sent = await sendSlackMessage(
    slackRequestText({
      id,
      kind: "newsletter",
      requesterName: member?.displayName ?? "비회원",
      contact: `이메일 ${email}`,
      summary: [source ? `페이지: ${siteUrl()}${source}` : "페이지: (알 수 없음)", `관심: ${topic || "-"}`],
      message: null,
      adminUrl: `${siteUrl()}/admin/requests?kind=newsletter#request-${id}`,
    }),
    slackRequestsWebhookUrl(),
  );
  if (sent) await db.update(serviceRequests).set({ slackSentAt: new Date() }).where(eq(serviceRequests.id, id));
  return { ok: true };
}
