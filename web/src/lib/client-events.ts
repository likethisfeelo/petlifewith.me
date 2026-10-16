// ============================================================
// 서버 액션 결과를 측정 이벤트로 — 가입·로그인·요청 접수처럼 서버에서 끝나고 redirect 되는 동작은
// 브라우저가 결과를 모른다. 서버가 짧은 쿠키(pl_evt, 2분, JS 읽기 가능)에 이벤트를 남기면 다음 페이지에서
// components/tracker.tsx 가 dataLayer 로 보내고 지운다. 개인정보는 넣지 않는다(이벤트 이름·분류값만).
// ============================================================
import { cookies } from "next/headers";
import { isHttpsSite } from "./config";
import type { TrackEvent, TrackParams } from "./tracking";

const COOKIE = "pl_evt"; // components/tracker.tsx CLIENT_EVENT_COOKIE 와 같아야 한다

export async function queueClientEvent(event: TrackEvent, params: TrackParams = {}): Promise<void> {
  try {
    const store = await cookies();
    let list: Array<{ e: string; p?: TrackParams }> = [];
    const raw = store.get(COOKIE)?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
        if (Array.isArray(parsed)) list = parsed.slice(-4);
      } catch {
        list = [];
      }
    }
    list.push({ e: event, p: params });
    store.set(COOKIE, encodeURIComponent(JSON.stringify(list)), {
      httpOnly: false, // 브라우저 측정 코드가 읽어야 한다
      sameSite: "lax",
      secure: isHttpsSite(),
      path: "/",
      maxAge: 120,
    });
  } catch {
    // 측정 실패가 본 동작을 막지 않는다
  }
}
