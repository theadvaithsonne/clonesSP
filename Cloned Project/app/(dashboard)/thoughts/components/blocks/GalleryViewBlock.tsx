"use client";

import React, { useState, useCallback, useRef } from "react";
import { ImageUp, Plus, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";

interface GalleryCard {
  id: string;
  label: string;
  imageUrl?: string;
}

let cardIdCounter = 5;

function generateId() {
  return `gallery-${cardIdCounter++}`;
}

const INITIAL_CARDS: GalleryCard[] = [
  { id: "gallery-1", label: "Card 1" },
  { id: "gallery-2", label: "Card 2" },
  { id: "gallery-3", label: "Card 3" },
  { id: "gallery-4", label: "Card 4" },
];

function GalleryBlock({ block, editor }: { block: any; editor: any }) {
  const loadedCards = block.props?.cards ? JSON.parse(block.props.cards) : INITIAL_CARDS;
  const [cards, setCards] = useState(loadedCards);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const newCardInput = useRef<HTMLInputElement | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [uploading, setUploading] = useState<Set<string>>(new Set());

  const persistCards = useCallback((newCards: GalleryCard[]) => {
    setCards(newCards);
    editor.updateBlock(block, { props: { cards: JSON.stringify(newCards) } });
  }, [editor, block]);

  const addCard = useCallback(() => {
    const newCard: GalleryCard = { id: generateId(), label: "" };
    persistCards([...cardsRef.current, newCard]);
    requestAnimationFrame(() => {
      newCardInput.current?.focus();
      newCardInput.current?.select();
    });
  }, [persistCards]);

  const removeCard = useCallback((id: string) => {
    persistCards(cardsRef.current.filter((c) => c.id !== id));
  }, [persistCards]);

  const updateLabel = useCallback(
    (id: string, label: string) => {
      persistCards(
        cardsRef.current.map((c) => (c.id === id ? { ...c, label } : c))
      );
    },
    [persistCards]
  );

  const handleFileUpload = useCallback(async (cardId: string, file: File) => {
    setUploading((prev) => new Set(prev).add(cardId));
    try {
      const response = await uploadFiles("postImages", { files: [file] });
      if (response && response[0]?.url) {
        const next = cardsRef.current.map((c) =>
          c.id === cardId ? { ...c, imageUrl: response[0].url } : c
        );
        persistCards(next);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  }, [persistCards]);

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
          GALLERY
        </span>
        <span className="text-[10px] text-zinc-600">{cards.length} cards</span>
      </div>
      <div className="grid grid-cols-4 gap-2 p-3">
        {cards.map((card) => (
          <div key={card.id} className="group cursor-pointer relative">
            <div
              className="aspect-square bg-zinc-800/50 rounded-lg border-2 border-dashed border-zinc-700/50 flex flex-col items-center justify-center gap-1.5 hover:border-emerald-500/40 hover:bg-zinc-800/80 transition-all relative overflow-hidden"
              onClick={() => {
                if (!card.imageUrl) {
                  fileInputRefs.current.get(card.id)?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-emerald-400", "bg-emerald-500/10");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-500/10");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-500/10");
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  handleFileUpload(card.id, file);
                }
              }}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={(el) => {
                  fileInputRefs.current.set(card.id, el);
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(card.id, file);
                }}
              />
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.label}
                  className="w-full h-full object-cover rounded-md"
                />
              ) : uploading.has(card.id) ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <span className="text-[9px] text-emerald-400 font-medium">Uploading...</span>
                </div>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-full bg-zinc-700/60 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <ImageUp className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-medium group-hover:text-emerald-400 transition-colors">
                    Add cover
                  </span>
                </>
              )}
            </div>
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCard(card.id);
              }}
              className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 hover:bg-red-500/80 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10"
              title="Remove card"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="mt-1.5 px-0.5">
              <input
                value={card.label}
                onChange={(e) => updateLabel(card.id, e.target.value)}
                placeholder="Untitled"
                className="w-full bg-transparent text-[11px] text-zinc-300 font-medium truncate focus:outline-none focus:text-zinc-100 placeholder-zinc-600"
              />
            </div>
          </div>
        ))}
        {/* Add card tile */}
        <button
          onClick={addCard}
          className="group cursor-pointer focus:outline-none"
        >
          <div className="aspect-square bg-zinc-800/30 rounded-lg border-2 border-dashed border-zinc-700/30 flex flex-col items-center justify-center gap-1.5 hover:border-emerald-500/40 hover:bg-zinc-800/60 transition-all">
            <div className="w-7 h-7 rounded-full bg-zinc-700/40 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
              <Plus className="h-4 w-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="text-[9px] text-zinc-500 font-medium group-hover:text-emerald-400 transition-colors">
              Add card
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

export const galleryViewBlock = createReactBlockSpec(
  {
    type: "galleryView" as const,
    propSchema: {
      cards: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <GalleryBlock block={block} editor={editor} />,
  }
);
