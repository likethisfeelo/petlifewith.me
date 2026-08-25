// 오브젝트 키 → 공개 URL 조립. 서버·클라이언트 양쪽에서 쓴다.
//
// DB 에는 오브젝트 키만 저장한다 (claude.md 10-1). 도메인·버킷은 여기(환경변수)
// 한 곳에만 있어서, 나중에 CloudFront 로 옮길 때 env 하나만 바꾸면 된다.
// NEXT_PUBLIC_* 은 빌드 시 클라이언트 번들에 인라인된다.

export function assetBase(): string | undefined {
  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  return base && base.length > 0 ? base.replace(/\/$/, "") : undefined;
}

export function assetUrl(objectKey: string | null | undefined): string | undefined {
  if (!objectKey) return undefined;
  const base = assetBase();
  if (!base) return undefined;
  return `${base}/${objectKey.replace(/^\//, "")}`;
}

/** 업로드가 만든 키인지 느슨하게 확인 — 폼으로 들어온 키 값 검증용 */
export function isValidObjectKey(key: string): boolean {
  return /^[\w\-./가-힣]{3,300}$/.test(key) && !key.includes("..");
}
