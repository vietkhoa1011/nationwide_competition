import { describe, expect, it } from "vitest";

import { sanitizePastedHtml, wrapPastedHtml } from "@/features/content/paste-sanitizer";

/**
 * Nội dung dán từ Word/website phải được lọc về đúng "từ vựng" của trình soạn thảo: chỉ giữ
 * văn bản cơ bản, danh sách, chỉ số trên/dưới, công thức và ảnh trong kho media.
 */
describe("sanitizePastedHtml", () => {
  it("bỏ script, style và thuộc tính định dạng của Word nhưng giữ chữ", () => {
    const html = sanitizePastedHtml(
      '<html><head><style>p{color:red}</style></head><body><p class="MsoNormal" style="color:red">Cho hàm số <b>y = x</b></p><script>alert(1)</script></body></html>',
    );

    expect(html).not.toContain("script");
    expect(html).not.toContain("style");
    expect(html).not.toContain("MsoNormal");
    expect(html).toContain("<p>Cho hàm số <strong>y = x</strong></p>");
  });

  it("đổi <b>/<i> thành <strong>/<em> và bỏ thẻ lạ nhưng giữ nội dung", () => {
    const html = sanitizePastedHtml(
      '<div><span data-mso="x">Đoạn</span><table><tr><td>Ô một</td><td>Ô hai</td></tr></table><i>ghi chú</i></div>',
    );

    expect(html).toContain("Đoạn");
    expect(html).toContain("Ô một");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<span");
    expect(html).toContain("<em>ghi chú</em>");
  });

  it("giữ danh sách, chỉ số trên/dưới và công thức của hệ thống", () => {
    const html = sanitizePastedHtml(
      '<ul><li>x<sup>2</sup></li><li>a<sub>n</sub></li></ul><span data-math-latex="\\frac{a}{b}" style="x">công thức</span>',
    );

    expect(html).toContain("<ul>");
    expect(html).toContain("<sup>2</sup>");
    expect(html).toContain("<sub>n</sub>");
    expect(html).toContain('data-math-latex="\\frac{a}{b}"');
    expect(html).not.toContain("style=");
  });

  it("chỉ giữ ảnh trỏ tới kho media của hệ thống", () => {
    const external = sanitizePastedHtml('<p><img src="https://example.com/anh.png" alt="ngoài"></p>');
    expect(external).not.toContain("<img");

    const internal = sanitizePastedHtml(
      '<p><img src="/api/media/asset-1" alt="Đồ thị" width="200"></p>',
    );
    expect(internal).toContain('src="/api/media/asset-1"');
    expect(internal).toContain('alt="Đồ thị"');
    expect(internal).not.toContain("width=");
  });
});

describe("wrapPastedHtml", () => {
  it("bọc nội dung không có thẻ khối vào một đoạn văn", () => {
    expect(wrapPastedHtml("chỉ có chữ")).toBe("<p>chỉ có chữ</p>");
    expect(wrapPastedHtml("<ul><li>x</li></ul>")).toBe("<ul><li>x</li></ul>");
  });
});
