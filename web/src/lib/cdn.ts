// ============================================================
// CDN(CloudFront) 캐시 비우기 — revalidatePath 의 짝.
//
// 배포 구조: CloudFront → Lambda(OpenNext). revalidatePath 는 OpenNext 의 ISR 캐시(S3)만 새로 고치고,
// 그 앞의 CloudFront 는 Next 가 붙인 s-maxage(홈 600초, 글 86400초 …) 동안 옛 HTML 을 계속 준다.
// 그래서 글을 삭제해도 홈 "새로 나온 이야기"에 남아 클릭하면 404 가 났다.
//
// 서버 액션은 next/cache 대신 여기의 revalidatePath 를 쓴다. 요청 하나에서 몇 번을 부르든
// 응답 뒤(after)에 CloudFront 무효화 한 번("/*", 경로 1개로 계산 — 월 1,000개 무료)을 보낸다.
// 경로별로 나누지 않는 이유: 홈("/")이 거의 모든 변경에 끼고, RSC 요청(?_rsc=)까지 지우려면
// 어차피 와일드카드가 필요하다. CDN 이 비어도 Lambda 가 S3 ISR 캐시에서 바로 응답한다.
//
// 권한: SST Nextjs 가 서버 함수에 cloudfront:CreateInvalidation 을 기본으로 준다.
// 배포 ID 는 sst.config.ts 에서 넘길 수 없으므로(배포 ↔ 서버 함수 순환 참조) 별칭으로 찾는다
// (cloudfront:ListDistributions — sst.config.ts permissions). CDN_DISTRIBUTION_ID 를 주면 그 값을 쓴다.
// ============================================================
import { CloudFrontClient, CreateInvalidationCommand, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { after } from "next/server";
import { apexDomain, getOptionalEnv, siteEnv } from "./config";

let client: CloudFrontClient | null = null;
let distributionId: Promise<string | null> | null = null;
/** 예약해 두고 아직 보내지 않은 무효화가 있으면 그 예약 시각 — 한 요청 안의 여러 revalidatePath 를 한 번으로 묶는다 */
let pendingSince = 0;

function cf(): CloudFrontClient {
  // CloudFront 는 글로벌 서비스 — API 엔드포인트는 us-east-1
  client ??= new CloudFrontClient({ region: "us-east-1" });
  return client;
}

/** 사이트 도메인을 별칭으로 가진 배포. 한 번 찾으면 컨테이너 수명 동안 재사용한다 */
async function lookupDistributionId(): Promise<string | null> {
  const fixed = getOptionalEnv("CDN_DISTRIBUTION_ID");
  if (fixed) return fixed;
  const host = apexDomain();
  let marker: string | undefined;
  do {
    const res = await cf().send(new ListDistributionsCommand({ Marker: marker }));
    const list = res.DistributionList;
    const hit = list?.Items?.find((d) => d.Aliases?.Items?.includes(host));
    if (hit?.Id) return hit.Id;
    marker = list?.IsTruncated ? list.NextMarker : undefined;
  } while (marker);
  return null;
}

/** CloudFront 전체 무효화. 로컬·배포 ID 미발견·오류는 조용히 넘긴다 (ISR 주기가 결국 맞춰 준다) */
export async function purgeCdn(): Promise<void> {
  if (siteEnv() === "local") return;
  try {
    distributionId ??= lookupDistributionId();
    const id = await distributionId;
    if (!id) {
      distributionId = null; // 다음에 다시 찾는다
      console.warn(`[cdn] ${apexDomain()} 별칭의 CloudFront 배포를 찾지 못해 무효화를 건너뜁니다.`);
      return;
    }
    await cf().send(
      new CreateInvalidationCommand({
        DistributionId: id,
        InvalidationBatch: {
          CallerReference: `petlife-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          Paths: { Quantity: 1, Items: ["/*"] },
        },
      }),
    );
  } catch (err) {
    distributionId = null;
    console.error("[cdn] CloudFront 무효화 실패", err);
  }
}

/**
 * next/cache 의 revalidatePath + 응답 뒤 CDN 무효화(요청당 한 번).
 * 서버 액션·라우트 핸들러에서 next/cache 대신 이걸 import 한다.
 */
export function revalidatePath(path: string, type?: "layout" | "page"): void {
  nextRevalidatePath(path, type);
  // 아직 보내지 않은 예약이 있으면 거기에 묶는다. 응답 뒤 콜백이 시작되면 풀리므로 다음 요청은 새로 예약한다.
  // (30초가 지나도 안 풀렸으면 콜백이 사라진 것으로 보고 다시 예약)
  const now = Date.now();
  if (pendingSince && now - pendingSince < 30_000) return;
  pendingSince = now;
  try {
    after(async () => {
      pendingSince = 0;
      await purgeCdn();
    });
  } catch {
    pendingSince = 0;
    // 요청 범위 밖(스크립트 등) — 기다리지 않고 보낸다
    void purgeCdn();
  }
}
