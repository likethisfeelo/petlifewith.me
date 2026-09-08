// Slack Incoming Webhook — 예약 신청 알림 전용. 실패해도 던지지 않는다(신청은 이미 DB 에 저장됐다).
// 시크릿(URL)은 lib/config.ts 에서만 읽는다.
import { slackBookingWebhookUrl } from "./config";

export async function sendSlackMessage(text: string): Promise<boolean> {
  const url = slackBookingWebhookUrl();
  if (!url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
