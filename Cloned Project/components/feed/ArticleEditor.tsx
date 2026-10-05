"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Quote,
  Code,
  Link as LinkIcon,
  Check,
  X,
  Unlink,
} from "lucide-react";
import "./article-editor.css";

interface ArticleEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Strip HTML tags/entities that leaked into href attribute values.
 * Prevents corrupted URLs from being saved (e.g. from rich-text paste
 * or applying bold/italic to link text in the editor).
 *
 * Examples of corrupted hrefs this fixes:
 *   href="https://google.com/"><strong>https://google.com/</strong></a>"
 *   href="https://google.com/"><em>https://google.com/</em></a></p>"
 */
function cleanHrefsInHtml(html: string): string {
  return html.replace(
    /href=(["'])([\s\S]*?)\1/gi,
    (_match, quote: string, rawValue: string) => {
      // Decode HTML entities first
      let decoded = rawValue
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&");

      // If the value contains any HTML tags, it's corrupted
      if (/<[a-z/!]/i.test(decoded)) {
        // Strip ALL HTML tags
        decoded = decoded.replace(/<[^>]*>/g, "");
        // Remove any trailing quotes or angle brackets left over
        decoded = decoded.replace(/[>"']+$/, "");
        // After stripping tags, the URL may be duplicated
        // (e.g. "https://x.comhttps://x.com") — extract just the first valid URL
        const urlMatch = decoded.match(/^(https?:\/\/[^\s"'<>]+)/i);
        if (urlMatch) {
          decoded = urlMatch[1];
        }
      }

      return `href=${quote}${decoded.trim()}${quote}`;
    }
  );
}

// ─── Toolbar Button ───
function ToolbarButton({
  onClick,
  onMouseDown,
  isActive,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent editor blur
        if (onMouseDown) onMouseDown(e);
      }}
      className={`article-toolbar-btn ${isActive ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ─── Toolbar Divider ───
function ToolbarDivider() {
  return <div className="article-toolbar-divider" />;
}

// ─── Word Count Footer ───
function WordCountFooter({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0 };
    const text = editor.state.doc.textContent;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  }, [editor?.state.doc.textContent]);

  if (!editor) return null;

  return (
    <div className="article-editor-footer">
      <span>{stats.words} {stats.words === 1 ? "word" : "words"}</span>
      <span className="article-editor-footer-dot">·</span>
      <span>{stats.chars} {stats.chars === 1 ? "character" : "characters"}</span>
    </div>
  );
}

// ─── Inline Link Input (shown inside the bubble menu) ───
function LinkInput({
  editor,
  onClose,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onClose: () => void;
}) {
  const existingHref = editor.getAttributes("link").href;
  const [url, setUrl] = useState(existingHref || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay to let tippy finish positioning before focusing
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const apply = useCallback(() => {
    if (!url.trim()) return;
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: finalUrl })
      .run();
    onClose();
  }, [editor, url, onClose]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }, [editor, onClose]);

  return (
    <div className="link-input-wrapper" onMouseDown={(e) => e.preventDefault()}>
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") {
            onClose();
            editor.chain().focus().run();
          }
        }}
        placeholder="Enter URL..."
      />
      <button
        onClick={apply}
        title="Apply link"
        className={url.trim() ? "is-active" : ""}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Check />
      </button>
      {editor.isActive("link") && (
        <button onClick={removeLink} title="Remove link" onMouseDown={(e) => e.preventDefault()}>
          <Unlink />
        </button>
      )}
      <button
        onClick={onClose}
        title="Cancel"
        onMouseDown={(e) => e.preventDefault()}
      >
        <X />
      </button>
    </div>
  );
}

// ─── Main Editor Component ───
export function ArticleEditor({
  initialContent = "",
  onChange,
  placeholder = "Write your article...",
}: ArticleEditorProps) {
  // Track what content was already loaded to avoid overwriting user edits
  const initialContentSetRef = useRef<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // Required for Next.js SSR compatibility
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "article-code-block",
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "article-link",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }).extend({
        // Higher priority than Bold (600) and Italic (600) so Link wraps
        // around inline marks instead of being wrapped by them. This
        // prevents the browser from injecting <strong>/<em> inside the
        // <a> tag's serialised href attribute.
        priority: 1001,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent || "",
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();
      // Don't emit the default empty paragraph as content
      if (html === "<p></p>") {
        onChange("");
      } else {
        // Clean any HTML that leaked into href attributes before emitting
        html = cleanHrefsInHtml(html);
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        class: "article-tiptap-content",
      },
      // Clean pasted HTML to strip HTML tags from inside href attributes
      transformPastedHTML(html) {
        return cleanHrefsInHtml(html);
      },
      handleDOMEvents: {
        mouseup: (view) => {
          setTimeout(() => {
            view.dispatch(view.state.tr)
          }, 10)
          return false
        }
      }
    },
  });

  // Update editor content when initialContent changes externally (e.g. edit mode load)
  useEffect(() => {
    if (!editor) return;
    if (initialContent === undefined || initialContent === null) return;

    const currentHTML = editor.getHTML();
    const normalizedInitial = initialContent === "" ? "<p></p>" : initialContent;
    const normalizedCurrent = currentHTML === "" ? "<p></p>" : currentHTML;

    if (normalizedInitial !== normalizedCurrent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Reset link input when selection changes
  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      setShowLinkInput(false);
    };
    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="article-editor">
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top' }}
        shouldShow={({ editor, from, to }) => {
          return from !== to && editor.isFocused
        }}
      >
        <div className="article-bubble-menu" onMouseDown={(e) => e.preventDefault()}>
          {showLinkInput ? (
            <LinkInput
              editor={editor}
              onClose={() => {
                setShowLinkInput(false);
                editor.chain().focus().run();
              }}
            />
          ) : (
            <>
              {/* Inline formatting — applies only to selected text */}
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
                title="Bold (⌘+B)"
              >
                <Bold />
              </ToolbarButton>
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
                title="Italic (⌘+I)"
              >
                <Italic />
              </ToolbarButton>
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive("strike")}
                title="Strikethrough"
              >
                <Strikethrough />
              </ToolbarButton>
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive("code")}
                title="Inline code"
              >
                <Code />
              </ToolbarButton>

              <ToolbarDivider />

              {/* Block-level formatting — applies to the paragraph containing selection */}
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive("heading", { level: 2 })}
                title="Heading 2"
              >
                <Heading2 />
              </ToolbarButton>
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive("heading", { level: 3 })}
                title="Heading 3"
              >
                <Heading3 />
              </ToolbarButton>
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive("blockquote")}
                title="Blockquote"
              >
                <Quote />
              </ToolbarButton>

              <ToolbarDivider />

              {/* Link */}
              <ToolbarButton
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowLinkInput(true)}
                isActive={editor.isActive("link")}
                title="Add link"
              >
                <LinkIcon />
              </ToolbarButton>
            </>
          )}
        </div>
      </BubbleMenu>

      {/* Editor content area */}
      <EditorContent editor={editor} />
    </div>
  );
}
