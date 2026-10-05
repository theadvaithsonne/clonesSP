"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  X,
  Check,
  ExternalLink,
  Pencil,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Which palette the chrome uses.
 *
 * "app" is the product's blue-tinted dark theme (#131316 / #2a2a35 / #9fa0b8)
 * and stays the default so every existing call site is untouched. "admin" is
 * the garage-admin console's neutral gray, where the blue cast reads as a
 * foreign component dropped into the page.
 *
 * Each entry holds COMPLETE class strings rather than raw hex: Tailwind scans
 * source text, so a class assembled at runtime (`bg-[${x}]`) is never
 * generated.
 */
export type RichTextEditorTheme = "app" | "admin";

interface EditorPalette {
  border: string;
  divider: string;
  surface: string;
  hover: string;
  active: string;
  muted: string;
  placeholder: string;
  linkBar: string;
  input: string;
  popover: string;
  popoverDivider: string;
  chip: string;
}

const THEMES: Record<RichTextEditorTheme, EditorPalette> = {
  app: {
    border: "border-[#2a2a35]",
    divider: "bg-[#2a2a35]",
    surface: "bg-[#131316]",
    hover: "hover:bg-[#2a2a35]",
    active: "bg-[#2a2a35] text-brand",
    muted: "text-[#9fa0b8]",
    placeholder: "[&:empty]:before:text-[#9fa0b8]",
    linkBar: "bg-[#1a1a22]",
    input: "bg-[#0d0d10] border-[#2a2a35] placeholder-[#5a5a6e]",
    popover: "bg-[#1e1e2a] border-[#3a3a4a]",
    popoverDivider: "bg-[#3a3a4a]",
    chip: "bg-[#2a2a35]",
  },
  admin: {
    border: "border-[#262626]",
    divider: "bg-[#262626]",
    surface: "bg-[#141414]",
    hover: "hover:bg-[#262626]",
    active: "bg-[#262626] text-brand",
    muted: "text-neutral-400",
    placeholder: "[&:empty]:before:text-neutral-600",
    linkBar: "bg-[#1a1a1a]",
    input: "bg-[#101010] border-[#262626] placeholder-neutral-600",
    popover: "bg-[#1f1f1f] border-[#333333]",
    popoverDivider: "bg-[#333333]",
    chip: "bg-[#262626]",
  },
};

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  theme?: RichTextEditorTheme;
}

function sanitizeHtmlStyles(html: string): string {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    const cleanStyles = (el: Element) => {
      el.removeAttribute("class");
      if (el.hasAttribute("style")) {
        const style = el.getAttribute("style") || "";
        // Only keep text-alignment styling
        const newStyle = style
          .split(";")
          .map(s => s.trim())
          .filter(s => s.toLowerCase().startsWith("text-align"))
          .join(";");
          
        if (newStyle) {
          el.setAttribute("style", newStyle);
        } else {
          el.removeAttribute("style");
        }
      }
      for (let i = 0; i < el.children.length; i++) {
        cleanStyles(el.children[i]);
      }
    };
    
    if (doc.body) {
      cleanStyles(doc.body);
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error("Error sanitizing HTML styles:", err);
  }
  return html;
}

/** Normalize a URL so it always has an absolute protocol. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/** Shorten long URLs for display inside the popover */
function shortenUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "…";
}

interface LinkPopover {
  href: string;
  anchorEl: HTMLAnchorElement;
  top: number;
  left: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
  minHeight = "150px",
  theme = "app",
}: RichTextEditorProps) {
  const t = THEMES[theme] ?? THEMES.app;
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isInternalChange = useRef(false);
  const lastValue = useRef(value);

  // Insert link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedSelection = useRef<Range | null>(null);

  // Link preview popover state
  const [linkPopover, setLinkPopover] = useState<LinkPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize editor content on mount
  useEffect(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = sanitizeHtmlStyles(value);
      lastValue.current = value;
    }
  }, []); // Only run on mount

  // Sync value to editor only when value changes externally (not from user input)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current && value !== lastValue.current) {
      editorRef.current.innerHTML = sanitizeHtmlStyles(value);
      lastValue.current = value;
    }
    isInternalChange.current = false;
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("a")
      ) {
        setLinkPopover(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const execCommand = useCallback(
    (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleInput();
    },
    []
  );

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      let newValue = editorRef.current.innerHTML;
      
      if (editorRef.current.textContent?.trim() === "" && 
          !editorRef.current.querySelector("img") && 
          !editorRef.current.querySelector("iframe")) {
        newValue = "";
        editorRef.current.innerHTML = "";
      }
      
      isInternalChange.current = true;
      lastValue.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            execCommand("bold");
            break;
          case "i":
            e.preventDefault();
            execCommand("italic");
            break;
          case "u":
            e.preventDefault();
            execCommand("underline");
            break;
          case "z":
            if (e.shiftKey) {
              e.preventDefault();
              execCommand("redo");
            } else {
              e.preventDefault();
              execCommand("undo");
            }
            break;
          case "k":
            e.preventDefault();
            openLinkDialog();
            break;
        }
      }
    },
    [execCommand]
  );

  // ─── Link click inside editor → show popover ──────────────────────────────
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target || !editorRef.current) return;

    e.preventDefault(); // don't navigate while editing

    const anchor = target as HTMLAnchorElement;
    const href = anchor.getAttribute("href") || "";

    // Position popover relative to the wrapper div
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    if (!wrapperRect) return;

    const top = anchorRect.bottom - wrapperRect.top + 6;
    const left = Math.max(0, anchorRect.left - wrapperRect.left);

    setLinkPopover({ href, anchorEl: anchor, top, left });
  }, []);

  // ─── Popover hover cancel/keep logic ──────────────────────────────────────
  const clearHideTimer = () => {
    if (popoverHideTimer.current) {
      clearTimeout(popoverHideTimer.current);
      popoverHideTimer.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    popoverHideTimer.current = setTimeout(() => setLinkPopover(null), 200);
  };

  // ─── Insert link dialog ────────────────────────────────────────────────────
  const openLinkDialog = useCallback((prefillHref?: string, prefillAnchor?: HTMLAnchorElement) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      savedSelection.current = range.cloneRange();
      setLinkText(prefillAnchor ? (prefillAnchor.textContent || "") : range.toString());
    } else if (prefillAnchor) {
      // clicked from popover — select the anchor node
      const range = document.createRange();
      range.selectNode(prefillAnchor);
      savedSelection.current = range;
      setLinkText(prefillAnchor.textContent || "");
    } else {
      savedSelection.current = null;
      setLinkText("");
    }
    setLinkUrl(prefillHref || "");
    setLinkPopover(null);
    setShowLinkDialog(true);
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelection.current);
      }
    }
  }, []);

  const confirmLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    const normalized = normalizeUrl(linkUrl);
    const displayText = linkText.trim() || normalized;

    editorRef.current?.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const hasSelectedText = !range.collapsed && range.toString().trim().length > 0;

      if (hasSelectedText) {
        document.execCommand("createLink", false, normalized);
      } else {
        range.collapse(true);
        const anchor = document.createElement("a");
        anchor.href = normalized;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = displayText;
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // Normalize all anchors in editor
      editorRef.current?.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          a.setAttribute("href", `https://${href}`);
        }
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    }

    handleInput();
    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
  }, [linkUrl, linkText, restoreSelection, handleInput]);

  const cancelLink = useCallback(() => {
    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
    editorRef.current?.focus();
  }, []);

  // ─── Remove link from popover ──────────────────────────────────────────────
  const removeLink = useCallback(() => {
    if (!linkPopover) return;
    const anchor = linkPopover.anchorEl;
    // Replace the <a> with its text content
    const parent = anchor.parentNode;
    if (parent) {
      const text = document.createTextNode(anchor.textContent || "");
      parent.replaceChild(text, anchor);
    }
    setLinkPopover(null);
    handleInput();
  }, [linkPopover, handleInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) {
      const cleanedHtml = sanitizeHtmlStyles(html);
      document.execCommand("insertHTML", false, cleanedHtml);
    } else if (text) {
      document.execCommand("insertText", false, text);
    }
    handleInput();
  }, [handleInput]);

  const isActive = useCallback((command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  const ToolbarButton = ({
    command,
    icon: Icon,
    onClick,
    title,
    active,
  }: {
    command?: string;
    icon: React.ElementType;
    onClick: () => void;
    title: string;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        t.hover,
        (active !== undefined ? active : (command && isActive(command)))
          ? t.active
          : t.muted
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "border rounded-lg overflow-visible transition-colors relative",
        isFocused ? "border-brand/50" : t.border,
        className
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 px-2 py-1.5 border-b rounded-t-lg",
          t.surface,
          t.border
        )}
      >
        <ToolbarButton
          command="bold"
          icon={Bold}
          onClick={() => execCommand("bold")}
          title="Bold (Ctrl+B)"
        />
        <ToolbarButton
          command="italic"
          icon={Italic}
          onClick={() => execCommand("italic")}
          title="Italic (Ctrl+I)"
        />
        <ToolbarButton
          command="underline"
          icon={Underline}
          onClick={() => execCommand("underline")}
          title="Underline (Ctrl+U)"
        />

        <div className={cn("w-px h-5 mx-1", t.divider)} />

        <ToolbarButton
          icon={List}
          onClick={() => execCommand("insertUnorderedList")}
          title="Bullet List"
        />
        <ToolbarButton
          icon={ListOrdered}
          onClick={() => execCommand("insertOrderedList")}
          title="Numbered List"
        />

        <div className={cn("w-px h-5 mx-1", t.divider)} />

        <ToolbarButton
          icon={AlignLeft}
          onClick={() => execCommand("justifyLeft")}
          title="Align Left"
        />
        <ToolbarButton
          icon={AlignCenter}
          onClick={() => execCommand("justifyCenter")}
          title="Align Center"
        />
        <ToolbarButton
          icon={AlignRight}
          onClick={() => execCommand("justifyRight")}
          title="Align Right"
        />

        <div className={cn("w-px h-5 mx-1", t.divider)} />

        <ToolbarButton
          icon={LinkIcon}
          onClick={() => openLinkDialog()}
          title="Insert Link (Ctrl+K)"
        />

        <div className={cn("w-px h-5 mx-1", t.divider)} />

        <ToolbarButton
          icon={Undo}
          onClick={() => execCommand("undo")}
          title="Undo (Ctrl+Z)"
        />
        <ToolbarButton
          icon={Redo}
          onClick={() => execCommand("redo")}
          title="Redo (Ctrl+Shift+Z)"
        />
      </div>

      {/* Insert Link Dialog */}
      {showLinkDialog && (
        <div
          className={cn(
            "px-3 py-2.5 border-b flex flex-col gap-2",
            t.linkBar,
            t.border
          )}
        >
          <div className="flex items-center gap-2">
            <LinkIcon className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className={cn("text-xs font-medium", t.muted)}>Insert Link</span>
          </div>
          <input
            autoFocus
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Display text (optional)"
            className={cn(
              "w-full text-xs border rounded px-2 py-1.5 text-white outline-none focus:border-brand/40",
              t.input
            )}
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); confirmLink(); }
                if (e.key === "Escape") { e.preventDefault(); cancelLink(); }
              }}
              placeholder="https://example.com"
              className={cn(
                "flex-1 text-xs border rounded px-2 py-1.5 text-white outline-none focus:border-brand/40",
                t.input
              )}
            />
            <button
              type="button"
              onClick={confirmLink}
              disabled={!linkUrl.trim()}
              className="p-1.5 rounded bg-brand text-brand-foreground hover:bg-brand/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Apply link"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelLink}
              className={cn(
                "p-1.5 rounded hover:text-white transition-colors",
                t.chip,
                t.muted
              )}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        data-placeholder={placeholder}
        className={cn(
          "px-3 py-2 text-white outline-none overflow-y-auto rounded-b-lg",
          t.surface,
          "prose prose-invert prose-sm max-w-none",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:pointer-events-none",
          t.placeholder,
          "[&_a]:text-brand [&_a]:underline [&_a]:cursor-pointer",
          "[&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:list-decimal [&_ol]:pl-5"
        )}
        style={{ minHeight }}
      />

      {/* Link Preview Popover */}
      {linkPopover && (
        <div
          ref={popoverRef}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
          style={{ top: linkPopover.top, left: linkPopover.left }}
          className={cn(
            "absolute z-50 flex items-center gap-1 border rounded-lg shadow-xl px-2 py-1.5 min-w-0 max-w-xs",
            t.popover
          )}
        >
          {/* Link icon + URL */}
          <LinkIcon className="w-3 h-3 text-brand shrink-0" />
          <span
            className="text-xs text-brand underline truncate max-w-[160px]"
            title={linkPopover.href}
          >
            {shortenUrl(linkPopover.href)}
          </span>

          <div className={cn("w-px h-3.5 mx-0.5 shrink-0", t.popoverDivider)} />

          {/* Open in new tab */}
          <a
            href={linkPopover.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "p-1 rounded hover:text-white transition-colors",
              t.muted,
              t.hover
            )}
            title="Open link"
          >
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Edit link */}
          <button
            type="button"
            onClick={() => openLinkDialog(linkPopover.href, linkPopover.anchorEl)}
            className={cn(
              "p-1 rounded hover:text-white transition-colors",
              t.muted,
              t.hover
            )}
            title="Edit link"
          >
            <Pencil className="w-3 h-3" />
          </button>

          {/* Remove link */}
          <button
            type="button"
            onClick={removeLink}
            className={cn(
              "p-1 rounded hover:text-red-400 transition-colors",
              t.muted,
              t.hover
            )}
            title="Remove link"
          >
            <Unlink className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
