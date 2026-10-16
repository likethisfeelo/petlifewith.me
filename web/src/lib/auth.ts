// ============================================================
// 인증 진입점 — 컴포넌트·라우트에서 이 파일 밖의 인증 API 를 직접 부르지 않는다.
// (claude.md 10-5: Cognito 전환 시 이 파일만 교체한다)
//
// 현재 구현 (2026-10 Cognito 전환):
//  - 계정·비밀번호·2단계 인증·카카오는 Cognito(lib/cognito.ts). 로그인 순간에 ID 토큰을 검증하고
//    users 행과 맞춘 뒤(lib/identity.ts) 여기서 사이트 세션 쿠키를 굽는다.
//  - 회원: HMAC 서명 쿠키 (member_session_v2, 상위 도메인 — 메인·사장님 대시보드 등 같은 계정 공유).
//    쿠키에는 users.id 와 session_version 만. 차단·비밀번호 변경으로 버전이 오르면 즉시 끊긴다.
//  - 관리자: Cognito admin 그룹 + 2단계 인증으로 로그인한 회원(kind=cognito, users 행 대조)
//    또는 전환 기간 비상용 ADMIN_TOKEN(kind=token). 쿠키 admin_session_v2, 상위 도메인.
//  - 로그인 중간 상태(2단계 인증 코드 대기·카카오 state 등)는 짧은 서명 쿠키(auth_flow)에.
// ============================================================
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { adminAccounts, apexDomain, authSecret, isHttpsSite, siteEnv } from "./config";
import { getDb, isDbConfigured, schema } from "./db";

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
  /** token: 비상용 ADMIN_TOKEN, cognito: Cognito admin 그룹 + 2단계 인증 회원 */
  kind?: "token" | "cognito";
  /** 표시용 라벨 — 토큰은 "라벨:토큰"의 라벨, Cognito 는 이메일 */
  sub: string;
  /** token: 토큰 지문(회수·교체 즉시 무효). cognito: "c" */
  fp: string;
  /** cognito: users.id 와 session_version — 차단·버전 변경·관리자 해제 시 즉시 무효 */
  uid?: string;
  v?: number;
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
    if (parsed.kind === "cognito") return typeof parsed.uid === "string" && typeof parsed.v === "number" ? parsed : null;
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
    kind: "token",
    sub: matched.label,
    fp: fingerprint(matched.token),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  await setAdminCookie(session, secret);
  return true;
}

async function setAdminCookie(session: Session, secret: string): Promise<void> {
  const store = await cookies();
  store.set(adminCookieName(), encodeSession(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsSite(),
    path: "/",
    maxAge: SESSION_TTL_SEC,
    domain: adminCookieDomain(),
  });
}

/** Cognito 관리자 로그인 — 그룹·2단계 인증 확인은 호출하는 쪽(lib/identity.ts)이 끝낸 뒤 부른다 */
export async function startCognitoAdminSession(user: { id: string; email: string | null; sessionVersion: number }): Promise<void> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET 미설정");
  await setAdminCookie(
    {
      role: "admin",
      kind: "cognito",
      sub: user.email ?? "admin",
      fp: "c",
      uid: user.id,
      v: user.sessionVersion,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    },
    secret,
  );
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
  const session = decodeSession(value, secret);
  if (!session || session.kind !== "cognito") return session;
  // Cognito 관리자 — 아직 관리자이고 차단·버전 변경이 없는지 DB 로 대조 (관리자 쿠키가 있는 요청에서만)
  if (!isDbConfigured() || !session.uid) return null;
  const { users } = schema;
  const row = (
    await getDb()
      .select({ role: users.role, blockedAt: users.blockedAt, sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, session.uid))
      .limit(1)
  )[0];
  if (!row || row.role !== "admin" || row.blockedAt || row.sessionVersion !== session.v) return null;
  return session;
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession()) !== null;
}

// ---------- 회원 세션 ----------

// v2: 상위 도메인 쿠키(사장님 대시보드 등 여러 앱이 같은 계정) — 스테이지별 이름으로 운영·dev 가 섞이지 않게
function memberCookieName(): string {
  return siteEnv() === "preview" ? "member_session_v2_preview" : "member_session_v2";
}
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
  store.set(memberCookieName(), `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsSite(),
    path: "/",
    maxAge: MEMBER_SESSION_TTL_SEC,
    domain: adminCookieDomain(),
  });
}

export async function endMemberSession(): Promise<void> {
  const store = await cookies();
  store.set(memberCookieName(), "", { path: "/", maxAge: 0, domain: adminCookieDomain() });
}

/** 쿠키만 본다 (DB 조회 없음). 실제 사용자 상태(차단·버전)는 lib/member.ts getCurrentMember 가 대조한다. */
export async function getMemberSession(): Promise<MemberSession | null> {
  const secret = authSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(memberCookieName())?.value;
  if (!value) return null;
  return decodeMemberSession(value, secret);
}

// ---------- 로그인 중간 상태 (2단계 인증 대기 · 새 비밀번호 · 닉네임 정하기 · 카카오 state · 인증 앱 등록) ----------

export interface AuthFlow {
  step: "mfa" | "new_password" | "profile" | "kakao" | "totp_setup";
  /** 로그인 이메일 (Cognito 사용자 이름) */
  email?: string;
  /** Cognito 챌린지 세션 문자열 */
  session?: string;
  /** 로그인 뒤 돌아갈 곳 */
  next?: string;
  /** 관리자 로그인 흐름인지 */
  admin?: boolean;
  /** profile: 닉네임을 정할 users.id */
  uid?: string;
  /** kakao: CSRF state */
  state?: string;
  /** totp_setup: 인증 앱 등록에 쓰는 액세스 토큰(10분) */
  accessToken?: string;
  exp: number;
}

const FLOW_COOKIE = "auth_flow";
const FLOW_TTL_SEC = 10 * 60;

/** 서명만 하고 암호화하지 않는다 — httpOnly·10분, 담기는 것은 Cognito 세션 문자열·state 같은 일회성 값뿐 */
export async function setAuthFlow(flow: Omit<AuthFlow, "exp">): Promise<void> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET 미설정");
  const payload = b64url(Buffer.from(JSON.stringify({ ...flow, exp: Math.floor(Date.now() / 1000) + FLOW_TTL_SEC }), "utf8"));
  const store = await cookies();
  store.set(FLOW_COOKIE, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    sameSite: "lax", // 카카오에서 돌아오는 최상위 이동(GET)에도 실려야 한다
    secure: isHttpsSite(),
    path: "/",
    maxAge: FLOW_TTL_SEC,
  });
}

export async function getAuthFlow(step?: AuthFlow["step"]): Promise<AuthFlow | null> {
  const secret = authSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(FLOW_COOKIE)?.value;
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const a = Buffer.from(value.slice(dot + 1));
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthFlow;
    if (flow.exp * 1000 < Date.now()) return null;
    if (step && flow.step !== step) return null;
    return flow;
  } catch {
    return null;
  }
}

export async function clearAuthFlow(): Promise<void> {
  const store = await cookies();
  store.set(FLOW_COOKIE, "", { path: "/", maxAge: 0 });
}
