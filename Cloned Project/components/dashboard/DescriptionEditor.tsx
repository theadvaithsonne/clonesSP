import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  X,
  Check,
  ExternalLink,
  Pencil,
  Unlink,
} from "lucide-react";

interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Normalize a URL so it always has an absolute protocol. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Truncate long URLs for display */
function shortenUrl(url: string, max = 46): string {
  return url.length <= max ? url : url.slice(0, max - 1) + "…";
}

interface LinkPopover {
  href: string;
  anchorEl: HTMLAnchorElement;
  top: number;
  left: number;
}

export default function DescriptionEditor({
  value,
  onChange,
  placeholder,
}: DescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
  });

  // Insert-link dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedRange = useRef<Range | null>(null);
  const editingAnchor = useRef<HTMLAnchorElement | null>(null);

  // Link-preview popover
  const [linkPopover, setLinkPopover] = useState<LinkPopover | null>(null);

  // ─── Sync external value → editor ────────────────────────────────────────
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  // ─── Close popover on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !target.closest("a")
      ) {
        setLinkPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateActiveStates = () => {
    if (typeof window !== "undefined") {
      setActiveStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        list: document.queryCommandState("insertUnorderedList"),
      });
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      // Normalize all anchors so they always open correctly
      editorRef.current.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          a.setAttribute("href", `https://${href}`);
        }
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCommand = (command: string, val: string = "") => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    updateActiveStates();
    handleInput();
  };

  // ─── Open insert/edit link dialog ────────────────────────────────────────
  const openLinkDialog = useCallback(
    (prefillHref?: string, anchor?: HTMLAnchorElement) => {
      const sel = window.getSelection();
      if (anchor) {
        // Editing existing link — select it
        const range = document.createRange();
        range.selectNode(anchor);
        savedRange.current = range;
        setLinkText(anchor.textContent || "");
      } else if (sel && sel.rangeCount > 0) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
        setLinkText(sel.toString());
      } else {
        savedRange.current = null;
        setLinkText("");
      }
      editingAnchor.current = anchor || null;
      setLinkUrl(prefillHref || "");
      setLinkPopover(null);
      setShowLinkDialog(true);
    },
    []
  );

  const restoreSelection = useCallback(() => {
    if (savedRange.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
    }
  }, []);

  const confirmLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    const normalized = normalizeUrl(linkUrl);
    const displayText = linkText.trim() || normalized;

    editorRef.current?.focus();

    if (editingAnchor.current) {
      // Update the existing anchor in-place
      editingAnchor.current.href = normalized;
      editingAnchor.current.target = "_blank";
      editingAnchor.current.rel = "noopener noreferrer";
      if (linkText.trim()) editingAnchor.current.textContent = linkText.trim();
    } else {
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const hasText = !range.collapsed && range.toString().trim().length > 0;
        if (hasText) {
          document.execCommand("createLink", false, normalized);
          // Apply target/_blank to newly created link
          editorRef.current?.querySelectorAll("a").forEach((a) => {
            if (a.getAttribute("href") === normalized) {
              a.setAttribute("target", "_blank");
              a.setAttribute("rel", "noopener noreferrer");
            }
          });
        } else {
          // No selection — insert anchor with display text
          range.collapse(true);
          const anchor = document.createElement("a");
          anchor.href = normalized;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.textContent = displayText;
          range.insertNode(anchor);
          range.setStartAfter(anchor);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }

    handleInput();
    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
    editingAnchor.current = null;
  }, [linkUrl, linkText, restoreSelection]);

  const cancelLink = useCallback(() => {
    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
    editingAnchor.current = null;
    editorRef.current?.focus();
  }, []);

  // ─── Remove link ─────────────────────────────────────────────────────────
  const removeLink = useCallback(() => {
    if (!linkPopover) return;
    const anchor = linkPopover.anchorEl;
    const parent = anchor.parentNode;
    if (parent) {
      const text = document.createTextNode(anchor.textContent || "");
      parent.replaceChild(text, anchor);
    }
    setLinkPopover(null);
    handleInput();
  }, [linkPopover]);

  // ─── Click inside editor → intercept link clicks ─────────────────────────
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target || !wrapperRef.current) return;

    e.preventDefault(); // don't navigate while editing

    const anchor = target as HTMLAnchorElement;
    const href = anchor.getAttribute("href") || "";

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    const top = anchorRect.bottom - wrapperRect.top + 6;
    const left = Math.max(0, Math.min(
      anchorRect.left - wrapperRect.left,
      wrapperRect.width - 280 // keep popover from overflowing right edge
    ));

    setLinkPopover({ href, anchorEl: anchor, top, left });
  }, []);

  // ─── Popover hover persistence ────────────────────────────────────────────
  const clearHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };
  const scheduleHide = () => {
    clearHide();
    hideTimer.current = setTimeout(() => setLinkPopover(null), 220);
  };

  // ─── Toolbar button style helper ─────────────────────────────────────────
  const btnCls = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? "text-brand bg-brand/10 hover:bg-brand/20"
        : "text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]"
    }`;

  return (
    <div
      ref={wrapperRef}
      className="relative border border-[#2a2a35] rounded-xl overflow-visible focus-within:border-brand/60 transition-colors"
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[#131316] border-b border-[#2a2a35] rounded-t-xl">
        <button type="button" onClick={() => handleCommand("bold")} title="Bold" className={btnCls(activeStates.bold)}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => handleCommand("italic")} title="Italic" className={btnCls(activeStates.italic)}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => handleCommand("underline")} title="Underline" className={btnCls(activeStates.underline)}>
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => openLinkDialog()} title="Insert / Edit Link" className={btnCls(false)}>
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => handleCommand("insertUnorderedList")} title="List" className={btnCls(activeStates.list)}>
          <List className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Insert-link dialog ───────────────────────────────────────────── */}
      {showLinkDialog && (
        <div className="px-3 py-2.5 bg-[#1a1a22] border-b border-[#2a2a35] flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-xs font-medium text-[#9fa0b8]">
              {editingAnchor.current ? "Edit Link" : "Insert Link"}
            </span>
          </div>

          {/* Display text */}
          <input
            autoFocus
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Display text (optional)"
            className="w-full text-xs bg-[#0d0d10] border border-[#2a2a35] rounded px-2 py-1.5 text-white placeholder-[#5a5a6e] outline-none focus:border-brand/40"
          />

          {/* URL + action buttons */}
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
              className="flex-1 text-xs bg-[#0d0d10] border border-[#2a2a35] rounded px-2 py-1.5 text-white placeholder-[#5a5a6e] outline-none focus:border-brand/40"
            />
            <button
              type="button"
              onClick={confirmLink}
              disabled={!linkUrl.trim()}
              title="Apply"
              className="p-1.5 rounded bg-brand text-brand-foreground hover:bg-brand/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelLink}
              title="Cancel"
              className="p-1.5 rounded bg-[#2a2a35] text-[#9fa0b8] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Editing area ─────────────────────────────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onSelect={updateActiveStates}
        onKeyUp={updateActiveStates}
        onMouseUp={updateActiveStates}
        onClick={handleEditorClick}
        placeholder={placeholder}
        className="w-full bg-[#131316] text-white text-sm px-3 py-2.5 outline-none min-h-[120px] max-h-[300px] overflow-y-auto rounded-b-xl
                   empty:before:content-[attr(placeholder)] empty:before:text-[#4a4a5a] empty:before:pointer-events-none empty:before:italic
                   [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                   [&_a]:text-brand [&_a]:underline [&_a]:cursor-pointer"
      />

      {/* ── Link-preview popover ─────────────────────────────────────────── */}
      {linkPopover && (
        <div
          ref={popoverRef}
          onMouseEnter={clearHide}
          onMouseLeave={scheduleHide}
          style={{ top: linkPopover.top, left: linkPopover.left }}
          className="absolute z-50 flex items-center gap-1 bg-[#1e1e2a] border border-[#3a3a4a] rounded-lg shadow-2xl px-2 py-1.5 max-w-[280px]"
        >
          {/* Link icon + URL text */}
          <Link2 className="w-3 h-3 text-brand shrink-0" />
          <span
            className="text-xs text-brand underline truncate"
            title={linkPopover.href}
          >
            {shortenUrl(linkPopover.href)}
          </span>

          <div className="w-px h-3.5 bg-[#3a3a4a] mx-0.5 shrink-0" />

          {/* Open in new tab */}
          <a
            href={linkPopover.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open link"
            className="p-1 rounded text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Edit link */}
          <button
            type="button"
            title="Edit link"
            onClick={() => openLinkDialog(linkPopover.href, linkPopover.anchorEl)}
            className="p-1 rounded text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35] transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>

          {/* Remove link */}
          <button
            type="button"
            title="Remove link"
            onClick={removeLink}
            className="p-1 rounded text-[#9fa0b8] hover:text-red-400 hover:bg-[#2a2a35] transition-colors"
          >
            <Unlink className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
