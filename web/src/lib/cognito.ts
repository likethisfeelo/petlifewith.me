// ============================================================
// Cognito 사용자 풀 호출 — 회원·관리자 인증의 유일한 AWS 진입점 (claude.md 10-5).
//
// 화면은 우리 사이트(app/login, app/signup …), 이 파일이 뒤에서 Cognito API 를 부른다.
//   - 이메일 가입·확인 코드·로그인(USER_PASSWORD_AUTH)·2단계 인증(TOTP)·비밀번호 찾기
//   - 카카오: Cognito OAuth 엔드포인트(identity_provider=Kakao) → /api/auth/callback 에서 코드 교환
//   - 관리자 API(Admin*): 서버 함수 역할에 sst link 로 cognito-idp:* 가 붙어 있다
// 토큰은 로그인 순간에만 쓴다 — ID 토큰을 검증해 users 행과 맞춘 뒤 우리 세션 쿠키를 굽는다(lib/identity.ts).
// 사이트 세션이 Cognito 토큰 수명과 묶이지 않아 ISR·/api/me 구조가 그대로 유지된다.
// ============================================================
import { createHmac } from "node:crypto";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminSetUserPasswordCommand,
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ListUsersCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SetUserMFAPreferenceCommand,
  SignUpCommand,
  VerifySoftwareTokenCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { cognitoConfig, type CognitoConfig } from "./config";

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
}

/** 검증된 ID 토큰에서 쓰는 값만 */
export interface CognitoIdentity {
  sub: string;
  /** Cognito 안의 사용자 이름 — 이메일 가입은 sub(UUID), 카카오는 "Kakao_<회원번호>" */
  username: string;
  email: string | null;
  emailVerified: boolean;
  nickname: string | null;
  groups: string[];
  /** 외부 로그인 공급자 (카카오면 "Kakao"), 이메일 가입은 null */
  provider: string | null;
}

export type PasswordLoginResult =
  | { kind: "tokens"; tokens: CognitoTokens }
  | { kind: "mfa"; session: string }
  | { kind: "new_password"; session: string }
  | { kind: "unconfirmed" }
  | { kind: "error"; message: string };

let client: CognitoIdentityProviderClient | null = null;
let clientRegion = "";

export function requireCognito(): CognitoConfig {
  const cfg = cognitoConfig();
  if (!cfg) throw new Error("Cognito 미설정 — COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID / COGNITO_CLIENT_SECRET");
  return cfg;
}

function idp(cfg: CognitoConfig): CognitoIdentityProviderClient {
  if (!client || clientRegion !== cfg.region) {
    client = new CognitoIdentityProviderClient({ region: cfg.region });
    clientRegion = cfg.region;
  }
  return client;
}

/** 기밀 클라이언트 요청 서명 — base64(HMAC-SHA256(secret, username + clientId)) */
export function secretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(username + clientId).digest("base64");
}

/** Cognito 예외 → 화면 문구. 계정 존재 여부가 드러나지 않게 로그인 실패는 한 문구로 묶는다 */
export function cognitoErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "UsernameExistsException":
      return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.";
    case "InvalidPasswordException":
      return "비밀번호는 8자 이상이고 숫자를 하나 이상 넣어 주세요.";
    case "CodeMismatchException":
      return "코드가 맞지 않습니다. 다시 확인해 주세요.";
    case "ExpiredCodeException":
      return "코드가 만료됐습니다. 새 코드를 받아 주세요.";
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "시도가 너무 많습니다. 잠시 후 다시 해 주세요.";
    case "EnableSoftwareTokenMFAException":
      return "인증 앱 코드가 맞지 않습니다. 앱의 현재 6자리를 입력해 주세요.";
    case "InvalidParameterException":
      return "입력값을 확인해 주세요.";
    default:
      console.error("[cognito]", name, (e as Error)?.message);
      return "잠시 문제가 생겼습니다. 다시 시도해 주세요.";
  }
}

function toTokens(r: AuthenticationResultType | undefined): CognitoTokens | null {
  if (!r?.IdToken || !r.AccessToken) return null;
  return { idToken: r.IdToken, accessToken: r.AccessToken };
}

// ---------- 가입 ----------

export async function signUp(email: string, password: string, nickname?: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(
      new SignUpCommand({
        ClientId: cfg.clientId,
        SecretHash: secretHash(email, cfg.clientId, cfg.clientSecret),
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }, ...(nickname ? [{ Name: "nickname", Value: nickname }] : [])],
      }),
    );
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

export async function confirmSignUp(email: string, code: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(
      new ConfirmSignUpCommand({
        ClientId: cfg.clientId,
        SecretHash: secretHash(email, cfg.clientId, cfg.clientSecret),
        Username: email,
        ConfirmationCode: code,
      }),
    );
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

export async function resendSignUpCode(email: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(
      new ResendConfirmationCodeCommand({ ClientId: cfg.clientId, SecretHash: secretHash(email, cfg.clientId, cfg.clientSecret), Username: email }),
    );
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

// ---------- 로그인 ----------

export async function passwordLogin(email: string, password: string): Promise<PasswordLoginResult> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: cfg.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: secretHash(email, cfg.clientId, cfg.clientSecret) },
      }),
    );
    if (res.ChallengeName === "SOFTWARE_TOKEN_MFA" && res.Session) return { kind: "mfa", session: res.Session };
    if (res.ChallengeName === "NEW_PASSWORD_REQUIRED" && res.Session) return { kind: "new_password", session: res.Session };
    const tokens = toTokens(res.AuthenticationResult);
    if (tokens) return { kind: "tokens", tokens };
    return { kind: "error", message: "지원하지 않는 로그인 단계입니다. 문의해 주세요." };
  } catch (e) {
    if ((e as { name?: string })?.name === "UserNotConfirmedException") return { kind: "unconfirmed" };
    return { kind: "error", message: cognitoErrorMessage(e) };
  }
}

/** 2단계 인증 코드 응답 */
export async function respondMfa(email: string, session: string, code: string): Promise<PasswordLoginResult> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(
      new RespondToAuthChallengeCommand({
        ClientId: cfg.clientId,
        ChallengeName: "SOFTWARE_TOKEN_MFA",
        Session: session,
        ChallengeResponses: { USERNAME: email, SOFTWARE_TOKEN_MFA_CODE: code, SECRET_HASH: secretHash(email, cfg.clientId, cfg.clientSecret) },
      }),
    );
    const tokens = toTokens(res.AuthenticationResult);
    return tokens ? { kind: "tokens", tokens } : { kind: "error", message: "로그인을 마치지 못했습니다. 다시 시도해 주세요." };
  } catch (e) {
    return { kind: "error", message: cognitoErrorMessage(e) };
  }
}

/** 관리자가 콘솔에서 만든 계정의 첫 로그인 — 임시 비밀번호를 새 비밀번호로 */
export async function respondNewPassword(email: string, session: string, newPassword: string): Promise<PasswordLoginResult> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(
      new RespondToAuthChallengeCommand({
        ClientId: cfg.clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword, SECRET_HASH: secretHash(email, cfg.clientId, cfg.clientSecret) },
      }),
    );
    if (res.ChallengeName === "SOFTWARE_TOKEN_MFA" && res.Session) return { kind: "mfa", session: res.Session };
    const tokens = toTokens(res.AuthenticationResult);
    return tokens ? { kind: "tokens", tokens } : { kind: "error", message: "로그인을 마치지 못했습니다. 다시 시도해 주세요." };
  } catch (e) {
    return { kind: "error", message: cognitoErrorMessage(e) };
  }
}

/**
 * 현재 비밀번호 확인 — 설정 변경 전 재확인용. 2단계 인증 계정은 코드 단계가 나오는 것 자체가
 * 비밀번호가 맞았다는 뜻이다. 토큰이 나오면 함께 돌려준다(인증 앱 등록에 액세스 토큰이 필요).
 */
export async function verifyPassword(email: string, password: string): Promise<{ ok: boolean; tokens?: CognitoTokens; error?: string }> {
  const r = await passwordLogin(email, password);
  if (r.kind === "tokens") return { ok: true, tokens: r.tokens };
  if (r.kind === "mfa" || r.kind === "new_password") return { ok: true };
  if (r.kind === "unconfirmed") return { ok: false, error: "이메일 확인이 끝나지 않은 계정입니다." };
  return { ok: false, error: r.kind === "error" ? (r.message.startsWith("이메일 또는") ? "현재 비밀번호가 올바르지 않습니다." : r.message) : undefined };
}

// ---------- 비밀번호 찾기 ----------

export async function forgotPassword(email: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(new ForgotPasswordCommand({ ClientId: cfg.clientId, SecretHash: secretHash(email, cfg.clientId, cfg.clientSecret), Username: email }));
    return {};
  } catch (e) {
    // 없는 계정이어도 같은 화면으로 — 계정 존재 여부를 드러내지 않는다
    if ((e as { name?: string })?.name === "UserNotFoundException") return {};
    return { error: cognitoErrorMessage(e) };
  }
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(
      new ConfirmForgotPasswordCommand({
        ClientId: cfg.clientId,
        SecretHash: secretHash(email, cfg.clientId, cfg.clientSecret),
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      }),
    );
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

// ---------- 2단계 인증 (인증 앱 TOTP) ----------

export async function startTotpSetup(accessToken: string): Promise<{ secret?: string; error?: string }> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
    return res.SecretCode ? { secret: res.SecretCode } : { error: "인증 앱 등록을 시작하지 못했습니다." };
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

export async function finishTotpSetup(accessToken: string, code: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(new VerifySoftwareTokenCommand({ AccessToken: accessToken, UserCode: code, FriendlyDeviceName: "petlifewith.me" }));
    if (res.Status !== "SUCCESS") return { error: "인증 앱 코드가 맞지 않습니다." };
    await idp(cfg).send(new SetUserMFAPreferenceCommand({ AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } }));
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

export async function disableTotp(username: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(
      new AdminSetUserMFAPreferenceCommand({ UserPoolId: cfg.userPoolId, Username: username, SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false } }),
    );
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

export async function hasTotp(username: string): Promise<boolean> {
  const cfg = requireCognito();
  try {
    const res = await idp(cfg).send(new AdminGetUserCommand({ UserPoolId: cfg.userPoolId, Username: username }));
    return (res.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA");
  } catch {
    return false;
  }
}

/** otpauth:// — 인증 앱 QR 에 담는 값 */
export function totpUri(secret: string, account: string): string {
  const issuer = "펫라이프위드미";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

// ---------- 관리자 API ----------

export async function setPassword(username: string, newPassword: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(new AdminSetUserPasswordCommand({ UserPoolId: cfg.userPoolId, Username: username, Password: newPassword, Permanent: true }));
    return {};
  } catch (e) {
    return { error: cognitoErrorMessage(e) };
  }
}

/** sub 로 Cognito 사용자 이름 찾기 — 카카오 계정은 사용자 이름이 sub 가 아니다 */
export async function usernameForSub(sub: string): Promise<string | null> {
  const cfg = requireCognito();
  const res = await idp(cfg).send(new ListUsersCommand({ UserPoolId: cfg.userPoolId, Filter: `sub = "${sub.replace(/"/g, "")}"`, Limit: 1 }));
  return res.Users?.[0]?.Username ?? null;
}

export async function deleteUser(username: string): Promise<{ error?: string }> {
  const cfg = requireCognito();
  try {
    await idp(cfg).send(new AdminDeleteUserCommand({ UserPoolId: cfg.userPoolId, Username: username }));
    return {};
  } catch (e) {
    if ((e as { name?: string })?.name === "UserNotFoundException") return {};
    return { error: cognitoErrorMessage(e) };
  }
}

// ---------- 토큰 검증 · 카카오(OAuth) ----------

let verifier: ReturnType<typeof CognitoJwtVerifier.create<{ userPoolId: string; tokenUse: "id"; clientId: string }>> | null = null;
let verifierKey = "";

export async function verifyIdToken(idToken: string): Promise<CognitoIdentity | null> {
  const cfg = requireCognito();
  const key = `${cfg.userPoolId}:${cfg.clientId}`;
  if (!verifier || verifierKey !== key) {
    verifier = CognitoJwtVerifier.create({ userPoolId: cfg.userPoolId, tokenUse: "id", clientId: cfg.clientId });
    verifierKey = key;
  }
  try {
    const p = (await verifier.verify(idToken)) as Record<string, unknown>;
    const identities = Array.isArray(p.identities) ? (p.identities as Array<{ providerName?: string }>) : [];
    return {
      sub: String(p.sub),
      username: String(p["cognito:username"] ?? p.sub),
      email: typeof p.email === "string" ? p.email.toLowerCase() : null,
      emailVerified: p.email_verified === true || p.email_verified === "true",
      nickname: typeof p.nickname === "string" ? p.nickname : null,
      groups: Array.isArray(p["cognito:groups"]) ? (p["cognito:groups"] as string[]) : [],
      provider: identities[0]?.providerName ?? null,
    };
  } catch (e) {
    console.error("[cognito] ID 토큰 검증 실패", (e as Error)?.message);
    return null;
  }
}

/** 카카오로 보내는 주소 — Cognito 가 카카오 인증을 대신 받아 우리 콜백으로 코드를 돌려준다 */
export function kakaoAuthorizeUrl(state: string, redirectUri: string): string | null {
  const cfg = cognitoConfig();
  if (!cfg?.domainUrl || !cfg.kakaoProvider) return null;
  const q = new URLSearchParams({
    identity_provider: cfg.kakaoProvider,
    client_id: cfg.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
  });
  return `${cfg.domainUrl}/oauth2/authorize?${q.toString()}`;
}

export function isKakaoEnabled(): boolean {
  const cfg = cognitoConfig();
  return Boolean(cfg?.domainUrl && cfg.kakaoProvider);
}

export async function exchangeCode(code: string, redirectUri: string): Promise<CognitoTokens | null> {
  const cfg = requireCognito();
  if (!cfg.domainUrl) return null;
  const res = await fetch(`${cfg.domainUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: cfg.clientId, code, redirect_uri: redirectUri }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[cognito] 코드 교환 실패", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { id_token?: string; access_token?: string };
  return data.id_token && data.access_token ? { idToken: data.id_token, accessToken: data.access_token } : null;
}
