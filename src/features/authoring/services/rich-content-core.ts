import { AppError } from "@/lib/errors";

/**
 * Định dạng nội dung có cấu trúc (RichDoc) dùng cho mọi vùng nội dung của đề thi:
 * hướng dẫn làm bài, câu hỏi, phương án, ý đúng/sai, lời giải.
 *
 * Mô-đun này KHÔNG import Prisma, Next.js hay KaTeX: nó chỉ chuẩn hoá/kiểm tra JSON
 * nên có thể kiểm thử thuần bằng Vitest và chạy được ở cả server lẫn trình duyệt.
 *
 * ```
 * { schemaVersion: 1, doc: { type: "doc", content: [ …block ] } }
 * ```
 * Cây bên trong theo đúng JSON của ProseMirror/Tiptap (editor dùng ở client), nhưng
 * máy chủ chỉ chấp nhận những nút nằm trong danh sách trắng dưới đây — mọi nút hoặc
 * thuộc tính khác bị loại bỏ, nên không thể lách HTML/script tuỳ ý vào nội dung đề.
 */

export const RICH_DOC_SCHEMA_VERSION = 1;

/** Giới hạn độ dài nguồn LaTeX của một công thức (dùng chung với `latex-core`). */
export const MAX_LATEX_LENGTH = 400;
export const MAX_BLOCKS = 200;
export const MAX_INLINE_PER_BLOCK = 400;
export const MAX_TEXT_LENGTH = 6_000;
export const MAX_LIST_ITEMS = 50;
export const MAX_IMAGE_WIDTH = 1_200;

export interface RichTextMark {
  type: "bold" | "italic" | "superscript" | "subscript";
}

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export interface RichMathNode {
  type: "mathInline";
  attrs: { latex: string };
}

export interface RichImageNode {
  type: "image";
  attrs: { assetId: string; alt?: string; width?: number };
}

export type RichInline = RichTextNode | RichMathNode | RichImageNode;

export interface RichParagraphNode {
  type: "paragraph";
  content?: RichInline[];
}

export interface RichListItemNode {
  type: "listItem";
  content: RichParagraphNode[];
}

export interface RichListNode {
  type: "bulletList" | "orderedList";
  attrs?: { start?: number };
  content: RichListItemNode[];
}

export interface RichMathBlockNode {
  type: "mathBlock";
  attrs: { latex: string };
}

export interface RichImageBlockNode {
  type: "image";
  attrs: { assetId: string; alt?: string; width?: number };
}

export type RichBlock =
  | RichParagraphNode
  | RichListNode
  | RichMathBlockNode
  | RichImageBlockNode;

export interface RichDoc {
  schemaVersion: number;
  doc: { type: "doc"; content: RichBlock[] };
}

const TEXT_MARKS: readonly string[] = ["bold", "italic", "superscript", "subscript"];

export function emptyRichDoc(): RichDoc {
  return { schemaVersion: RICH_DOC_SCHEMA_VERSION, doc: { type: "doc", content: [] } };
}

/** Bọc một đoạn chữ thuần (dữ liệu cũ trong `Question.content`) thành RichDoc. */
export function richDocFromText(text: string): RichDoc {
  const paragraphs = text
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    schemaVersion: RICH_DOC_SCHEMA_VERSION,
    doc: {
      type: "doc",
      content: paragraphs.map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeText(value: string): string {
  // Chuẩn hoá khoảng trắng nhưng giữ nguyên dấu tiếng Việt và ký hiệu toán học.
  return value.replace(/\u00a0/g, " ");
}

function normalizeMarks(raw: unknown): RichTextMark[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const marks: RichTextMark[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = asString(item.type);
    if (type && TEXT_MARKS.includes(type) && !marks.some((mark) => mark.type === type)) {
      marks.push({ type: type as RichTextMark["type"] });
    }
  }
  return marks.length > 0 ? marks : undefined;
}

/** Chuẩn hoá nguồn LaTeX: bỏ dấu `$`/`\[`…`\]` bao ngoài và cắt khoảng trắng thừa. */
export function normalizeLatexSource(raw: string): string {
  let value = raw.trim();
  const displayWrapper = /^\$\$([\s\S]*)\$\$$/.exec(value) ?? /^\\\[([\s\S]*)\\\]$/.exec(value);
  if (displayWrapper) {
    value = displayWrapper[1].trim();
  } else {
    const inlineWrapper = /^\$([^$]+)\$$/.exec(value) ?? /^\\\(([\s\S]*)\\\)$/.exec(value);
    if (inlineWrapper) {
      value = inlineWrapper[1].trim();
    }
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInline(raw: unknown): RichInline | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = asString(raw.type);

  if (type === "text") {
    const text = asString(raw.text);
    if (text === null || text.length === 0) {
      return null;
    }
    const marks = normalizeMarks(raw.marks);
    const node: RichTextNode = { type: "text", text: normalizeText(text) };
    return marks ? { ...node, marks } : node;
  }

  if (type === "mathInline" || type === "mathBlock") {
    const attrs = isRecord(raw.attrs) ? raw.attrs : {};
    const latex = normalizeLatexSource(asString(attrs.latex) ?? "");
    if (latex.length === 0 || latex.length > MAX_LATEX_LENGTH) {
      return null;
    }
    return { type: "mathInline", attrs: { latex } };
  }

  if (type === "image") {
    const attrs = isRecord(raw.attrs) ? raw.attrs : {};
    const assetId = asString(attrs.assetId)?.trim();
    if (!assetId) {
      return null;
    }
    const alt = asString(attrs.alt)?.trim();
    const width = typeof attrs.width === "number" ? attrs.width : undefined;
    return {
      type: "image",
      attrs: {
        assetId,
        ...(alt ? { alt: alt.slice(0, 200) } : {}),
        ...(width && width > 0 ? { width: Math.min(Math.round(width), MAX_IMAGE_WIDTH) } : {}),
      },
    };
  }

  return null;
}

function normalizeParagraph(raw: unknown): RichParagraphNode | null {
  if (!isRecord(raw) || asString(raw.type) !== "paragraph") {
    return null;
  }

  const content = Array.isArray(raw.content)
    ? raw.content
        .slice(0, MAX_INLINE_PER_BLOCK)
        .map(normalizeInline)
        .filter((node): node is RichInline => node !== null)
    : [];

  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

function normalizeList(
  raw: Record<string, unknown>,
  type: "bulletList" | "orderedList",
): RichListNode | null {
  const items = Array.isArray(raw.content) ? raw.content.slice(0, MAX_LIST_ITEMS) : [];
  const content: RichListItemNode[] = [];

  for (const item of items) {
    if (!isRecord(item) || asString(item.type) !== "listItem") {
      continue;
    }
    const paragraphs = Array.isArray(item.content)
      ? item.content.map(normalizeParagraph).filter((node): node is RichParagraphNode => node !== null)
      : [];
    if (paragraphs.length > 0) {
      content.push({ type: "listItem", content: paragraphs });
    }
  }

  if (content.length === 0) {
    return null;
  }

  const start =
    type === "orderedList" && isRecord(raw.attrs) && typeof raw.attrs.start === "number"
      ? Math.max(1, Math.round(raw.attrs.start))
      : undefined;

  return start ? { type, attrs: { start }, content } : { type, content };
}

function normalizeBlock(raw: unknown): RichBlock | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = asString(raw.type);
  if (type === "paragraph") {
    const paragraph = normalizeParagraph(raw);
    return paragraph && paragraph.content ? paragraph : null;
  }
  if (type === "bulletList" || type === "orderedList") {
    return normalizeList(raw, type);
  }
  if (type === "mathBlock") {
    const inline = normalizeInline({ type: "mathInline", attrs: raw.attrs });
    return inline && inline.type === "mathInline"
      ? { type: "mathBlock", attrs: { latex: inline.attrs.latex } }
      : null;
  }
  if (type === "image") {
    const inline = normalizeInline(raw);
    return inline && inline.type === "image" ? { type: "image", attrs: inline.attrs } : null;
  }
  // Nút không nằm trong danh sách trắng (bảng, rubric, code block, nhúng ngoài…) bị bỏ.
  return null;
}

/**
 * Chuẩn hoá dữ liệu RichDoc nhận từ client/API: giữ đúng những nút được hỗ trợ,
 * loại bỏ phần còn lại (kể cả nội dung dán từ Word/website), đồng thời áp giới hạn
 * số khối và số nút nội tuyến của mỗi khối.
 */
export function normalizeRichDoc(raw: unknown): RichDoc {
  const source = isRecord(raw) && isRecord(raw.doc) ? raw.doc : null;
  const blocks = source && Array.isArray(source.content) ? source.content.slice(0, MAX_BLOCKS) : [];

  const content: RichBlock[] = [];
  for (const block of blocks) {
    const normalized = normalizeBlock(block);
    if (normalized) {
      content.push(normalized);
    }
  }

  return { schemaVersion: RICH_DOC_SCHEMA_VERSION, doc: { type: "doc", content } };
}

/** Chuẩn hoá RichDoc và ném lỗi 422 nếu vượt giới hạn cứng của máy chủ. */
export function parseRichDoc(raw: unknown, fieldLabel = "Nội dung"): RichDoc {
  const normalized = normalizeRichDoc(raw);
  const textLength = plainTextFromRichDoc(normalized).length;

  if (textLength > MAX_TEXT_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${fieldLabel} quá dài (tối đa ${MAX_TEXT_LENGTH} ký tự).`,
      422,
    );
  }

  const tooLongLatex = collectLatex(normalized).find((item) => item.latex.length > MAX_LATEX_LENGTH);
  if (tooLongLatex) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${fieldLabel}: công thức LaTeX quá dài (tối đa ${MAX_LATEX_LENGTH} ký tự).`,
      422,
    );
  }

  return normalized;
}

function inlineToText(nodes: readonly RichInline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "mathInline") return `$${node.attrs.latex}$`;
      return "[Hình ảnh]";
    })
    .join("")
    .trim();
}

/** Chuyển RichDoc thành chữ thuần (giữ công thức dạng `$…$`) để lưu cột text cũ. */
export function plainTextFromRichDoc(doc: RichDoc): string {
  const lines: string[] = [];

  for (const block of doc.doc.content) {
    if (block.type === "paragraph") {
      lines.push(inlineToText(block.content ?? []));
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      block.content.forEach((item, index) => {
        const prefix = block.type === "orderedList" ? `${index + 1}. ` : "• ";
        lines.push(prefix + item.content.map((paragraph) => inlineToText(paragraph.content ?? [])).join(" "));
      });
    } else if (block.type === "mathBlock") {
      lines.push(`$$${block.attrs.latex}$$`);
    } else {
      lines.push("[Hình ảnh]");
    }
  }

  return lines
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export function isRichDocEmpty(doc: RichDoc): boolean {
  return plainTextFromRichDoc(doc).length === 0 && collectAssetIds(doc).length === 0;
}

/** Danh sách công thức trong tài liệu — dùng cho kiểm tra trước khi xuất bản. */
export function collectLatex(doc: RichDoc): Array<{ latex: string; displayMode: boolean }> {
  const found: Array<{ latex: string; displayMode: boolean }> = [];

  const fromInline = (nodes: readonly RichInline[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "mathInline") {
        found.push({ latex: node.attrs.latex, displayMode: false });
      }
    }
  };

  for (const block of doc.doc.content) {
    if (block.type === "mathBlock") {
      found.push({ latex: block.attrs.latex, displayMode: true });
    } else if (block.type === "paragraph") {
      fromInline(block.content);
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      for (const item of block.content) {
        for (const paragraph of item.content) {
          fromInline(paragraph.content);
        }
      }
    }
  }

  return found;
}

/** Mã của các ảnh được tham chiếu trong tài liệu (dùng để chặn xoá tệp đang dùng). */
export function collectAssetIds(doc: RichDoc): string[] {
  const ids = new Set<string>();

  const fromInline = (nodes: readonly RichInline[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "image") {
        ids.add(node.attrs.assetId);
      }
    }
  };

  for (const block of doc.doc.content) {
    if (block.type === "image") {
      ids.add(block.attrs.assetId);
    } else if (block.type === "paragraph") {
      fromInline(block.content);
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      for (const item of block.content) {
        for (const paragraph of item.content) {
          fromInline(paragraph.content);
        }
      }
    }
  }

  return [...ids];
}

