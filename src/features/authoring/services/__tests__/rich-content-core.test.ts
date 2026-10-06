import { describe, expect, it } from "vitest";

import {
  collectAssetIds,
  collectLatex,
  emptyRichDoc,
  isRichDocEmpty,
  MAX_BLOCKS,
  normalizeRichDoc,
  parseRichDoc,
  plainTextFromRichDoc,
  richDocFromText,
} from "@/features/authoring/services/rich-content-core";

/**
 * Nội dung đề được lưu dưới dạng RichDoc. Bộ kiểm thử này xác nhận máy chủ chuẩn hoá dữ liệu
 * client gửi lên đúng cách: chỉ giữ nút trong danh sách trắng, giữ công thức/ảnh, và chuyển
 * được sang bản chữ thuần để ghi vào cột text cũ.
 */
describe("normalizeRichDoc", () => {
  it("giữ đoạn văn kèm định dạng được hỗ trợ và bỏ định dạng lạ", () => {
    const doc = normalizeRichDoc({
      schemaVersion: 1,
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Cho hàm số ", marks: [{ type: "bold" }] },
              {
                type: "text",
                text: "y = x^2",
                marks: [{ type: "highlight" }, { type: "italic" }],
              },
              { type: "text", text: " nghịch biến." },
            ],
          },
        ],
      },
    });

    expect(doc.doc.content).toHaveLength(1);
    const paragraph = doc.doc.content[0];
    expect(paragraph.type).toBe("paragraph");
    if (paragraph.type !== "paragraph") throw new Error("unreachable");
    expect(paragraph.content?.[0]).toEqual({
      type: "text",
      text: "Cho hàm số ",
      marks: [{ type: "bold" }],
    });
    // `highlight` không nằm trong danh sách trắng nên bị bỏ, `italic` được giữ.
    const second = paragraph.content?.[1];
    expect(second && second.type === "text" ? second.marks : null).toEqual([{ type: "italic" }]);
  });

  it("giữ công thức trong dòng và riêng một dòng, chuẩn hoá dấu $ bao ngoài", () => {
    const doc = normalizeRichDoc({
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "mathInline", attrs: { latex: "$x^2$" } }] },
          { type: "mathBlock", attrs: { latex: "$$\\int_0^1 x\\,dx$$" } },
        ],
      },
    });

    expect(doc.doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "mathInline", attrs: { latex: "x^2" } }],
    });
    expect(doc.doc.content[1]).toEqual({
      type: "mathBlock",
      attrs: { latex: "\\int_0^1 x\\,dx" },
    });
  });

  it("loại bỏ nút/thuộc tính không hỗ trợ (tiêu đề, bảng, script) và ảnh thiếu mã", () => {
    const doc = normalizeRichDoc({
      doc: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Tiêu đề" }] },
          { type: "table", content: [] },
          { type: "html", attrs: { value: "<script>alert(1)</script>" } },
          {
            type: "paragraph",
            content: [{ type: "image", attrs: { assetId: "", alt: "thiếu mã ảnh" } }],
          },
        ],
      },
    });

    expect(doc.doc.content).toHaveLength(0);
  });

  it("ép giới hạn số khối và bỏ công thức quá dài", () => {
    const manyBlocks = Array.from({ length: MAX_BLOCKS + 20 }, () => ({
      type: "paragraph",
      content: [{ type: "text", text: "câu" }],
    }));
    expect(normalizeRichDoc({ doc: { type: "doc", content: manyBlocks } }).doc.content).toHaveLength(
      MAX_BLOCKS,
    );

    const longLatex = normalizeRichDoc({
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "mathInline", attrs: { latex: "x".repeat(500) } }] },
        ],
      },
    });
    expect(longLatex.doc.content).toHaveLength(0);
  });

  it("coi đoạn văn rỗng là không có nội dung", () => {
    const doc = normalizeRichDoc({ doc: { type: "doc", content: [{ type: "paragraph" }] } });
    expect(doc.doc.content).toHaveLength(0);
  });
});

describe("parseRichDoc", () => {
  it("ném lỗi khi nội dung vượt giới hạn ký tự", () => {
    const long = "a".repeat(7_000);
    expect(() =>
      parseRichDoc(
        {
          doc: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: long }] }],
          },
        },
        "Nội dung câu hỏi",
      ),
    ).toThrowError(/quá dài/);
  });
});

describe("plainTextFromRichDoc", () => {
  it("chuyển công thức thành $…$, danh sách giữ tiền tố và ảnh thành nhãn", () => {
    const doc = normalizeRichDoc({
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Tính " },
              { type: "mathInline", attrs: { latex: "\\frac{a}{b}" } },
            ],
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Ý một" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Ý hai" }] }],
              },
            ],
          },
          { type: "image", attrs: { assetId: "asset-1", alt: "Đồ thị" } },
        ],
      },
    });

    expect(plainTextFromRichDoc(doc)).toBe(
      ["Tính $\\frac{a}{b}$", "1. Ý một", "2. Ý hai", "[Hình ảnh]"].join("\n"),
    );
  });
});

describe("collectLatex / collectAssetIds / isRichDocEmpty", () => {
  const doc = normalizeRichDoc({
    doc: {
      type: "doc",
      content: [
        { type: "mathBlock", attrs: { latex: "\\sum_{i=1}^{n} i" } },
        {
          type: "paragraph",
          content: [
            { type: "mathInline", attrs: { latex: "x^2" } },
            { type: "image", attrs: { assetId: "asset-1", alt: "Hình" } },
          ],
        },
      ],
    },
  });

  it("liệt kê công thức kèm chế độ hiển thị", () => {
    expect(collectLatex(doc)).toEqual([
      { latex: "\\sum_{i=1}^{n} i", displayMode: true },
      { latex: "x^2", displayMode: false },
    ]);
  });

  it("liệt kê mã ảnh đang được dùng", () => {
    expect(collectAssetIds(doc)).toEqual(["asset-1"]);
  });

  it("nhận biết tài liệu rỗng và tài liệu dựng từ chữ thuần", () => {
    expect(isRichDocEmpty(emptyRichDoc())).toBe(true);
    const fromText = richDocFromText("Dòng một\nDòng hai");
    expect(isRichDocEmpty(fromText)).toBe(false);
    expect(plainTextFromRichDoc(fromText)).toBe("Dòng một\nDòng hai");
  });
});
