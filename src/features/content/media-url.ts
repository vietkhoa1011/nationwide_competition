/** Đường dẫn phục vụ ảnh của đề (đi qua route kiểm tra quyền, không phải tệp công khai). */
export function mediaUrl(assetId: string): string {
  return `/api/media/${assetId}`;
}

/** Mã ảnh nằm trong đường dẫn `/api/media/<assetId>` (dùng khi dán/parse HTML). */
export function parseMediaAssetId(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }
  const match = /\/api\/media\/([A-Za-z0-9_-]+)/.exec(src);
  return match ? match[1] : null;
}
