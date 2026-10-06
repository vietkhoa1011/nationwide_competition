import type { NextResponse } from "next/server";

import { mediaAssetIdParamSchema } from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { deleteAsset, readAssetBytes } from "@/features/authoring/services/media-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Phục vụ tệp ảnh của đề. Quyền được kiểm tra lại ở từng yêu cầu (người tải lên, quản trị
 * viên, thành viên lớp khi đề đã xuất bản), nên ảnh của đề riêng tư không thể đọc bằng cách
 * đoán đường dẫn.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
): Promise<NextResponse | Response> {
  try {
    const actor = await requireAuthoringActor();
    const { assetId } = mediaAssetIdParamSchema.parse(await context.params);
    const asset = await readAssetBytes(actor, assetId);

    return new Response(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=60, must-revalidate",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Xoá ảnh khỏi kho (bị từ chối nếu ảnh đang được dùng trong nội dung đề). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { assetId } = mediaAssetIdParamSchema.parse(await context.params);
    const result = await deleteAsset(actor, assetId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
