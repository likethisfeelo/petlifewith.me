// ============================================================
// 오브젝트 스토리지 — 처음부터 S3 전제 (claude.md 10-1)
//  - 로컬 파일시스템에 쓰지 않는다. Lambda 에는 영속 디스크가 없다.
//  - 업로드는 presigned URL 패턴: 서버가 URL 발급, 클라이언트가 직접 업로드.
//  - 로컬 개발은 MinIO(S3 호환, docker-compose.yml) 를 같은 클라이언트로 쓴다.
//  - DB 에는 오브젝트 키만 저장한다. 공개 URL 조립은 lib/config.ts assetUrl().
// ============================================================
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "./config";

let client: S3Client | undefined;
let bucketName: string | undefined;

export function isStorageConfigured(): boolean {
  return storageConfig() !== undefined;
}

function getClient(): { client: S3Client; bucket: string } {
  const cfg = storageConfig();
  if (!cfg) {
    throw new Error("스토리지 미설정 — STORAGE_* 환경변수를 채우세요 (.env.example). 로컬은 MinIO(docker compose up -d minio).");
  }
  if (!client) {
    client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    bucketName = cfg.bucket;
  }
  return { client, bucket: bucketName! };
}

/** 업로드용 presigned URL 발급. 반환된 objectKey 를 DB 에 저장한다. */
export async function createUploadUrl(opts: {
  keyPrefix: string; // 예: "guides/hero"
  fileName: string;
  contentType: string;
  expiresInSec?: number;
}): Promise<{ uploadUrl: string; objectKey: string }> {
  const { client, bucket } = getClient();
  const safeName = opts.fileName.replace(/[^\w.\-가-힣]/g, "_");
  const objectKey = `${opts.keyPrefix.replace(/\/$/, "")}/${Date.now()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: opts.contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: opts.expiresInSec ?? 600 });
  return { uploadUrl, objectKey };
}
