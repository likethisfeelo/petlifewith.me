/// <reference path="./.sst/platform/config.d.ts" />
// ============================================================
// 배포 정의 — OpenNext(SST v4) + CloudFront + Lambda + S3 (claude.md 10)
//
// 스테이지
//   prod  https://petlifewith.me  (+ www/admin/service/product 별칭 — 같은 배포,
//         호스트 라우팅은 web/src/middleware.ts)
//   dev   https://dev.petlifewith.me  (NEXT_PUBLIC_SITE_ENV=preview → 전면 noindex)
//
// 시크릿·DB 접속 정보는 커밋되지 않는 .env.deploy.<stage> 에서 읽는다
// (scripts/aws-db.ps1 이 생성). 인증서는 us-east-1 발급분 ARN — 자격 증명이
// 아니라 식별자라 커밋해도 된다. RDS 는 여기서 만들지 않는다 — 상태를 가진
// 리소스는 IaC 밖에 두어 실수로 지워지지 않게 한다 (scripts/aws-db.ps1).
//
// 배포 명령은 scripts/deploy.ps1 (무프롬프트). 직접 실행:
//   pnpm exec sst deploy --stage dev
// ============================================================
// (주의) sst.config.ts 는 최상위 import 금지 — 노드 모듈은 함수 안에서 동적 import 한다.

const REGION = "ap-northeast-2";
// ACM 인증서 (us-east-1, petlifewith.me + *.petlifewith.me 와일드카드여야 한다)
const DEFAULT_CERT_ARN =
  "arn:aws:acm:us-east-1:532393804562:certificate/90e71d55-1296-4ba7-b58f-ca4c8bbe093b";

/** .env.deploy.<stage> — KEY=VALUE 단순 파서 (# 주석·빈 줄 무시, 따옴표 벗김) */
async function readDeployEnv(stage: string): Promise<Record<string, string>> {
  const { existsSync, readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const file = resolve(`.env.deploy.${stage}`);
  if (!existsSync(file)) {
    throw new Error(
      `.env.deploy.${stage} 가 없습니다. scripts/aws-db.ps1 을 먼저 실행해 DB 와 시크릿을 준비하세요.`,
    );
  }
  const env: Record<string, string> = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) env[key] = value;
  }
  for (const required of ["DATABASE_URL", "ADMIN_TOKEN", "AUTH_SECRET"]) {
    if (!env[required]) {
      throw new Error(`.env.deploy.${stage} 에 ${required} 가 없습니다 (scripts/aws-db.ps1 재실행).`);
    }
  }
  return env;
}

export default $config({
  app(input) {
    if (input.stage !== "prod" && input.stage !== "dev") {
      throw new Error(`허용된 스테이지는 prod / dev 뿐입니다 (받은 값: ${input.stage}).`);
    }
    return {
      name: "petlife",
      home: "aws",
      // prod 리소스는 sst remove 로도 지워지지 않게 보호·보존한다
      removal: input.stage === "prod" ? "retain" : "remove",
      protect: input.stage === "prod",
      providers: {
        aws: {
          region: REGION,
          // CI(액세스 키 환경변수) 에서는 프로필을 강제하지 않는다
          ...(process.env.CI || process.env.AWS_ACCESS_KEY_ID
            ? {}
            : { profile: process.env.AWS_PROFILE ?? "petlife" }),
        },
      },
    };
  },
  async run() {
    const stage = $app.stage as "prod" | "dev";
    const certArn = process.env.CERT_ARN ?? DEFAULT_CERT_ARN;
    const site =
      stage === "prod"
        ? {
            url: "https://petlifewith.me",
            siteEnv: "production",
            domain: {
              name: "petlifewith.me",
              // 같은 배포에 별칭 4개 — 호스트 라우팅은 앱 미들웨어가 한다
              aliases: [
                "www.petlifewith.me",
                "admin.petlifewith.me",
                "service.petlifewith.me",
                "product.petlifewith.me",
              ],
              cert: certArn,
              dns: sst.aws.dns(),
            },
            corsOrigins: ["https://petlifewith.me", "https://admin.petlifewith.me"],
            warm: 1,
          }
        : {
            url: "https://dev.petlifewith.me",
            siteEnv: "preview",
            domain: {
              name: "dev.petlifewith.me",
              cert: certArn,
              dns: sst.aws.dns(),
            },
            // dev 는 서브도메인 없이 경로(/admin)로 접근한다 — 와일드카드 인증서는 1단계만 커버
            corsOrigins: ["https://dev.petlifewith.me"],
            warm: 0,
          };
    const deployEnv = await readDeployEnv(stage);

    // 미디어 버킷 — presigned PUT 업로드 + 공개 읽기 (claude.md 10-1).
    // DB 에는 오브젝트 키만 저장되므로 버킷명이 바뀌어도 데이터는 그대로다.
    const media = new sst.aws.Bucket("Media", {
      access: "public",
      cors: {
        allowOrigins: site.corsOrigins,
        allowMethods: ["PUT", "GET", "HEAD"],
        allowHeaders: ["*"],
        maxAge: "1 day",
      },
    });
    const assetBase = $interpolate`https://${media.nodes.bucket.bucketRegionalDomainName}`;

    const web = new sst.aws.Nextjs("Web", {
      path: "web",
      link: [media], // 서버 함수 실행 역할에 버킷 권한 부여 (presign·삭제)
      domain: site.domain,
      warm: site.warm,
      server: {
        runtime: "nodejs22.x",
        architecture: "arm64",
        memory: "1024 MB",
      },
      environment: {
        // 기본값 — .env.deploy.<stage> 가 덮어쓸 수 있는 것
        DB_POOL_MAX: "2", // Lambda 동시 실행 x 풀 크기가 RDS 상한(micro 약 100)을 넘지 않게
        ...deployEnv,
        // 스테이지 고정값 — env 파일보다 우선한다
        NEXT_PUBLIC_SITE_URL: site.url,
        NEXT_PUBLIC_SITE_ENV: site.siteEnv,
        STORAGE_BUCKET: media.name,
        STORAGE_REGION: REGION,
        STORAGE_ENDPOINT: "", // 실제 S3 — MinIO 엔드포인트가 새어들지 않게 비운다
        STORAGE_ACCESS_KEY_ID: "", // Lambda 실행 역할(기본 자격 증명 체인)을 쓴다
        STORAGE_SECRET_ACCESS_KEY: "",
        NEXT_PUBLIC_ASSET_BASE_URL: assetBase,
      },
    });

    return {
      site: web.url,
      mediaBucket: media.name,
      mediaBaseUrl: assetBase,
    };
  },
});
