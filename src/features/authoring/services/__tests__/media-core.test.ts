import { describe, expect, it } from "vitest";

import {
  assertUploadAllowed,
  createStorageKey,
  detectImageMime,
  IMAGE_EXTENSIONS,
  readImageDimensions,
  sanitizeAltText,
} from "@/features/authoring/services/media-core";

/**
 * Ảnh tải lên được kiểm tra bằng chữ ký nhị phân thật của tệp, không tin `Content-Type` do
 * client khai. Bộ kiểm thử dựng các tệp giả tối thiểu cho từng định dạng.
 */

/** PNG 1×1 hợp lệ: chữ ký + IHDR với width/height ở byte 16..23. */
function pngBytes(width = 1, height = 1): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  bytes[18] = (width >> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[22] = (height >> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

function gifBytes(width = 640, height = 480): Uint8Array {
  const bytes = new Uint8Array(20);
  bytes.set([..."GIF89a"].map((char) => char.charCodeAt(0)), 0);
  bytes[6] = width & 0xff;
  bytes[7] = (width >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (height >> 8) & 0xff;
  return bytes;
}

function webpBytes(width = 300, height = 200): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([..."RIFF"].map((char) => char.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((char) => char.charCodeAt(0)), 8);
  bytes.set([..."VP8X"].map((char) => char.charCodeAt(0)), 12);
  bytes[24] = (width - 1) & 0xff;
  bytes[25] = ((width - 1) >> 8) & 0xff;
  bytes[26] = ((width - 1) >> 16) & 0xff;
  bytes[27] = (height - 1) & 0xff;
  bytes[28] = ((height - 1) >> 8) & 0xff;
  bytes[29] = ((height - 1) >> 16) & 0xff;
  return bytes;
}

function jpegBytes(width = 320, height = 240): Uint8Array {
  const bytes = new Uint8Array(20);
  bytes.set([0xff, 0xd8, 0xff], 0);
  // SOF0 tại offset 2 với độ dài segment 17.
  bytes[3] = 0xc0;
  bytes[4] = 0x00;
  bytes[5] = 0x11;
  bytes[6] = 0x08;
  bytes[7] = (height >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (width >> 8) & 0xff;
  bytes[10] = width & 0xff;
  return bytes;
}

function textBytes(text = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"): Uint8Array {
  return new Uint8Array([...text].map((char) => char.charCodeAt(0)));
}

describe("detectImageMime", () => {
  it("nhận dạng đúng PNG, GIF, WEBP và JPEG", () => {
    expect(detectImageMime(pngBytes())).toBe("image/png");
    expect(detectImageMime(gifBytes())).toBe("image/gif");
    expect(detectImageMime(webpBytes())).toBe("image/webp");
    expect(detectImageMime(jpegBytes())).toBe("image/jpeg");
  });

  it("từ chối SVG và tệp văn bản (không tin phần mở rộng hay Content-Type)", () => {
    expect(detectImageMime(textBytes())).toBeNull();
    expect(detectImageMime(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("assertUploadAllowed", () => {
  it("chấp nhận ảnh đúng loại và trong giới hạn kích thước", () => {
    expect(
      assertUploadAllowed({ byteSize: 1_024, detectedMime: "image/png", maxBytes: 4_194_304 }),
    ).toBe("image/png");
  });

  it("chặn tệp rỗng, tệp quá lớn và loại tệp không hỗ trợ", () => {
    expect(() =>
      assertUploadAllowed({ byteSize: 0, detectedMime: "image/png", maxBytes: 4_194_304 }),
    ).toThrowError(/đang rỗng/);

    expect(() =>
      assertUploadAllowed({ byteSize: 5_000_000, detectedMime: "image/png", maxBytes: 4_194_304 }),
    ).toThrowError(/vượt quá giới hạn/);

    expect(() =>
      assertUploadAllowed({ byteSize: 1_024, detectedMime: null, maxBytes: 4_194_304 }),
    ).toThrowError(/SVG không được chấp nhận/);
  });
});

describe("readImageDimensions", () => {
  it("đọc được kích thước của PNG, GIF, WEBP và JPEG", () => {
    expect(readImageDimensions("image/png", pngBytes(120, 80))).toEqual({
      width: 120,
      height: 80,
    });
    expect(readImageDimensions("image/gif", gifBytes(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
    expect(readImageDimensions("image/webp", webpBytes(300, 200))).toEqual({
      width: 300,
      height: 200,
    });
    expect(readImageDimensions("image/jpeg", jpegBytes(320, 240))).toEqual({
      width: 320,
      height: 240,
    });
  });
});

describe("sanitizeAltText / createStorageKey", () => {
  it("bỏ ký tự điều khiển, gộp khoảng trắng và cắt độ dài", () => {
    expect(sanitizeAltText("  Đồ thị\n hàm   số  ")).toBe("Đồ thị hàm số");
    expect(sanitizeAltText("   ")).toBeNull();
    expect(sanitizeAltText(null)).toBeNull();
    expect(sanitizeAltText("a".repeat(500))?.length).toBe(200);
  });

  it("sinh tên tệp ngẫu nhiên với phần mở rộng theo loại ảnh", () => {
    const key = createStorageKey("image/webp");
    expect(key).toMatch(/^[0-9a-f]{32}\.webp$/);
    expect(IMAGE_EXTENSIONS["image/jpeg"]).toBe("jpg");
  });
});
