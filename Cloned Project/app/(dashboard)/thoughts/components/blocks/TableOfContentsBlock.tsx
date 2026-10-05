"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RefreshCw, Settings2, Eye, EyeOff, Plus, Trash2, Pencil } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface TOCEntry {
  id: string;
  text: string;
  level: number;
  blockId?: string;
  isCustom?: boolean;
}

function TableOfContentsRenderer({ block, editor }: { block: any; editor: any }) {
  const savedEntries = block.props?.entries ? JSON.parse(block.props.entries) : [];
  const savedMaxDepth = block.props?.maxDepth ? parseInt(block.props.maxDepth) : 3;
  const savedHiddenIds = block.props?.hiddenIds ? new Set(JSON.parse(block.props.hiddenIds)) : new Set();

  const [entries, setEntries] = useState<TOCEntry[]>(savedEntries);
  const [maxDepth, setMaxDepth] = useState(savedMaxDepth);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(savedHiddenIds);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryText, setNewEntryText] = useState("");
  const [newEntryLevel, setNewEntryLevel] = useState(1);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(false);

  const tocProps = useMemo(() => ({
    entries: JSON.stringify(entries),
    maxDepth: String(maxDepth),
    hiddenIds: JSON.stringify(Array.from(hiddenIds)),
  }), [entries, maxDepth, hiddenIds]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    editor.updateBlock(block, { props: tocProps });
  }, [tocProps, editor, block]);

  useEffect(() => {
    const updateHeadings = () => {
      const currentHeadingIds = new Set<string>();
      const headingsFromDoc: Map<string, TOCEntry> = new Map();

      editor.document.forEach((block: any) => {
        if (block.type === "heading") {
          const level = block.props?.level || 1;
          let text = "";
          if (block.content && Array.isArray(block.content)) {
            text = block.content.map((c: any) => c.text || "").join("");
          }
          currentHeadingIds.add(block.id);
          if (text.trim()) {
            headingsFromDoc.set(block.id, { id: block.id, text, level, blockId: block.id });
          }
        }
      });

      setEntries((prev) => {
        const customEntries = prev.filter((e) => e.isCustom);
        const existingAuto = prev.filter(
          (e) => !e.isCustom && e.blockId && currentHeadingIds.has(e.blockId)
        );
        const updatedAuto = existingAuto.map((e) => {
          const docHeading = headingsFromDoc.get(e.blockId!);
          return docHeading || e;
        });
        const existingIds = new Set(updatedAuto.map((e) => e.blockId));
        const newAuto: TOCEntry[] = [];
        headingsFromDoc.forEach((entry, blockId) => {
          if (!existingIds.has(blockId)) {
            newAuto.push(entry);
          }
        });
        return [...updatedAuto, ...newAuto, ...customEntries];
      });
    };

    updateHeadings();
    const unsubscribe = editor.onChange(updateHeadings);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [editor]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (showAddEntry && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddEntry]);

  const scrollToHeading = useCallback((blockId: string) => {
    const el = document.querySelector(`[data-id="${blockId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-emerald-500/50", "ring-offset-1", "ring-offset-transparent");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500/50", "ring-offset-1", "ring-offset-transparent");
      }, 1500);
    }
  }, []);

  const toggleHeading = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startEditing = useCallback((entry: TOCEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.text);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingId || !editValue.trim()) {
      setEditingId(null);
      return;
    }

    const entry = entries.find((e) => e.id === editingId);
    if (entry?.blockId && !entry.isCustom) {
      const block = editor.getBlock(entry.blockId);
      if (block) {
        editor.updateBlock(block, {
          content: [{ type: "text", text: editValue.trim(), styles: {} }],
        });
      }
    } else {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId ? { ...e, text: editValue.trim() } : e
        )
      );
    }

    setEditingId(null);
    setEditValue("");
  }, [editingId, editValue, entries, editor]);

  const addCustomEntry = useCallback(() => {
    if (!newEntryText.trim()) return;
    const newEntry: TOCEntry = {
      id: `custom-${Date.now()}`,
      text: newEntryText.trim(),
      level: newEntryLevel,
      isCustom: true,
    };
    setEntries((prev) => [...prev, newEntry]);
    setNewEntryText("");
    setShowAddEntry(false);
  }, [newEntryText, newEntryLevel]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const filteredEntries = entries.filter(
    (e) => e.level <= maxDepth && !hiddenIds.has(e.id)
  );

  const displayEntries =
    filteredEntries.length > 0
      ? filteredEntries
      : entries.length === 0
        ? [
            { id: "intro", text: "Introduction", level: 1 },
            { id: "start", text: "Getting Started", level: 1 },
            { id: "basic", text: "Basic Blocks", level: 2 },
            { id: "advanced", text: "Advanced Features", level: 2 },
            { id: "ai", text: "AI Tools", level: 3 },
          ]
        : [];

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
          Table of Contents
        </span>
        <div className="flex items-center gap-1.5">
          {entries.length > 0 && (
            <span className="text-[10px] text-zinc-600">{filteredEntries.length} headings</span>
          )}
          <button
            onClick={() => setShowAddEntry(!showAddEntry)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              showAddEntry ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Add entry"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              const currentHeadingIds = new Set<string>();
              const headingsFromDoc: Map<string, TOCEntry> = new Map();
              editor.document.forEach((block: any) => {
                if (block.type === "heading") {
                  const level = block.props?.level || 1;
                  let text = "";
                  if (block.content && Array.isArray(block.content)) {
                    text = block.content.map((c: any) => c.text || "").join("");
                  }
                  currentHeadingIds.add(block.id);
                  if (text.trim()) {
                    headingsFromDoc.set(block.id, { id: block.id, text, level, blockId: block.id });
                  }
                }
              });
              setEntries((prev) => {
                const customEntries = prev.filter((e) => e.isCustom);
                const existingAuto = prev.filter(
                  (e) => !e.isCustom && e.blockId && currentHeadingIds.has(e.blockId)
                );
                const updatedAuto = existingAuto.map((e) => {
                  const docHeading = headingsFromDoc.get(e.blockId!);
                  return docHeading || e;
                });
                const existingIds = new Set(updatedAuto.map((e) => e.blockId));
                headingsFromDoc.forEach((entry, blockId) => {
                  if (!existingIds.has(blockId)) {
                    updatedAuto.push(entry);
                  }
                });
                return [...updatedAuto, ...customEntries];
              });
            }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh headings"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              showSettings ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Settings"
          >
            <Settings2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Add entry form */}
      {showAddEntry && (
        <div className="px-3 py-2 border-b border-zinc-800/40 space-y-2">
          <div className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Add Entry</div>
          <div className="flex items-center gap-2">
            <input
              ref={addInputRef}
              value={newEntryText}
              onChange={(e) => setNewEntryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomEntry();
                if (e.key === "Escape") setShowAddEntry(false);
              }}
              placeholder="Entry text..."
              className="flex-1 bg-zinc-800 text-[11px] text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-500"
            />
            <select
              value={newEntryLevel}
              onChange={(e) => setNewEntryLevel(Number(e.target.value))}
              className="bg-zinc-800 text-[10px] text-zinc-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
            <button
              onClick={addCustomEntry}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1.5 rounded transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && entries.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-800/40 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 font-medium">Max depth:</span>
            {[1, 2, 3].map((depth) => (
              <button
                key={depth}
                onClick={() => setMaxDepth(depth)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  maxDepth === depth
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                H{depth}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-zinc-500">Click pencil to edit, eye to hide, trash to remove</div>
        </div>
      )}

      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        {displayEntries.map((h, i) => {
          let mlClass = "";
          let textColor = "";
          if (h.level === 1) {
            mlClass = "";
            textColor = "text-zinc-200";
          } else if (h.level === 2) {
            mlClass = "ml-3";
            textColor = "text-zinc-300";
          } else {
            mlClass = "ml-6";
            textColor = "text-zinc-500";
          }

          const isFallback = entries.length === 0;

          return (
            <div
              key={h.id + "-" + i}
              className={`flex items-center group/heading ${mlClass}`}
            >
              {editingId === h.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={saveEditing}
                    className="flex-1 bg-zinc-800 text-[11px] text-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!isFallback && h.blockId) scrollToHeading(h.blockId);
                  }}
                  className={`flex-1 text-left text-[11px] ${textColor} hover:text-emerald-300 transition-colors px-1.5 py-1 rounded hover:bg-zinc-800/40 ${
                    isFallback ? "cursor-default opacity-60" : "cursor-pointer"
                  }`}
                >
                  {h.level === 1 && (
                    <span className="text-[8px] text-zinc-600 mr-1 font-mono">H{h.level}</span>
                  )}
                  {h.text}
                </button>
              )}
              {entries.length > 0 && (showSettings || !isFallback) && editingId !== h.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/heading:opacity-100 transition-all">
                  <button
                    onClick={() => startEditing(h)}
                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                    title="Edit heading"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  {entries.length > 0 && showSettings && (
                    <>
                      <button
                        onClick={() => toggleHeading(h.id)}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                        title={hiddenIds.has(h.id) ? "Show heading" : "Hide heading"}
                      >
                        {hiddenIds.has(h.id) ? (
                          <EyeOff className="h-2.5 w-2.5" />
                        ) : (
                          <Eye className="h-2.5 w-2.5" />
                        )}
                      </button>
                      <button
                        onClick={() => removeEntry(h.id)}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                        title="Remove entry"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const tableOfContentsBlock = createReactBlockSpec(
  {
    type: "tableOfContents" as const,
    propSchema: {
      entries: { default: "[]", type: "string" },
      maxDepth: { default: "3", type: "string" },
      hiddenIds: { default: "[]", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <TableOfContentsRenderer block={block} editor={editor} />;
    },
  }
);
