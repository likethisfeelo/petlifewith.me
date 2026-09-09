// ============================================================
// 설정·시크릿 접근의 유일한 진입점 (claude.md 10-3)
//
// 지금은 .env.local 에서 읽지만, AWS 전환 시 이 파일의 구현만
// Secrets Manager 호출로 바꾸면 끝나야 한다.
// process.env 를 코드 곳곳에서 직접 읽지 않는다.
// ============================================================

import { taglineForTopic } from "./tagline";

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

/**
 * 브랜드 태그라인 — 기본 "반려동물의 행복한 삶, 나와 함께 - pet life with me", 놀이 토픽은 "즐거운 삶" (lib/tagline.ts).
 * env 가 있으면 토픽과 무관하게 그 문구 하나만 쓴다.
 */
export function siteTagline(topic?: string | null): string {
  return getOptionalEnv("NEXT_PUBLIC_SITE_TAGLINE") ?? taglineForTopic(topic);
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

// ---------- 애널리틱스·검증 (공개 식별자 — 시크릿이 아니다) ----------
// 값이 소스에 있어도 되는 것들이라 기본값을 코드에 두고 env 로 덮어쓴다.
// 끄려면 env 에 "off" 를 넣는다. production 이 아닌 환경에서는 config 와 무관하게
// 아예 로드하지 않는다 (app/layout.tsx).

function publicId(name: string, fallback: string): string | undefined {
  const v = getOptionalEnv(name) ?? fallback;
  return v.toLowerCase() === "off" ? undefined : v;
}

/** Google Tag Manager 컨테이너. GA4 는 이 컨테이너 안에서 태그로 설정한다(중복 집계 방지). */
export function gtmContainerId(): string | undefined {
  return publicId("NEXT_PUBLIC_GTM_ID", "GTM-TH2GC5MP");
}

/** GA4 측정 ID — GTM 을 끈 경우에만 gtag.js 를 직접 로드하는 폴백에 쓴다. */
export function gaMeasurementId(): string | undefined {
  return publicId("NEXT_PUBLIC_GA_ID", "G-54XBW1L9KE");
}

/** Google AdSense 게시자 ID (ca-pub-…). "off" 로 끈다. 로드 범위는 lib/analytics.ts isAdsExcluded */
export function adsenseClientId(): string | undefined {
  return publicId("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-6456190559289312");
}

/** Google Search Console 소유 확인 메타 태그 값 */
export function googleSiteVerification(): string | undefined {
  return publicId("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "2dOK8nJPk2N36jJdyzozSaMrVtxQKm6cqwRqPxwBbTk");
}

// ---------- 알림 (슬랙) ----------

/**
 * 예약 신청 알림용 Slack Incoming Webhook URL — 시크릿. 비어 있으면 저장만 하고 알림은 건너뛴다.
 * (.env.deploy.<stage> 에 넣으면 sst.config.ts 가 Lambda 환경변수로 주입한다)
 */
export function slackBookingWebhookUrl(): string | undefined {
  const v = getOptionalEnv("SLACK_BOOKING_WEBHOOK_URL");
  return v && /^https:\/\/hooks\.slack\.com\//.test(v) ? v : undefined;
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

export interface AdminAccount {
  /** 화면·로그에 보이는 이름. 라벨 없이 토큰만 넣으면 "admin" */
  label: string;
  token: string;
}

const LABEL_RE = /^[A-Za-z0-9._-]{1,32}$/;

/**
 * 관리자 계정 목록 — ADMIN_TOKEN 하나에 여러 개를 담는다.
 *
 *   ADMIN_TOKEN=<토큰>                       // 단일 (라벨 admin)
 *   ADMIN_TOKEN=hee:<토큰1>,partner:<토큰2>  // 사람별 계정
 *
 * 쉼표·줄바꿈으로 구분한다. 라벨은 영숫자·._- 만이고 첫 콜론까지가 라벨이다
 * (콜론 앞이 라벨 형식이 아니면 전체를 토큰으로 본다 — 문장형 비밀번호 보호).
 * **토큰 자체에는 콜론·쉼표를 넣지 않는다.** scripts/admin-token.ps1 이 만드는
 * 16진 토큰은 이 조건을 만족한다.
 * 계정을 빼고 재배포하면 그 사람의 세션도 즉시 무효가 된다 (lib/auth.ts).
 */
export function adminAccounts(): AdminAccount[] {
  const raw = getOptionalEnv("ADMIN_TOKEN");
  if (!raw) return [];
  const seen = new Set<string>();
  const accounts: AdminAccount[] = [];
  for (const entry of raw.split(/[,\n]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    let label = "admin";
    let token = trimmed;
    if (colon > 0 && LABEL_RE.test(trimmed.slice(0, colon))) {
      label = trimmed.slice(0, colon);
      token = trimmed.slice(colon + 1).trim();
    }
    if (!token || seen.has(label)) continue;
    seen.add(label);
    accounts.push({ label, token });
  }
  return accounts;
}

export function authSecret(): string | undefined {
  return getOptionalEnv("AUTH_SECRET");
}

// ---------- 스토리지 (S3 전제 — 로컬은 MinIO) ----------

export interface StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  /** 미설정이면 SDK 기본 자격 증명 체인 — Lambda 실행 역할이 여기에 해당한다. 로컬 MinIO 는 키 필수. */
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function storageConfig(): StorageConfig | undefined {
  const bucket = getOptionalEnv("STORAGE_BUCKET");
  if (!bucket) return undefined;
  const endpoint = getOptionalEnv("STORAGE_ENDPOINT");
  const accessKeyId = getOptionalEnv("STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = getOptionalEnv("STORAGE_SECRET_ACCESS_KEY");
  // 커스텀 엔드포인트(MinIO 등)는 명시적 키가 있어야 서명이 성립한다.
  if (endpoint && (!accessKeyId || !secretAccessKey)) return undefined;
  return {
    endpoint,
    region: getOptionalEnv("STORAGE_REGION") ?? "ap-northeast-2",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

// 공개 자산 URL 조립은 lib/assets.ts (클라이언트에서도 쓰므로 NEXT_PUBLIC_ 기반).
