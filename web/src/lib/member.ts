// ============================================================
// 현재 회원 — 세션 쿠키(lib/auth.ts) + users 행 대조.
// 차단됐거나 session_version 이 바뀐 계정은 쿠키가 살아 있어도 null.
// ============================================================
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getMemberSession } from "./auth";
import { getDb, isDbConfigured, schema } from "./db";

const { users } = schema;

export interface CurrentMember {
  id: string;
  email: string | null;
  displayName: string;
  role: "admin" | "editor" | "owner" | "member";
  sessionVersion: number;
}

export async function getCurrentMember(): Promise<CurrentMember | null> {
  if (!isDbConfigured()) return null;
  const session = await getMemberSession();
  if (!session) return null;
  const row = (await getDb().select().from(users).where(eq(users.id, session.uid)).limit(1))[0];
  if (!row || row.blockedAt || row.sessionVersion !== session.v || !row.displayName) return null;
  return { id: row.id, email: row.email, displayName: row.displayName, role: row.role, sessionVersion: row.sessionVersion };
}

/** 로그인 필요 페이지 — 없으면 로그인으로 보내고 돌아올 경로를 남긴다 */
export async function requireMember(nextPath: string): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return member;
}

/** 로그인 후 돌아갈 경로 — 사이트 안 경로만 허용 (오픈 리다이렉트 방지) */
export function safeNextPath(raw: string | undefined | null, fallback = "/me"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/admin")) return fallback;
  return raw;
}
