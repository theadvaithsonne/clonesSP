"use client";

import React, { useState, useCallback, useRef } from "react";
import { FileText, Plus, Upload, ExternalLink, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";

interface DocItem {
  id: string;
  label: string;
  fileUrl?: string;
  fileName?: string;
}

let docIdCounter = 4;

function generateId() {
  return `doc-${docIdCounter++}`;
}

const INITIAL_ITEMS: DocItem[] = [
  { id: "doc-1", label: "Meeting Notes" },
  { id: "doc-2", label: "Project Tracker" },
  { id: "doc-3", label: "Research Doc" },
];

function DocumentListBlock({ block, editor }: { block: any; editor: any }) {
  const loadedItems = block.props?.items ? JSON.parse(block.props.items) : INITIAL_ITEMS;
  const [items, setItems] = useState(loadedItems);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const newItemInput = useRef<HTMLInputElement | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [uploading, setUploading] = useState<Set<string>>(new Set());

  const persistItems = useCallback((newItems: DocItem[]) => {
    setItems(newItems);
    editor.updateBlock(block, { props: { items: JSON.stringify(newItems) } });
  }, [editor, block]);

  const addItem = useCallback(() => {
    const newItem: DocItem = { id: generateId(), label: "" };
    persistItems([...itemsRef.current, newItem]);
    requestAnimationFrame(() => {
      newItemInput.current?.focus();
      newItemInput.current?.select();
    });
  }, [persistItems]);

  const removeItem = useCallback((id: string) => {
    persistItems(itemsRef.current.filter((item) => item.id !== id));
  }, [persistItems]);

  const updateLabel = useCallback(
    (id: string, label: string) => {
      persistItems(
        itemsRef.current.map((item) => (item.id === id ? { ...item, label } : item))
      );
    },
    [persistItems]
  );

  const handleFileUpload = useCallback(async (itemId: string, file: File) => {
    setUploading((prev) => new Set(prev).add(itemId));
    try {
      const endpoint = file.type.startsWith("image/") ? "postImages"
        : file.type.startsWith("video/") ? "postVideos"
        : "postDocuments";
      const response = await uploadFiles(endpoint, { files: [file] });
      if (response && response[0]?.url) {
        const next = itemsRef.current.map((item) =>
          item.id === itemId
            ? { ...item, fileUrl: response[0].url, fileName: file.name, label: item.label || file.name }
            : item
        );
        persistItems(next);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [persistItems]);

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
          DOCUMENTS
        </span>
        <span className="ml-2 text-[10px] text-zinc-600">{items.length}</span>
      </div>
      <div className="flex flex-col">
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/40 transition-colors group">
              <input
                type="file"
                className="hidden"
                ref={(el) => {
                  fileInputRefs.current.set(item.id, el);
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(item.id, file);
                }}
              />
              {item.fileUrl ? (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <input
                    ref={i === items.length - 1 ? newItemInput : undefined}
                    value={item.label}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateLabel(item.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Untitled document"
                    className="flex-1 bg-transparent text-[13px] text-zinc-200 font-medium focus:outline-none placeholder-zinc-500 min-w-0"
                  />
                  <span className="text-[10px] text-emerald-400 shrink-0">Open</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => fileInputRefs.current.get(item.id)?.click()}
                    className="w-7 h-7 rounded-md bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-colors"
                    title="Upload file"
                  >
                    {uploading.has(item.id) ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </button>
                  <input
                    ref={i === items.length - 1 ? newItemInput : undefined}
                    value={item.label}
                    onChange={(e) => updateLabel(item.id, e.target.value)}
                    placeholder="Untitled document"
                    className="flex-1 bg-transparent text-[13px] text-zinc-200 font-medium focus:outline-none placeholder-zinc-500 min-w-0"
                  />
                </div>
              )}
              <button
                onClick={() => removeItem(item.id)}
                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {i < items.length - 1 && (
              <div className="h-px bg-zinc-800/60 mx-3" />
            )}
          </React.Fragment>
        ))}
      </div>
      <button
        onClick={addItem}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors border-t border-zinc-800/40"
      >
        <Plus className="h-3 w-3" />
        Add item
      </button>
    </div>
  );
}

export const documentListBlock = createReactBlockSpec(
  {
    type: "documentList" as const,
    propSchema: {
      items: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <DocumentListBlock block={block} editor={editor} />,
  }
);
