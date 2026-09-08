// ============================================================
// 비밀번호 해시 — 회원 인증(자체 이메일·비밀번호)의 유일한 해시 구현.
// Node 내장 scrypt 만 쓴다 (의존성 없음, Lambda 콜드스타트 부담 없음).
// 포맷: scrypt$N$r$p$salt(base64url)$hash(base64url)
// ============================================================
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![n, r, p].every((x) => Number.isSafeInteger(x) && x > 0)) return false;
  try {
    const salt = Buffer.from(parts[4]!, "base64url");
    const expected = Buffer.from(parts[5]!, "base64url");
    // scrypt 출력은 앞부분이 같으므로 잘린 저장값을 그대로 비교하면 통과해 버린다 — 길이를 고정한다
    if (expected.length !== KEYLEN || salt.length < 8) return false;
    const actual = scryptSync(password, salt, KEYLEN, { N: n, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** 가입·변경 시 정책 — 길이만 본다. 복잡도 강제는 오히려 약한 비밀번호를 만든다. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 쓰세요.`;
  return null;
}
