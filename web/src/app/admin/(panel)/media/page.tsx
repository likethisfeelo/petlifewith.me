import { isStorageConfigured } from "@/lib/storage";
import { assetBase } from "@/lib/assets";
import { isDbConfigured } from "@/lib/db";
import { AdminPageHeader } from "../../_components/fields";
import { getMemberMediaSettings } from "@/lib/queries/settings";
import { uploadPolicyFor } from "@/lib/settings";
import { listMediaAssets } from "../../media-actions";
import { MediaManager } from "./media-manager";

export default async function AdminMediaPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const [assets, settings] = await Promise.all([listMediaAssets(120), getMemberMediaSettings()]);
  const storageReady = isStorageConfigured() && Boolean(assetBase());

  return (
    <div>
      <AdminPageHeader
        title={`미디어 ${assets.length}개`}
        description="직접 촬영·제작한 이미지와 영상만 올립니다. 인스타그램·유튜브의 이미지를 내려받아 올리는 것은 금지입니다 (운영 규칙 3-1). 숏코드를 복사해 게시글 본문에 붙여넣으세요."
      />

      {!storageReady && (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-deep">
          스토리지가 설정되지 않았습니다. <code>docker compose up -d minio</code> 로 MinIO 를 켜고 버킷을 만든 뒤,
          .env.local 의 STORAGE_* 와 NEXT_PUBLIC_ASSET_BASE_URL 을 채우세요 (docs/운영.md 5-4).
        </p>
      )}

      <div className="mt-5">
        <MediaManager
          policy={uploadPolicyFor("admin", settings)}
          assets={assets.map((a) => ({
            id: a.id,
            objectKey: a.objectKey,
            kind: a.kind,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            width: a.width,
            height: a.height,
            originalName: a.originalName,
            posterKey: a.posterKey,
            durationSec: a.durationSec,
            uploaderName: a.uploaderName,
          }))}
        />
      </div>
    </div>
  );
}
