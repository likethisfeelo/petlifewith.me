// ============================================================
// 인증 진입점 — 컴포넌트·라우트에서 이 파일 밖의 인증 API 를 직접 부르지 않는다.
// (claude.md 10-5: Cognito 전환 시 이 파일만 교체한다)
//
// 현재 구현:
//  - 관리자: ADMIN_TOKEN 비교 로그인 + HMAC 서명 쿠키 (admin_session_v2, 상위 도메인 — admin. 과 메인 사이트가 공유)
//  - 회원: 이메일·비밀번호(lib/password.ts) + HMAC 서명 쿠키 (member_session).
//    쿠키에는 사용자 id 와 session_version 만 담는다. 비밀번호 변경·차단으로 버전이 오르면
//    기존 쿠키가 즉시 죽는다. Cognito 로 옮길 때 바꾸는 것은 startMemberSession 을
//    호출하는 로그인 액션과 이 파일뿐이다 (claude.md 10-5).
// 세션은 무상태 JWT 전략과 동일 — Lambda 에서 세션 조회 DB 왕복이 없다.
// ============================================================
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminAccounts, apexDomain, authSecret, isHttpsSite, siteEnv } from "./config";

// v2: 상위 도메인 쿠키로 바꾸며 이름도 바꿨다 — 예전 호스트 전용 쿠키(admin_session)는 읽지 않으므로
// 로그아웃 뒤 옛 쿠키가 남아 로그인 상태로 보이는 일이 없다 (전환 시 한 번 다시 로그인)
const COOKIE_NAME_BASE = "admin_session_v2";

/**
 * 관리자 쿠키 이름 — 배포 dev 는 운영과 같은 상위 도메인을 쓰므로 이름을 나눠 서로 덮어쓰지 않게 한다.
 */
function adminCookieName(): string {
  const env = siteEnv();
  return env === "preview" ? `${COOKIE_NAME_BASE}_preview` : COOKIE_NAME_BASE;
}

/**
 * 관리자 쿠키 도메인 — admin. 에서 로그인해도 메인 사이트(글 페이지의 관리자 버튼)에서 같은 세션을 쓰도록
 * 상위 도메인에 굽는다. petlifewith.me → petlifewith.me, dev.petlifewith.me → petlifewith.me
 * (admin-dev. 하이픈 호스트도 포함). 로컬(localhost)은 호스트 전용 그대로.
 */
export function adminCookieDomain(): string | undefined {
  if (siteEnv() === "local") return undefined;
  const labels = apexDomain().split(".");
  if (labels.length < 2) return undefined;
  return labels.slice(-2).join(".");
}
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
  store.set(adminCookieName(), encodeSession(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsSite(),
    path: "/",
    maxAge: SESSION_TTL_SEC,
    domain: adminCookieDomain(),
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.set(adminCookieName(), "", { path: "/", maxAge: 0, domain: adminCookieDomain() });
}

export async function getSession(): Promise<Session | null> {
  const secret = authSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(adminCookieName())?.value;
  if (!value) return null;
  return decodeSession(value, secret);
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession()) !== null;
}

// ---------- 회원 세션 ----------

const MEMBER_COOKIE_NAME = "member_session";
const MEMBER_SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30일

export interface MemberSession {
  role: "member";
  /** users.id */
  uid: string;
  /** users.session_version — DB 값과 다르면 무효 (lib/member.ts 가 대조) */
  v: number;
  exp: number;
}

function decodeMemberSession(value: string, secret: string): MemberSession | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MemberSession;
    if (parsed.role !== "member") return null;
    if (typeof parsed.uid !== "string" || !parsed.uid) return null;
    if (typeof parsed.v !== "number") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 로그인·가입 성공 후 호출 — 회원 쿠키를 굽는다 */
export async function startMemberSession(userId: string, sessionVersion: number): Promise<void> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET 미설정");
  const session: MemberSession = {
    role: "member",
    uid: userId,
    v: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + MEMBER_SESSION_TTL_SEC,
  };
  const payload = b64url(Buffer.from(JSON.stringify(session), "utf8"));
  const store = await cookies();
  store.set(MEMBER_COOKIE_NAME, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsSite(),
    path: "/",
    maxAge: MEMBER_SESSION_TTL_SEC,
  });
}

export async function endMemberSession(): Promise<void> {
  const store = await cookies();
  store.delete(MEMBER_COOKIE_NAME);
}

/** 쿠키만 본다 (DB 조회 없음). 실제 사용자 상태(차단·버전)는 lib/member.ts getCurrentMember 가 대조한다. */
export async function getMemberSession(): Promise<MemberSession | null> {
  const secret = authSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(MEMBER_COOKIE_NAME)?.value;
  if (!value) return null;
  return decodeMemberSession(value, secret);
}
