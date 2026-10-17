"use server";

// 회원·관리자 인증 서버 액션 — 화면은 우리 것, 계정은 Cognito (lib/cognito.ts), 세션 연결은 lib/identity.ts.
//   로그인: 이메일·비밀번호 → (2단계 인증 코드) → (콘솔에서 만든 계정이면 새 비밀번호) → 사이트 세션
//   가입: 이메일·닉네임·비밀번호 → 메일 확인 코드 → 로그인 화면
//   비밀번호 찾기: 이메일 → 코드 + 새 비밀번호
//   설정: 비밀번호 변경 · 인증 앱(TOTP) 켜기/끄기 · 탈퇴
// 관리자 로그인은 같은 흐름에 admin=1 — Cognito admin 그룹이면 관리자 세션을 준다(2단계 인증은 선택).
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { clearAuthFlow, endMemberSession, getAuthFlow, logout, setAuthFlow, startMemberSession } from "@/lib/auth";
import {
  confirmForgotPassword,
  confirmSignUp,
  deleteUser,
  disableTotp,
  finishTotpSetup,
  forgotPassword,
  passwordLogin,
  resendSignUpCode,
  respondMfa,
  respondNewPassword,
  setPassword,
  signUp,
  startTotpSetup,
  totpUri,
  usernameForSub,
  verifyPassword,
  type PasswordLoginResult,
} from "@/lib/cognito";
import { cognitoConfig } from "@/lib/config";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { DISPLAY_NAME_RE, completeSignIn, finishProfile } from "@/lib/identity";
import { getCurrentMember, safeNextPath } from "@/lib/member";

const { users } = schema;

export interface AuthActionState {
  error?: string;
  notice?: string;
  saved?: boolean;
  /** 다음에 보여 줄 단계 */
  step?: "mfa" | "new_password" | "confirm" | "forgot_confirm" | "totp";
  /** 실패·다음 단계에서 다시 채울 값 (비밀번호는 넣지 않는다) */
  values?: Record<string, string>;
  /** 인증 앱 등록: 비밀 키와 QR 이미지(data URL) */
  totp?: { secret: string; qr: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function notReady(): AuthActionState | null {
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  if (!cognitoConfig()) return { error: "회원 인증이 아직 설정되지 않았습니다 (Cognito)." };
  return null;
}

/** Cognito 로그인 단계 결과 → 다음 화면 또는 세션 */
async function advance(result: PasswordLoginResult, ctx: { email: string; next: string; admin: boolean; mfaUsed: boolean }): Promise<AuthActionState> {
  const values = { email: ctx.email };
  switch (result.kind) {
    case "tokens": {
      await clearAuthFlow();
      const out = await completeSignIn(result.tokens, { next: ctx.next, admin: ctx.admin, mfaUsed: ctx.mfaUsed });
      if (out.error) return { error: out.error, values };
      redirect(out.redirectTo!);
    }
    case "mfa":
      await setAuthFlow({ step: "mfa", email: ctx.email, session: result.session, next: ctx.next, admin: ctx.admin });
      return { step: "mfa", values };
    case "new_password":
      await setAuthFlow({ step: "new_password", email: ctx.email, session: result.session, next: ctx.next, admin: ctx.admin });
      return { step: "new_password", values, notice: "처음 로그인하는 계정입니다. 새 비밀번호를 정해 주세요." };
    case "unconfirmed":
      await resendSignUpCode(ctx.email);
      return { step: "confirm", values, notice: "이메일 확인이 아직입니다. 메일로 보낸 6자리 코드를 입력해 주세요." };
    default:
      return { error: result.message, values };
  }
}

// ---------- 로그인 ----------

export async function loginAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = notReady();
  if (blocked) return blocked;
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = formData.get("admin") === "1";
  const next = admin ? "/admin" : safeNextPath(str(formData, "next"));
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요.", values: { email } };
  return advance(await passwordLogin(email, password), { email, next, admin, mfaUsed: false });
}

export async function mfaCodeAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const flow = await getAuthFlow("mfa");
  if (!flow?.email || !flow.session) return { error: "로그인 시간이 지났습니다. 처음부터 다시 로그인해 주세요." };
  const code = str(formData, "code").replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { step: "mfa", error: "인증 앱의 6자리 숫자를 입력해 주세요.", values: { email: flow.email } };
  const result = await respondMfa(flow.email, flow.session, code);
  if (result.kind === "error") return { step: "mfa", error: result.message, values: { email: flow.email } };
  return advance(result, { email: flow.email, next: flow.next ?? "/me", admin: Boolean(flow.admin), mfaUsed: true });
}

export async function newPasswordAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const flow = await getAuthFlow("new_password");
  if (!flow?.email || !flow.session) return { error: "로그인 시간이 지났습니다. 처음부터 다시 로그인해 주세요." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { step: "new_password", error: "비밀번호 확인이 일치하지 않습니다.", values: { email: flow.email } };
  const result = await respondNewPassword(flow.email, flow.session, password);
  if (result.kind === "error") return { step: "new_password", error: result.message, values: { email: flow.email } };
  return advance(result, { email: flow.email, next: flow.next ?? "/me", admin: Boolean(flow.admin), mfaUsed: false });
}

export async function memberLogoutAction(): Promise<void> {
  await endMemberSession();
  redirect("/");
}

// ---------- 가입 ----------

export async function signupAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = notReady();
  if (blocked) return blocked;
  // 닉네임은 여기서 받지 않는다 — 첫 로그인 때 온보딩 팝업에서 정한다 (components/onboarding-modal.tsx)
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email, agree: formData.get("agree") === "on" ? "on" : "" };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "이메일 형식을 확인해 주세요.", values };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { error: "비밀번호 확인이 일치하지 않습니다.", values };
  if (formData.get("agree") !== "on") return { error: "안내 사항을 확인하고 동의해 주세요.", values };

  const res = await signUp(email, password);
  if (res.error) return { error: res.error, values };
  return { step: "confirm", values: { email }, notice: `${email} 로 6자리 확인 코드를 보냈습니다.` };
}

export async function confirmSignupAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = notReady();
  if (blocked) return blocked;
  const email = str(formData, "email").toLowerCase();
  const code = str(formData, "code").replace(/\s/g, "");
  const next = safeNextPath(str(formData, "next"));
  if (!CODE_RE.test(code)) return { step: "confirm", error: "메일의 6자리 숫자를 입력해 주세요.", values: { email } };
  const res = await confirmSignUp(email, code);
  if (res.error) return { step: "confirm", error: res.error, values: { email } };
  redirect(`/login?confirmed=1&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export async function resendCodeAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = str(formData, "email").toLowerCase();
  const res = await resendSignUpCode(email);
  return { step: "confirm", values: { email }, error: res.error, notice: res.error ? undefined : "코드를 다시 보냈습니다." };
}

/** 첫 로그인(카카오 등) 닉네임 정하기 */
export async function profileAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const flow = await getAuthFlow("profile");
  if (!flow?.uid) return { error: "시간이 지났습니다. 다시 로그인해 주세요." };
  const displayName = str(formData, "displayName");
  if (formData.get("agree") !== "on") return { error: "안내 사항을 확인해 주세요.", values: { displayName } };
  const res = await finishProfile(flow.uid, displayName);
  if (res.error || res.sessionVersion === undefined) return { error: res.error ?? "저장하지 못했습니다.", values: { displayName } };
  await clearAuthFlow();
  await startMemberSession(flow.uid, res.sessionVersion);
  redirect(flow.next ?? "/me");
}

// ---------- 첫 로그인 온보딩 팝업 (components/onboarding-modal.tsx) ----------
// 페이지를 옮기지 않고 그 자리에서 닉네임을 정한다. 성공하면 회원 세션을 굽고 팝업이 페이지를 새로 읽는다.

export async function onboardingProfileAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const flow = await getAuthFlow("profile");
  if (!flow?.uid) return { error: "시간이 지났습니다. 다시 로그인해 주세요." };
  const displayName = str(formData, "displayName");
  if (formData.get("agree") !== "on") return { error: "안내 사항을 확인해 주세요.", values: { displayName } };
  const res = await finishProfile(flow.uid, displayName);
  if (res.error || res.sessionVersion === undefined) return { error: res.error ?? "저장하지 못했습니다.", values: { displayName } };
  await clearAuthFlow();
  await startMemberSession(flow.uid, res.sessionVersion);
  return { saved: true };
}

/** 팝업에서 "다음에 할게요" — 로그인을 마치지 않고 흐름만 지운다 (닉네임이 있어야 회원 세션이 생긴다) */
export async function onboardingCancelAction(): Promise<void> {
  await clearAuthFlow();
}

// ---------- 비밀번호 찾기 ----------

export async function forgotStartAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = notReady();
  if (blocked) return blocked;
  const email = str(formData, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "이메일 형식을 확인해 주세요.", values: { email } };
  const res = await forgotPassword(email);
  if (res.error) return { error: res.error, values: { email } };
  return { step: "forgot_confirm", values: { email }, notice: "가입된 이메일이면 6자리 코드를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요." };
}

export async function forgotConfirmAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = str(formData, "email").toLowerCase();
  const code = str(formData, "code").replace(/\s/g, "");
  const password = String(formData.get("password") ?? "");
  if (!CODE_RE.test(code)) return { step: "forgot_confirm", error: "메일의 6자리 숫자를 입력해 주세요.", values: { email } };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { step: "forgot_confirm", error: "비밀번호 확인이 일치하지 않습니다.", values: { email } };
  const res = await confirmForgotPassword(email, code, password);
  if (res.error) return { step: "forgot_confirm", error: res.error, values: { email } };
  // 비밀번호가 바뀌었으니 다른 기기의 사이트 세션도 끊는다
  await getDb().update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.email, email));
  redirect(`/login?reset=1&email=${encodeURIComponent(email)}`);
}

// ---------- 설정 (로그인 회원) ----------

/** 이메일로 가입한 회원만 비밀번호·인증 앱을 다룬다 (카카오 회원은 카카오 계정 보안을 따른다) */
async function emailMember() {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme%2Fsettings");
  if (!member.email) return { member, error: "카카오로 가입한 계정은 비밀번호·인증 앱 설정이 없습니다." };
  return { member, email: member.email };
}

export async function changePasswordAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { member, email, error } = await emailMember();
  if (error || !email) return { error };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (next !== String(formData.get("newPasswordConfirm") ?? "")) return { error: "새 비밀번호 확인이 일치하지 않습니다." };
  const check = await verifyPassword(email, current);
  if (!check.ok) return { error: check.error ?? "현재 비밀번호가 올바르지 않습니다." };
  const res = await setPassword(email, next);
  if (res.error) return { error: res.error };
  // 다른 기기 세션은 끊고 이 기기는 새 버전으로 이어 간다
  const row = (
    await getDb()
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, member.id))
      .returning({ v: users.sessionVersion })
  )[0];
  if (row) await startMemberSession(member.id, row.v);
  return { saved: true, notice: "비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다." };
}

export async function totpStartAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { email, error } = await emailMember();
  if (error || !email) return { error };
  const check = await verifyPassword(email, String(formData.get("password") ?? ""));
  if (!check.ok) return { error: check.error ?? "비밀번호가 올바르지 않습니다." };
  if (!check.tokens) return { error: "이미 2단계 인증이 켜져 있습니다." };
  const started = await startTotpSetup(check.tokens.accessToken);
  if (!started.secret) return { error: started.error };
  await setAuthFlow({ step: "totp_setup", email, accessToken: check.tokens.accessToken });
  const qr = await QRCode.toDataURL(totpUri(started.secret, email), { margin: 1, width: 200 });
  return { step: "totp", totp: { secret: started.secret, qr } };
}

export async function totpConfirmAction(prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const flow = await getAuthFlow("totp_setup");
  if (!flow?.accessToken) return { error: "시간이 지났습니다. 처음부터 다시 해 주세요." };
  const code = str(formData, "code").replace(/\s/g, "");
  if (!CODE_RE.test(code)) return { ...prev, step: "totp", error: "인증 앱의 6자리 숫자를 입력해 주세요." };
  const res = await finishTotpSetup(flow.accessToken, code);
  if (res.error) return { ...prev, step: "totp", error: res.error };
  await clearAuthFlow();
  return { saved: true, notice: "2단계 인증을 켰습니다. 다음 로그인부터 인증 앱 코드를 함께 입력합니다." };
}

export async function totpDisableAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { email, error } = await emailMember();
  if (error || !email) return { error };
  const check = await verifyPassword(email, String(formData.get("password") ?? ""));
  if (!check.ok) return { error: check.error ?? "비밀번호가 올바르지 않습니다." };
  const res = await disableTotp(email);
  if (res.error) return { error: res.error };
  return { saved: true, notice: "2단계 인증을 껐습니다." };
}

/**
 * 탈퇴 — Cognito 계정을 지우고 users 행은 익명화한다(쓴 글·댓글은 "탈퇴한 회원"으로 남는다).
 * 카카오 연결 끊기(Admin 키)는 카카오 연동 단계에서 붙인다.
 */
export async function deleteAccountAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme%2Fsettings");
  if (str(formData, "confirm") !== "탈퇴") return { error: "확인 칸에 '탈퇴'를 입력해 주세요." };
  if (member.email) {
    const check = await verifyPassword(member.email, String(formData.get("password") ?? ""));
    if (!check.ok) return { error: check.error ?? "비밀번호가 올바르지 않습니다." };
  }
  const db = getDb();
  const row = (await db.select({ cognitoSub: users.cognitoSub }).from(users).where(eq(users.id, member.id)).limit(1))[0];
  if (row?.cognitoSub) {
    const username = await usernameForSub(row.cognitoSub);
    if (username) {
      const res = await deleteUser(username);
      if (res.error) return { error: res.error };
    }
  }
  await db
    .update(users)
    .set({
      email: null,
      cognitoSub: null,
      passwordHash: null,
      displayName: `탈퇴회원-${member.id.slice(0, 8)}`,
      blockedAt: new Date(),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, member.id));
  await endMemberSession();
  await logout();
  redirect("/?withdrawn=1");
}
