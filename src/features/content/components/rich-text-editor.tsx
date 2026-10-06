"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useState } from "react";

import {
  RICH_DOC_SCHEMA_VERSION,
  type RichDoc,
} from "@/features/authoring/services/rich-content-core";
import { ImageDialog, type ImageSelection } from "@/features/content/components/image-dialog";
import { MathDialog, type MathFormula } from "@/features/content/components/math-dialog";
import { buildRichContentExtensions } from "@/features/content/editor/rich-content-extensions";
import { sanitizePastedHtml, wrapPastedHtml } from "@/features/content/paste-sanitizer";
import { cn } from "@/lib/utils";

interface TargetRange {
  from: number;
  to: number;
}

/**
 * Trình soạn thảo nội dung có cấu trúc cho đề thi (Tiptap).
 *
 * - Toolbar chỉ gồm những gì đề cần: đậm, nghiêng, danh sách, chỉ số trên/dưới, chèn công
 *   thức, chèn ảnh, undo/redo.
 * - Nội dung dán từ Word/website được lọc qua `sanitizePastedHtml` rồi mới đưa vào schema.
 * - Giá trị trả ra là JSON của ProseMirror bọc trong `{ schemaVersion, doc }` — đây là nguồn
 *   sự thật được lưu ở database, không phải HTML do thư viện render.
 *
 * Component cha gắn `key` theo câu hỏi: khi đổi câu đang sửa, editor được tạo lại với nội
 * dung mới thay vì trộn lẫn hai câu.
 */
export function RichTextEditor({
  value,
  onChange,
  examId,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: RichDoc | null;
  onChange: (doc: RichDoc) => void;
  /** Đề đang soạn — dùng làm phạm vi lưu ảnh tải lên. */
  examId: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [mathDialog, setMathDialog] = useState<{
    open: boolean;
    initial: MathFormula | null;
    range: TargetRange | null;
  }>({ open: false, initial: null, range: null });

  const [imageDialog, setImageDialog] = useState<{
    open: boolean;
    initial: ImageSelection | null;
    range: TargetRange | null;
  }>({ open: false, initial: null, range: null });

  const editor = useEditor({
    extensions: buildRichContentExtensions(),
    content: value?.doc ?? { type: "doc", content: [] },
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-editor min-h-[7rem] px-3 py-2 text-sm text-slate-900 outline-none",
        "aria-label": ariaLabel,
      },
      // Nội dung dán vào chỉ giữ định dạng cơ bản; phần còn lại bị loại bỏ.
      transformPastedHTML: (html) => wrapPastedHtml(sanitizePastedHtml(html)),
    },
    onUpdate: ({ editor: instance }) => {
      onChange({
        schemaVersion: RICH_DOC_SCHEMA_VERSION,
        doc: instance.getJSON() as RichDoc["doc"],
      });
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            bulletList: instance.isActive("bulletList"),
            orderedList: instance.isActive("orderedList"),
            superscript: instance.isActive("superscript"),
            subscript: instance.isActive("subscript"),
            mathInline: instance.isActive("mathInline"),
            mathBlock: instance.isActive("mathBlock"),
            image: instance.isActive("image"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : null,
  });

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[9rem] rounded-2xl border border-dashed border-slate-300 bg-slate-50",
          className,
        )}
      />
    );
  }

  const currentSelection = (): TargetRange => ({
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  });

  const openMathDialog = (mode: "insert" | "edit") => {
    const mathType = editor.isActive("mathBlock") ? "mathBlock" : "mathInline";
    const initial: MathFormula | null =
      mode === "edit"
        ? {
            latex: String(editor.getAttributes(mathType).latex ?? ""),
            display: mathType === "mathBlock",
          }
        : null;
    setMathDialog({ open: true, initial, range: currentSelection() });
  };

  const openImageDialog = (mode: "insert" | "edit") => {
    const initial: ImageSelection | null =
      mode === "edit"
        ? {
            assetId: String(editor.getAttributes("image").assetId ?? ""),
            alt: (editor.getAttributes("image").alt as string | null) ?? null,
          }
        : null;
    setImageDialog({ open: true, initial, range: currentSelection() });
  };

  const replaceTarget = (range: TargetRange | null, node: Record<string, unknown>) => {
    if (range) {
      editor.chain().focus().insertContentAt(range, node).run();
      return;
    }
    editor.chain().focus().insertContent(node).run();
  };

  return (
    <div className={cn("rounded-2xl border border-slate-300 bg-white", className)}>
      <EditorToolbar
        state={state}
        onCommand={(command) => {
          const chain = editor.chain().focus();
          if (command === "bold") chain.toggleBold().run();
          else if (command === "italic") chain.toggleItalic().run();
          else if (command === "bulletList") chain.toggleBulletList().run();
          else if (command === "orderedList") chain.toggleOrderedList().run();
          else if (command === "superscript") chain.toggleSuperscript().run();
          else if (command === "subscript") chain.toggleSubscript().run();
          else if (command === "undo") chain.undo().run();
          else if (command === "redo") chain.redo().run();
        }}
        onInsertMath={() => openMathDialog("insert")}
        onEditMath={() => openMathDialog("edit")}
        onInsertImage={() => openImageDialog("insert")}
        onEditImage={() => openImageDialog("edit")}
      />

      <EditorContent editor={editor} />

      <MathDialog
        open={mathDialog.open}
        initial={mathDialog.initial}
        onCancel={() => setMathDialog({ open: false, initial: null, range: null })}
        onConfirm={(formula) => {
          replaceTarget(mathDialog.range, {
            type: formula.display ? "mathBlock" : "mathInline",
            attrs: { latex: formula.latex },
          });
          setMathDialog({ open: false, initial: null, range: null });
        }}
      />

      <ImageDialog
        open={imageDialog.open}
        examId={examId}
        initial={imageDialog.initial}
        onCancel={() => setImageDialog({ open: false, initial: null, range: null })}
        onInsert={(image) => {
          replaceTarget(imageDialog.range, {
            type: "image",
            attrs: { assetId: image.assetId, alt: image.alt },
          });
          setImageDialog({ open: false, initial: null, range: null });
        }}
        onRemoveFromContent={() => {
          // Xoá ảnh khỏi nội dung chỉ bỏ node trong tài liệu; tệp vẫn ở lại kho media để
          // đề/phiên bản khác dùng tiếp.
          if (imageDialog.range) {
            editor.chain().focus().deleteRange(imageDialog.range).run();
          }
          setImageDialog({ open: false, initial: null, range: null });
        }}
      />
    </div>
  );
}

type ToolbarCommand =
  | "bold"
  | "italic"
  | "bulletList"
  | "orderedList"
  | "superscript"
  | "subscript"
  | "undo"
  | "redo";

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  orderedList: boolean;
  superscript: boolean;
  subscript: boolean;
  mathInline: boolean;
  mathBlock: boolean;
  image: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

function ToolButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Giữ vùng chọn trong editor không bị mất khi bấm nút.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {label}
    </button>
  );
}

/** Toolbar của trình soạn thảo (tách riêng để phần thân component dễ đọc). */
function EditorToolbar({
  state,
  onCommand,
  onInsertMath,
  onEditMath,
  onInsertImage,
  onEditImage,
}: {
  state: ToolbarState | null;
  onCommand: (command: ToolbarCommand) => void;
  onInsertMath: () => void;
  onEditMath: () => void;
  onInsertImage: () => void;
  onEditImage: () => void;
}) {
  const isMathSelected = Boolean(state?.mathInline || state?.mathBlock);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
      <ToolButton label="B" title="In đậm" active={state?.bold} onClick={() => onCommand("bold")} />
      <ToolButton
        label="I"
        title="In nghiêng"
        active={state?.italic}
        onClick={() => onCommand("italic")}
      />
      <ToolButton
        label="• Danh sách"
        title="Danh sách không thứ tự"
        active={state?.bulletList}
        onClick={() => onCommand("bulletList")}
      />
      <ToolButton
        label="1. Danh sách"
        title="Danh sách có thứ tự"
        active={state?.orderedList}
        onClick={() => onCommand("orderedList")}
      />
      <ToolButton
        label="x²"
        title="Chỉ số trên"
        active={state?.superscript}
        onClick={() => onCommand("superscript")}
      />
      <ToolButton
        label="x₂"
        title="Chỉ số dưới"
        active={state?.subscript}
        onClick={() => onCommand("subscript")}
      />

      <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

      <ToolButton label="∑ Công thức" title="Chèn công thức" onClick={onInsertMath} />
      <ToolButton
        label="Sửa công thức"
        title="Sửa công thức đang chọn"
        disabled={!isMathSelected}
        onClick={onEditMath}
      />
      <ToolButton label="Ảnh" title="Chèn ảnh" onClick={onInsertImage} />
      <ToolButton
        label="Thay ảnh"
        title="Thay ảnh đang chọn"
        disabled={!state?.image}
        onClick={onEditImage}
      />

      <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

      <ToolButton
        label="↶"
        title="Hoàn tác"
        disabled={!state?.canUndo}
        onClick={() => onCommand("undo")}
      />
      <ToolButton
        label="↷"
        title="Làm lại"
        disabled={!state?.canRedo}
        onClick={() => onCommand("redo")}
      />
    </div>
  );
}

