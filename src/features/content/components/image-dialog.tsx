"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import type { MediaAssetDto } from "@/features/authoring/types";
import { mediaUrl } from "@/features/content/media-url";
import { ApiClientError, apiClient } from "@/lib/api-client";

export interface ImageSelection {
  assetId: string;
  alt: string | null;
}

/**
 * Hộp thoại chèn/thay ảnh: chọn tệp, xem trước, nhập mô tả thay thế (alt) rồi tải lên kho
 * media của đề. Ảnh được gửi qua `POST /api/media` (máy chủ kiểm tra quyền, loại tệp thật
 * và kích thước) và nội dung chỉ lưu `assetId` — không nhúng base64.
 */
export function ImageDialog({
  open,
  examId,
  initial,
  onCancel,
  onInsert,
  onRemoveFromContent,
}: {
  open: boolean;
  examId: string;
  /** Ảnh đang chọn trong nội dung (null = chèn ảnh mới). */
  initial: ImageSelection | null;
  onCancel: () => void;
  onInsert: (image: ImageSelection) => void;
  /** Xoá ảnh khỏi NỘI DUNG (tệp vẫn nằm trong kho để đề/phiên bản khác dùng lại). */
  onRemoveFromContent: () => void;
}) {
  const [state, setState] = useState<{
    key: string;
    alt: string;
    file: File | null;
    error: string | null;
    uploading: boolean;
  }>({ key: "init", alt: initial?.alt ?? "", file: null, error: null, uploading: false });
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Trạng thái được suy ra theo "khoá nguồn" (ảnh đang chọn) nên mở hộp thoại cho ảnh khác là
   * tự nạp lại giá trị mặc định, không cần setState trong useEffect.
   */
  const sourceKey = open ? (initial?.assetId ?? "new") : "closed";
  const active =
    state.key === sourceKey
      ? state
      : { key: sourceKey, alt: initial?.alt ?? "", file: null, error: null, uploading: false };
  const { alt, file, error, uploading } = active;
  const setAlt = (value: string) => setState({ ...active, alt: value });
  const setFile = (value: File | null) => setState({ ...active, file: value, error: null });
  const setError = (value: string | null) => setState({ ...active, error: value });
  const setUploading = (value: boolean) => setState({ ...active, uploading: value });

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Chỉ thu hồi URL xem trước cũ khi đổi tệp — không đặt state trong effect.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) {
    return null;
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Hãy chọn một tệp ảnh (PNG, JPEG, GIF hoặc WEBP).");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("examId", examId);
      if (alt.trim()) {
        formData.append("alt", alt.trim());
      }

      const asset = await apiClient.upload<MediaAssetDto>("/api/media", formData);
      onInsert({ assetId: asset.id, alt: asset.alt ?? null });
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiClientError
          ? uploadError.message
          : "Không tải được ảnh lên. Vui lòng thử lại.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chèn ảnh"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            {initial ? "Thay ảnh trong nội dung" : "Chèn ảnh"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600"
            />
          </div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Ảnh xem trước"
              className="max-h-48 w-auto rounded-xl border border-slate-200"
            />
          ) : initial ? (
            <img
              src={mediaUrl(initial.assetId)}
              alt={initial.alt ?? "Ảnh hiện tại"}
              className="max-h-48 w-auto rounded-xl border border-slate-200"
            />
          ) : null}

          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="image-alt">
              Mô tả thay thế (alt)
            </label>
            <input
              id="image-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Ví dụ: Đồ thị hàm số bậc ba cắt trục hoành tại ba điểm"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Mô tả giúp học sinh dùng trình đọc màn hình hiểu nội dung hình ảnh.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {initial ? (
            <Button variant="danger" onClick={onRemoveFromContent} disabled={uploading}>
              Xoá ảnh khỏi nội dung
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onCancel} disabled={uploading}>
            Huỷ
          </Button>
          <Button onClick={() => void handleUpload()} disabled={uploading || !file}>
            {uploading ? <Spinner /> : null}
            {initial ? "Tải lên và thay ảnh" : "Tải lên và chèn"}
          </Button>
        </div>
      </div>
    </div>
  );
}
