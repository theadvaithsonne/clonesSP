"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GifObject {
  id: string;
  url: string;
  preview: string;
  title: string;
  width?: number;
  height?: number;
}

interface GifPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGif: (gif: GifObject) => void;
}

// Trending categories for quick access
const TRENDING_CATEGORIES = [
  "Agree",
  "Applause",
  "Awww",
  "Dance",
  "Deal with it",
  "Do not want",
  "Eww",
  "Fist bump",
  "Facepalm",
  "Good luck",
  "Happy dance",
  "Hearts",
  "High five",
  "Hug",
  "Kiss",
  "LOL",
  "Mic drop",
  "No",
  "OMG",
  "Oops",
  "Please",
  "Popcorn",
  "Sad",
  "Scared",
  "Shocked",
  "Shrug",
  "Sigh",
  "Slow clap",
  "SMH",
  "Sorry",
  "Thank you",
  "Thumbs down",
  "Thumbs up",
  "Tired",
  "Want",
  "Win",
  "Wink",
  "Yawn",
  "Yes",
  "You got this",
];

export function GifPickerModal({
  open,
  onOpenChange,
  onSelectGif,
}: GifPickerModalProps) {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<GifObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch trending GIFs using Giphy API
  const fetchTrendingGifs = useCallback(async () => {
    setLoading(true);
    try {
      // Use Giphy API
      const giphyKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "GlVGYHkr3WSBnllca54iNt0yFbjz7L65";
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${giphyKey}&limit=30&rating=g`
      );
      const data = await response.json();
      console.log("Giphy API response:", data);

      if (data.data && data.data.length > 0) {
        const gifResults: GifObject[] = data.data.map((gif: any) => ({
          id: gif.id,
          url: gif.images?.original?.url || gif.images?.downsized?.url || "",
          preview: gif.images?.fixed_height?.url || gif.images?.fixed_height_small?.url || gif.images?.downsized?.url || "",
          title: gif.title || "GIF",
          width: parseInt(gif.images?.fixed_height?.width || "200"),
          height: parseInt(gif.images?.fixed_height?.height || "200"),
        })).filter((gif: GifObject) => gif.url && gif.preview);
        setGifs(gifResults);
      } else if (data.meta?.msg) {
        console.error("Giphy API error:", data.meta.msg);
        setGifs([]);
      }
    } catch (error) {
      console.error("Error fetching GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search GIFs using Giphy API
  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }
    setLoading(true);
    try {
      const giphyKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "GlVGYHkr3WSBnllca54iNt0yFbjz7L65";
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(
          query
        )}&limit=30&rating=g`
      );
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const gifResults: GifObject[] = data.data.map((gif: any) => ({
          id: gif.id,
          url: gif.images?.original?.url || gif.images?.downsized?.url || "",
          preview: gif.images?.fixed_height?.url || gif.images?.fixed_height_small?.url || gif.images?.downsized?.url || "",
          title: gif.title || "GIF",
          width: parseInt(gif.images?.fixed_height?.width || "200"),
          height: parseInt(gif.images?.fixed_height?.height || "200"),
        })).filter((gif: GifObject) => gif.url && gif.preview);
        setGifs(gifResults);
      } else {
        setGifs([]);
      }
    } catch (error) {
      console.error("Error searching GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, [fetchTrendingGifs]);

  // Load trending on open
  useEffect(() => {
    if (open) {
      fetchTrendingGifs();
      setSearch("");
      setSelectedCategory(null);
    }
  }, [open, fetchTrendingGifs]);

  // Debounced search
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      if (search) {
        searchGifs(search);
      } else if (!selectedCategory) {
        fetchTrendingGifs();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, searchGifs, fetchTrendingGifs, selectedCategory]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setSearch("");
    searchGifs(category);
  };

  const handleSelectGif = (gif: GifObject) => {
    onSelectGif(gif);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#16181C] border-[#2F3336] max-w-2xl w-full h-[80vh] max-h-[700px] p-0 overflow-hidden flex flex-col"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Wrapper to catch all clicks */}
        <div
          className="flex flex-col h-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
        {/* Header with search */}
        <div className="flex items-center gap-3 p-4 border-b border-[#2F3336]">
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -m-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E767D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedCategory(null);
              }}
              placeholder="Search for GIFs"
              className="w-full bg-[#202327] text-white pl-12 pr-4 py-3 rounded-full text-base outline-none focus:ring-2 focus:ring-[#1D9BF0] placeholder:text-[#6E767D]"
              autoFocus
            />
          </div>
        </div>

        {/* Categories (when no search) */}
        {!search && !selectedCategory && (
          <div className="px-4 py-3 border-b border-[#2F3336] overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2 min-w-max">
              {TRENDING_CATEGORIES.slice(0, 10).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className="px-4 py-2 bg-[#202327] hover:bg-[#2F3336] rounded-full text-sm text-white font-medium transition-colors whitespace-nowrap"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected category header */}
        {selectedCategory && (
          <div className="px-4 py-3 border-b border-[#2F3336] flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedCategory(null);
                fetchTrendingGifs();
              }}
              className="text-[#1D9BF0] hover:underline text-sm"
            >
              ← Back
            </button>
            <span className="text-white font-bold">{selectedCategory}</span>
          </div>
        )}

        {/* GIF grid */}
        <div className="flex-1 overflow-y-auto p-2" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-[#1D9BF0] animate-spin" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#6E767D]">
              <p className="text-lg">No GIFs found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 gap-2 space-y-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelectGif(gif)}
                  className="w-full break-inside-avoid block rounded-lg overflow-hidden hover:ring-2 hover:ring-[#1D9BF0] transition-all relative group"
                >
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  {/* Hover overlay with title */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                    <span className="p-2 text-white text-sm font-medium truncate w-full">
                      {gif.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2F3336] flex items-center justify-center">
          <a href="https://giphy.com/" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
            <img
              src="https://giphy.com/static/img/giphy_logo_square_social.png"
              alt="Powered by GIPHY"
              className="h-6"
            />
          </a>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
