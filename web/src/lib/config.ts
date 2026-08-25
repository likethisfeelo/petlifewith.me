// ============================================================
// 설정·시크릿 접근의 유일한 진입점 (claude.md 10-3)
//
// 지금은 .env.local 에서 읽지만, AWS 전환 시 이 파일의 구현만
// Secrets Manager 호출로 바꾸면 끝나야 한다.
// process.env 를 코드 곳곳에서 직접 읽지 않는다.
// ============================================================

export async function getSecret(name: string): Promise<string> {
  // 전환 시: Secrets Manager GetSecretValue 로 교체 (캐시 포함)
  const v = process.env[name];
  if (!v) throw new Error(`시크릿 ${name} 이 설정되지 않았습니다 (.env.example 참조).`);
  return v;
}

export function getOptionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

// ---------- 사이트 ----------

/**
 * 표시용 브랜드명 — 확정: 펫라이프위드미 (pet life with me).
 * env 가 있으면 그것을 우선한다 (표기 실험·프리뷰 구분용).
 */
export function siteName(): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_NAME") ?? "펫라이프위드미";
}

/** 브랜드 태그라인 */
export function siteTagline(): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_TAGLINE") ?? "나와 함께한 행복한 인생, pet life with me";
}

/** 배포 URL. 미설정이면 로컬로 간주하고 전역 noindex 가드가 걸린다 (lib/seo.ts). */
export function siteUrl(): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
}

export type SiteEnv = "local" | "preview" | "production";

/**
 * 사이트 환경.
 * - NEXT_PUBLIC_SITE_ENV 가 명시되면 그 값 (dev.petlifewith.me 배포는 반드시 preview)
 * - 미설정이면 URL 로 추정: localhost → local, 그 외 → production
 */
export function siteEnv(): SiteEnv {
  const explicit = getOptionalEnv("NEXT_PUBLIC_SITE_ENV");
  if (explicit === "preview" || explicit === "production" || explicit === "local") return explicit;
  const url = siteUrl();
  return url.includes("localhost") || url.includes("127.0.0.1") ? "local" : "production";
}

/** 색인 허용 여부의 근거 — production 에서만 true. preview(dev 서브도메인)·local 은 전면 noindex. */
export function isProductionSite(): boolean {
  return siteEnv() === "production";
}

/** 쿠키 secure 플래그 등 전송 보안 판단은 색인 여부가 아니라 https 여부로 한다. */
export function isHttpsSite(): boolean {
  return siteUrl().startsWith("https://");
}

/** 호스트 기반 서브도메인 라우팅의 기준 도메인 (예: petlifewith.me / localhost) */
export function apexDomain(): string {
  try {
    return new URL(siteUrl()).hostname.replace(/^www\./, "");
  } catch {
    return "localhost";
  }
}

export function contactEmail(): string | undefined {
  return getOptionalEnv("NEXT_PUBLIC_CONTACT_EMAIL");
}

/** 페이지별 이미지가 없을 때 쓰는 사이트 기본 OG 이미지 (완성 URL, 1200x630 권장) */
export function defaultOgImageUrl(): string | undefined {
  return getOptionalEnv("NEXT_PUBLIC_DEFAULT_OG_IMAGE_URL");
}

// ---------- DB ----------
// 연결 문자열은 여기서만 읽는다. 나중에 RDS Proxy 를 붙일 때도 이 한 곳만 바뀐다. (claude.md 10-2)

export function databaseUrl(): string | undefined {
  return getOptionalEnv("DATABASE_URL");
}

export function dbPoolMax(): number {
  const n = Number(getOptionalEnv("DB_POOL_MAX") ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

// ---------- 인증 (로컬 임시 — Cognito 전환 시 lib/auth.ts 와 함께 교체) ----------

export function adminToken(): string | undefined {
  return getOptionalEnv("ADMIN_TOKEN");
}

export function authSecret(): string | undefined {
  return getOptionalEnv("AUTH_SECRET");
}

// ---------- 스토리지 (S3 전제 — 로컬은 MinIO) ----------

export interface StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function storageConfig(): StorageConfig | undefined {
  const bucket = getOptionalEnv("STORAGE_BUCKET");
  const accessKeyId = getOptionalEnv("STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = getOptionalEnv("STORAGE_SECRET_ACCESS_KEY");
  if (!bucket || !accessKeyId || !secretAccessKey) return undefined;
  return {
    endpoint: getOptionalEnv("STORAGE_ENDPOINT"),
    region: getOptionalEnv("STORAGE_REGION") ?? "ap-northeast-2",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

// 공개 자산 URL 조립은 lib/assets.ts (클라이언트에서도 쓰므로 NEXT_PUBLIC_ 기반).
