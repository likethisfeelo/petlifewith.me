// ============================================================
// Cognito 로그인 결과 → users 행 → 사이트 세션.
//
// users.id(내부 UUID)가 계속 모든 FK 의 기준이고, Cognito 는 users.cognito_sub 로만 연결한다 (claude.md 10-5).
//   1) cognito_sub 로 찾는다
//   2) 없으면 확인된 이메일이 같은 옛 회원 행(cognito_sub 비어 있음)에 연결한다 — 전환 전 테스트 회원용
//   3) 그래도 없으면 새 행. 닉네임은 Cognito 의 nickname(가입 때 입력·카카오 선택 동의)을 쓰고,
//      없거나 겹치면 /signup/profile 에서 정하게 한다
// 관리자 여부는 Cognito admin 그룹이 기준이고, 로그인할 때마다 users.role 에 맞춰 둔다.
// ============================================================
import { and, eq, isNull, sql } from "drizzle-orm";
import { setAuthFlow, startCognitoAdminSession, startMemberSession } from "./auth";
import { queueClientEvent } from "./client-events";
import { verifyIdToken, type CognitoTokens } from "./cognito";
import { getDb, schema } from "./db";

const { users } = schema;

/** 닉네임 규칙 — 2~20자, 한글·영문·숫자로 시작, 공백·._- 허용 */
export const DISPLAY_NAME_RE = /^[0-9A-Za-z가-힣][0-9A-Za-z가-힣 _.-]{1,19}$/;

export type SignInOutcome = { redirectTo: string; error?: undefined } | { error: string; redirectTo?: undefined };

async function displayNameAvailable(name: string, exceptUserId?: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.displayName}) = lower(${name})`)
    .limit(2);
  return rows.every((r) => r.id === exceptUserId);
}

export async function completeSignIn(
  tokens: CognitoTokens,
  opts: { next: string; admin?: boolean; mfaUsed?: boolean },
): Promise<SignInOutcome> {
  const id = await verifyIdToken(tokens.idToken);
  if (!id) return { error: "로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요." };
  const db = getDb();

  let row = (await db.select().from(users).where(eq(users.cognitoSub, id.sub)).limit(1))[0];
  if (!row && id.email && id.emailVerified) {
    const legacy = (await db.select().from(users).where(and(eq(users.email, id.email), isNull(users.cognitoSub))).limit(1))[0];
    if (legacy) {
      row = (await db.update(users).set({ cognitoSub: id.sub, updatedAt: new Date() }).where(eq(users.id, legacy.id)).returning())[0];
    }
  }
  let created = false;
  if (!row) {
    created = true;
    const email = id.email && id.emailVerified ? id.email : null;
    const emailTaken = email ? (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length > 0 : false;
    row = (await db.insert(users).values({ cognitoSub: id.sub, email: emailTaken ? null : email, role: "member" }).returning())[0];
  }
  if (!row) return { error: "계정을 만들지 못했습니다. 다시 시도해 주세요." };
  if (row.blockedAt) return { error: "이용이 제한된 계정입니다. 문의해 주세요." };

  const isAdminGroup = id.groups.includes("admin");
  const role = isAdminGroup ? "admin" : row.role === "admin" ? "member" : row.role;
  let displayName = row.displayName;
  if (!displayName && id.nickname) {
    const candidate = id.nickname.trim().slice(0, 20);
    if (DISPLAY_NAME_RE.test(candidate) && (await displayNameAvailable(candidate, row.id))) displayName = candidate;
  }
  row =
    (
      await db
        .update(users)
        .set({ role, displayName, lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, row.id))
        .returning()
    )[0] ?? row;

  if (opts.admin) {
    // 관리자는 admin 그룹이면 된다 — 2단계 인증은 필수가 아니다(켜 둔 계정은 로그인 때 코드를 묻는다)
    if (!isAdminGroup) return { error: "관리자 권한이 없는 계정입니다." };
    await startCognitoAdminSession({ id: row.id, email: row.email ?? id.email, sessionVersion: row.sessionVersion });
    if (row.displayName) await startMemberSession(row.id, row.sessionVersion);
    return { redirectTo: "/admin" };
  }

  // 측정: 처음 만든 계정이면 가입, 아니면 로그인 (방식만 — 계정 정보는 넣지 않는다)
  await queueClientEvent(created ? "sign_up" : "login", { method: id.provider ? id.provider.toLowerCase() : "email" });
  if (!row.displayName) {
    await setAuthFlow({ step: "profile", uid: row.id, next: opts.next });
    return { redirectTo: "/signup/profile" };
  }
  await startMemberSession(row.id, row.sessionVersion);
  return { redirectTo: opts.next };
}

/** 첫 로그인 닉네임 정하기 — /signup/profile */
export async function finishProfile(userId: string, displayName: string): Promise<{ error?: string; sessionVersion?: number }> {
  const name = displayName.trim();
  if (!DISPLAY_NAME_RE.test(name)) return { error: "닉네임은 2~20자로, 한글·영문·숫자·공백·._- 만 쓸 수 있습니다." };
  if (!(await displayNameAvailable(name, userId))) return { error: "이미 쓰이는 닉네임입니다. 다른 닉네임을 골라 주세요." };
  const row = (
    await getDb()
      .update(users)
      .set({ displayName: name, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ sessionVersion: users.sessionVersion, blockedAt: users.blockedAt })
  )[0];
  if (!row) return { error: "계정을 찾을 수 없습니다. 다시 로그인해 주세요." };
  if (row.blockedAt) return { error: "이용이 제한된 계정입니다. 문의해 주세요." };
  return { sessionVersion: row.sessionVersion };
}
