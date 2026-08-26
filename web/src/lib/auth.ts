// ============================================================
// 인증 진입점 — 컴포넌트·라우트에서 이 파일 밖의 인증 API 를 직접 부르지 않는다.
// (claude.md 10-5: Cognito 전환 시 이 파일만 교체한다)
//
// 현재 구현: ADMIN_TOKEN 비교 로그인 + HMAC 서명 쿠키.
// 세션은 무상태 JWT 전략과 동일 — Lambda 에서 세션 조회 DB 왕복이 없다.
// 런칭 시점에 인증이 필요한 범위는 관리자와 클레임 처리뿐이다.
// ============================================================
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminAccounts, authSecret, isHttpsSite } from "./config";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7일

export interface Session {
  role: "admin";
  /** 계정 라벨 — 여러 관리자를 구분한다 (ADMIN_TOKEN 의 "라벨:토큰") */
  sub: string;
  /** 토큰 지문 — 계정을 빼거나 토큰을 교체하면 기존 세션이 즉시 무효가 된다 */
  fp: string;
  exp: number; // epoch seconds
}

/** 토큰을 그대로 담지 않고 지문만 세션에 넣는다 */
function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * 길이와 무관하게 상수 시간 비교 — 해시로 길이를 고정한 뒤 비교한다.
 * (timingSafeEqual 은 길이가 다르면 던지므로 길이 자체가 새어나가지 않게 한다)
 */
function tokenMatches(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

function encodeSession(session: Session, secret: string): string {
  const payload = b64url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${payload}.${sign(payload, secret)}`;
}

function decodeSession(value: string, secret: string): Session | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (parsed.role !== "admin") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    if (!parsed.sub || !parsed.fp) return null;
    // 계정이 아직 존재하고 토큰이 그대로인지 확인 — 회수·교체 즉시 반영된다
    const account = adminAccounts().find((a) => a.label === parsed.sub);
    if (!account || fingerprint(account.token) !== parsed.fp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 로그인 시도. 성공 시 세션 쿠키를 굽는다. */
export async function loginWithToken(token: string): Promise<boolean> {
  const secret = authSecret();
  const accounts = adminAccounts();
  if (accounts.length === 0 || !secret) return false;

  // 어느 계정에서 멈췄는지 시간으로 드러나지 않게 전부 순회한다
  let matched: (typeof accounts)[number] | undefined;
  for (const account of accounts) {
    if (tokenMatches(token, account.token)) matched = account;
  }
  if (!matched) return false;

  const session: Session = {
    role: "admin",
    sub: matched.label,
    fp: fingerprint(matched.token),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  const store = await cookies();
  store.set(COOKIE_NAME, encodeSession(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsSite(),
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const secret = authSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return decodeSession(value, secret);
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession()) !== null;
}
