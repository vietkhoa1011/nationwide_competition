import { mergeAttributes, Node } from "@tiptap/core";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import StarterKit from "@tiptap/starter-kit";

import { parseMediaAssetId, mediaUrl } from "@/features/content/media-url";
import { renderLatexToHtml } from "@/features/math/services/latex-core";

/**
 * Định nghĩa node tuỳ biến của trình soạn thảo: công thức trong dòng, công thức riêng một
 * dòng và ảnh trong kho media. Ba node này là "từ vựng" chung giữa editor (Tiptap) và dữ
 * liệu lưu trong database (`RichDoc`), nên nội dung soạn ra render được ở mọi trang.
 *
 * Công thức KHÔNG bao giờ được biến thành ảnh: node chỉ giữ nguồn LaTeX, người dùng bấm
 * vào công thức để sửa lại.
 */

/** Dựng DOM hiển thị công thức cho editor (dùng chung cấu hình KaTeX với trang học sinh). */
function createMathDom(latex: string, display: boolean): HTMLElement {
  const dom = document.createElement(display ? "div" : "span");
  const rendered = renderLatexToHtml(latex, display);

  if (rendered.error) {
    dom.className =
      "inline-block rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700";
    dom.textContent = `⚠ ${rendered.error}`;
    return dom;
  }

  dom.className = display
    ? "my-2 max-w-full overflow-x-auto text-center"
    : "inline-block max-w-full align-middle";
  dom.innerHTML = rendered.html;
  return dom;
}

export const MathInline = Node.create({
  name: "mathInline",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return { latex: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-latex]",
        getAttrs: (element) => ({
          latex: (element as HTMLElement).getAttribute("data-math-latex") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({ "data-math-latex": node.attrs.latex as string, class: "math-inline" }),
    ];
  },

  addNodeView() {
    return ({ node }) => ({ dom: createMathDom(node.attrs.latex as string, false) });
  },
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return { latex: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-math-block-latex]",
        getAttrs: (element) => ({
          latex: (element as HTMLElement).getAttribute("data-math-block-latex") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({
        "data-math-block-latex": node.attrs.latex as string,
        class: "math-block",
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => ({ dom: createMathDom(node.attrs.latex as string, true) });
  },
});

/**
 * Ảnh trong kho media: node chỉ giữ `assetId` (không giữ base64, không giữ URL ngoài), nhờ
 * vậy khi đề riêng tư thì ảnh vẫn được bảo vệ qua `/api/media/[assetId]`.
 */
export const ImageAsset = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: "" },
      alt: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const image = element as HTMLImageElement;
          const assetId = parseMediaAssetId(image.getAttribute("src"));
          if (!assetId) {
            return false;
          }
          return { assetId, alt: image.getAttribute("alt"), width: null };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const assetId = node.attrs.assetId as string;
    const width = node.attrs.width as number | null;
    return [
      "img",
      mergeAttributes({
        src: mediaUrl(assetId),
        alt: (node.attrs.alt as string | null) ?? "",
        ...(width ? { width } : {}),
        class: "max-w-full rounded-xl border border-slate-200",
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "my-2";

      const image = document.createElement("img");
      image.src = mediaUrl(node.attrs.assetId as string);
      image.alt = (node.attrs.alt as string | null) ?? "";
      image.className = "max-w-full rounded-xl border border-slate-200";
      if (node.attrs.width) {
        image.width = node.attrs.width as number;
      }
      wrapper.append(image);

      const alt = node.attrs.alt as string | null;
      if (alt) {
        const caption = document.createElement("p");
        caption.className = "mt-1 text-xs text-slate-500";
        caption.textContent = alt;
        wrapper.append(caption);
      }

      return { dom: wrapper };
    };
  },
});

/**
 * Bộ extension dùng cho mọi vùng nội dung của đề. StarterKit được rút gọn để schema chỉ
 * chứa đúng những gì nút công cụ hỗ trợ (đậm, nghiêng, danh sách, chỉ số trên/dưới, ảnh,
 * công thức, undo/redo) — mọi định dạng khác bị loại khi dán nội dung vào.
 */
export function buildRichContentExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      link: false,
      underline: false,
      bold: {},
      italic: {},
      bulletList: {},
      orderedList: {},
      listItem: {},
      undoRedo: {},
    }),
    Subscript,
    Superscript,
    MathInline,
    MathBlock,
    ImageAsset,
  ];
}
