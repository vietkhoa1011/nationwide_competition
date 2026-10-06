/**
 * Làm sạch HTML dán từ Word/website trước khi ProseMirror phân tích.
 *
 * Chỉ giữ những thẻ cơ bản mà editor hỗ trợ; mọi `style`, `class`, thẻ lạ (bảng, nhúng,
 * script…) đều bị loại bỏ. Nhờ vậy nội dung dán vào luôn nằm trong schema của editor thay
 * vì mang theo định dạng không kiểm soát được.
 *
 * Hàm thuần (không dùng DOM) nên kiểm thử được trực tiếp bằng Vitest.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "sup",
  "sub",
  "span",
  "div",
  "img",
]);

/** Thẻ được phép giữ thuộc tính (math và ảnh cần dữ liệu để dựng lại node). */
const ATTRIBUTE_ALLOWLIST: Record<string, readonly string[]> = {
  span: ["data-math-latex"],
  div: ["data-math-block-latex"],
  img: ["src", "alt"],
};

const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "li", "br"]);

export function sanitizePastedHtml(html: string): string {
  let output = html;

  // 1. Bỏ hoàn toàn nội dung không bao giờ được dán vào đề.
  output = output
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|title|meta|link|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|meta|link|iframe|object|embed)[^>]*>/gi, "");

  // 2. Chuẩn hoá các thẻ in đậm/nghiêng thường gặp của Word.
  output = output.replace(/<(\/?)b(\s[^>]*)?>/gi, "<$1strong>").replace(/<(\/?)i(\s[^>]*)?>/gi, "<$1em>");

  // 3. Xử lý từng thẻ: giữ thẻ trong danh sách trắng, còn lại bỏ thẻ nhưng giữ nội dung.
  output = output.replace(/<\/?([a-zA-Z0-9]+)((?:\s+[^>]*)?)\/?>/g, (match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClosing = match.startsWith("</");

    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    if (isClosing) {
      return `</${tag}>`;
    }

    const allowed = ATTRIBUTE_ALLOWLIST[tag] ?? [];
    const kept = allowed
      .map((name) => {
        const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
        const found = pattern.exec(rawAttrs);
        if (!found) {
          return null;
        }
        const value = (found[2] ?? found[3] ?? "").replace(/"/g, "&quot;");
        return `${name}="${value}"`;
      })
      .filter((item): item is string => item !== null);

    // `span`/`div` chỉ được giữ khi là công thức của hệ thống; các thẻ bọc của Word (kể cả
    // `<span style="font-weight:bold">`) bị bỏ nhưng vẫn giữ phần chữ bên trong.
    if (tag === "span" && !kept.some((attribute) => attribute.startsWith("data-math-latex="))) {
      return "";
    }
    if (
      tag === "div" &&
      !kept.some((attribute) => attribute.startsWith("data-math-block-latex="))
    ) {
      return "";
    }

    // Ảnh ngoài hệ thống không được nhúng: chỉ nhận ảnh trỏ tới kho media của ứng dụng.
    if (tag === "img") {
      const source = kept.find((attribute) => attribute.startsWith("src=")) ?? "";
      if (!source.includes('src="/api/media/')) {
        return "";
      }
    }

    return kept.length > 0 ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
  });

  // 4. Bảng/biểu mẫu của Word: giữ nội dung nhưng tách thành dòng để không dính chữ.
  output = output.replace(/<\/(td|th|tr|table|h[1-6])>/gi, " ").replace(/<(td|th|table|tbody|thead|h[1-6])[^>]*>/gi, " ");

  // 5. Gộp khoảng trắng thừa nhưng giữ xuống dòng giữa các khối.
  output = output.replace(/[ \t]{2,}/g, " ").replace(/\s+<!---->\s+/g, " ");

  return output.trim();
}

/** Bọc một chuỗi HTML dán vào thành đúng một khối nếu bản gốc không có thẻ khối nào. */
export function wrapPastedHtml(html: string): string {
  const hasBlock = [...BLOCK_TAGS].some((tag) => new RegExp(`<${tag}[\\s>]`, "i").test(html));
  return hasBlock ? html : `<p>${html}</p>`;
}
