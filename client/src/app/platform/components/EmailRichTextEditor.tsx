import React, { useCallback, useEffect, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Undo2,
  Redo2,
  Code2,
  Pilcrow,
  Heading1,
  Heading2,
  Highlighter,
} from "lucide-react";
import "./email-editor.css";

export type EmailRichTextEditorHandle = {
  insertMergeTag: (tag: string) => void;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tiptap-btn${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export const EmailRichTextEditor = React.forwardRef<EmailRichTextEditorHandle, Props>(
  function EmailRichTextEditor({ value, onChange, placeholder }, ref) {
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceHtml, setSourceHtml] = useState(value);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener" } }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({ placeholder: placeholder ?? "Write your email body…" }),
      ],
      content: value,
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        onChange(html);
        setSourceHtml(html);
      },
      editorProps: {
        attributes: {
          class: "prose-email",
        },
      },
    });

    useEffect(() => {
      if (!editor || sourceMode) return;
      const current = editor.getHTML();
      if (value !== current && value !== editor.getText()) {
        editor.commands.setContent(value, { emitUpdate: false });
        setSourceHtml(value);
      }
    }, [value, editor, sourceMode]);

    useImperativeHandle(ref, () => ({
      insertMergeTag: (tag: string) => {
        const token = `{{${tag}}}`;
        if (sourceMode) {
          setSourceHtml((prev) => {
            const next = `${prev}${token}`;
            onChange(next);
            return next;
          });
          return;
        }
        if (editor) {
          editor.chain().focus().insertContent(token).run();
        }
      },
    }));

    const setLink = useCallback(() => {
      if (!editor) return;
      const prev = editor.getAttributes("link").href as string | undefined;
      const url = window.prompt("Link URL", prev ?? "https://");
      if (url === null) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }, [editor]);

    const applySource = () => {
      onChange(sourceHtml);
      if (editor) editor.commands.setContent(sourceHtml, { emitUpdate: false });
    };

    const toggleSource = () => {
      if (!sourceMode && editor) {
        setSourceHtml(editor.getHTML());
      } else if (sourceMode) {
        applySource();
      }
      setSourceMode((m) => !m);
    };

    if (!editor) {
      return <div className="email-rich-editor rounded-lg border border-slate-200 bg-slate-50 h-[320px] animate-pulse" />;
    }

    const textColor = editor.getAttributes("textStyle").color as string | undefined;
    const highlightColor = editor.getAttributes("highlight").color as string | undefined;

    return (
      <div className="email-rich-editor rounded-lg border border-slate-200 overflow-hidden bg-white">
        <div className="tiptap-toolbar">
          <div className="tiptap-toolbar-group">
            <ToolbarButton
              title="Bold"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={sourceMode}
            >
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Italic"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={sourceMode}
            >
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Underline"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              disabled={sourceMode}
            >
              <UnderlineIcon size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Strikethrough"
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={sourceMode}
            >
              <Strikethrough size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <ToolbarButton
              title="Paragraph"
              active={editor.isActive("paragraph")}
              onClick={() => editor.chain().focus().setParagraph().run()}
              disabled={sourceMode}
            >
              <Pilcrow size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              disabled={sourceMode}
            >
              <Heading1 size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              disabled={sourceMode}
            >
              <Heading2 size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <ToolbarButton
              title="Bullet list"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              disabled={sourceMode}
            >
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Numbered list"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              disabled={sourceMode}
            >
              <ListOrdered size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <ToolbarButton
              title="Align left"
              active={editor.isActive({ textAlign: "left" })}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              disabled={sourceMode}
            >
              <AlignLeft size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Align center"
              active={editor.isActive({ textAlign: "center" })}
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              disabled={sourceMode}
            >
              <AlignCenter size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Align right"
              active={editor.isActive({ textAlign: "right" })}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              disabled={sourceMode}
            >
              <AlignRight size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <input
              type="color"
              className="tiptap-color-input"
              title="Text color"
              value={textColor ?? "#0f172a"}
              disabled={sourceMode}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
            <input
              type="color"
              className="tiptap-color-input"
              title="Highlight"
              value={highlightColor ?? "#fef08a"}
              disabled={sourceMode}
              onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
            />
            <ToolbarButton title="Highlight" disabled={sourceMode} onClick={() => editor.chain().focus().toggleHighlight().run()}>
              <Highlighter size={15} />
            </ToolbarButton>
            <ToolbarButton title="Insert link" disabled={sourceMode} onClick={setLink}>
              <Link2 size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <ToolbarButton
              title="Undo"
              disabled={sourceMode || !editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              disabled={sourceMode || !editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={15} />
            </ToolbarButton>
          </div>

          <div className="tiptap-toolbar-group">
            <ToolbarButton title={sourceMode ? "Visual editor" : "HTML source"} active={sourceMode} onClick={toggleSource}>
              <Code2 size={15} />
            </ToolbarButton>
          </div>
        </div>

        {sourceMode ? (
          <textarea
            className="editor-source"
            value={sourceHtml}
            onChange={(e) => {
              setSourceHtml(e.target.value);
              onChange(e.target.value);
            }}
            spellCheck={false}
          />
        ) : (
          <div className="editor-surface">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    );
  },
);
