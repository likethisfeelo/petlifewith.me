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

/** 표시용 브랜드명. 브랜드 확정 전까지 환경변수로만 관리한다 — 코드에 하드코딩 금지. */
export function siteName(): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_NAME") ?? "PetLife (가칭)";
}

/** 배포 URL. 미설정이면 로컬로 간주하고 전역 noindex 가드가 걸린다 (lib/seo.ts). */
export function siteUrl(): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
}

export function isProductionSite(): boolean {
  const url = siteUrl();
  return !url.includes("localhost") && !url.includes("127.0.0.1");
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
