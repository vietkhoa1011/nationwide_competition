"use client";

import type { ReactNode } from "react";

import type {
  RichBlock,
  RichDoc,
  RichInline,
  RichParagraphNode,
} from "@/features/authoring/services/rich-content-core";
import { mediaUrl } from "@/features/content/media-url";
import { MathContent } from "@/features/content/components/math-content";
import { cn } from "@/lib/utils";

/**
 * Renderer DÙNG CHUNG cho mọi nơi hiển thị nội dung đề: xem trước của người soạn, trang chi
 * tiết đề, trang làm bài và trang kết quả/lời giải.
 *
 * Renderer là danh sách trắng: chỉ những node trong `RichDoc` (đoạn văn, danh sách, công
 * thức, ảnh) mới được dựng thành phần tử React — không dùng `dangerouslySetInnerHTML` cho
 * nội dung người dùng nhập, nên không thể chèn HTML/script.
 */

function renderInline(nodes: readonly RichInline[] | undefined, keyPrefix: string): ReactNode {
  return (nodes ?? []).map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === "mathInline") {
      return <MathContent key={key} latex={node.attrs.latex} />;
    }

    if (node.type === "image") {
      return (
        <img
          key={key}
          src={mediaUrl(node.attrs.assetId)}
          alt={node.attrs.alt ?? ""}
          width={node.attrs.width}
          loading="lazy"
          className="my-1 inline-block max-w-full rounded-xl border border-slate-200"
        />
      );
    }

    let content: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") {
        content = <strong>{content}</strong>;
      } else if (mark.type === "italic") {
        content = <em>{content}</em>;
      } else if (mark.type === "superscript") {
        content = <sup>{content}</sup>;
      } else if (mark.type === "subscript") {
        content = <sub>{content}</sub>;
      }
    }

    return <span key={key}>{content}</span>;
  });
}

function renderParagraph(node: RichParagraphNode, key: string): ReactNode {
  if (!node.content || node.content.length === 0) {
    return <p key={key} className="h-2" />;
  }
  return (
    <p key={key} className="leading-relaxed">
      {renderInline(node.content, key)}
    </p>
  );
}

function renderBlock(block: RichBlock, index: number): ReactNode {
  const key = `block-${index}`;

  if (block.type === "paragraph") {
    return renderParagraph(block, key);
  }

  if (block.type === "mathBlock") {
    return <MathContent key={key} latex={block.attrs.latex} display />;
  }

  if (block.type === "image") {
    return (
      <figure key={key} className="my-2">
        <img
          src={mediaUrl(block.attrs.assetId)}
          alt={block.attrs.alt ?? ""}
          width={block.attrs.width}
          loading="lazy"
          className="max-w-full rounded-xl border border-slate-200"
        />
        {block.attrs.alt ? (
          <figcaption className="mt-1 text-xs text-slate-500">{block.attrs.alt}</figcaption>
        ) : null}
      </figure>
    );
  }

  const ListTag = block.type === "orderedList" ? "ol" : "ul";
  const listClassName = block.type === "orderedList" ? "list-decimal" : "list-disc";

  return (
    <ListTag key={key} className={cn("space-y-1 pl-5", listClassName)}>
      {block.content.map((item, itemIndex) => (
        <li key={`${key}-item-${itemIndex}`}>
          {item.content.map((paragraph, paragraphIndex) =>
            renderParagraph(paragraph, `${key}-item-${itemIndex}-${paragraphIndex}`),
          )}
        </li>
      ))}
    </ListTag>
  );
}

export function RichContent({
  doc,
  text,
  className,
  compact = false,
}: {
  /** Nội dung có cấu trúc; khi rỗng sẽ hiển thị `text` (dữ liệu cũ hoặc bản chữ thuần). */
  doc?: RichDoc | null;
  text?: string | null;
  className?: string;
  /** Chế độ gọn cho phương án trả lời (chữ nhỏ hơn, ít khoảng cách). */
  compact?: boolean;
}) {
  if (!doc || doc.doc.content.length === 0) {
    if (!text) {
      return null;
    }
    return (
      <div
        className={cn(
          "whitespace-pre-line",
          compact ? "text-sm leading-relaxed" : "leading-relaxed",
          className,
        )}
      >
        {text}
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-1 text-sm" : "space-y-2", className)}>
      {doc.doc.content.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
