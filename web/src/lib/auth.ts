// ============================================================
// 인증 진입점 — 컴포넌트·라우트에서 이 파일 밖의 인증 API 를 직접 부르지 않는다.
// (claude.md 10-5: Cognito 전환 시 이 파일만 교체한다)
//
// 현재 구현: ADMIN_TOKEN 비교 로그인 + HMAC 서명 쿠키.
// 세션은 무상태 JWT 전략과 동일 — Lambda 에서 세션 조회 DB 왕복이 없다.
// 런칭 시점에 인증이 필요한 범위는 관리자와 클레임 처리뿐이다.
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminToken, authSecret, isProductionSite } from "./config";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7일

export interface Session {
  role: "admin";
  exp: number; // epoch seconds
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
    return parsed;
  } catch {
    return null;
  }
}

/** 로그인 시도. 성공 시 세션 쿠키를 굽는다. */
export async function loginWithToken(token: string): Promise<boolean> {
  const expected = adminToken();
  const secret = authSecret();
  if (!expected || !secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const session: Session = { role: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC };
  const store = await cookies();
  store.set(COOKIE_NAME, encodeSession(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionSite(),
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
