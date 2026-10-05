"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Search, X, Loader2, Sticker, ImagePlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  pickPreview,
  pickShare,
  giphySearch,
  giphyTrending,
  giphyStickersSearch,
  giphyStickersTrending,
  type GiphyGif,
} from "@/lib/giphy";
import { encodeGif } from "@/lib/chat-markers";

interface GifPickerProps {
  onShare: (encoded: string) => void;
  className?: string;
  /**
   * Controlled mode: the parent owns whether the picker is open (its own
   * "+" menu opens it) and hides the built-in trigger. Leave both unset for
   * the self-contained button-plus-modal the DM composer uses.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

type Tab = "gifs" | "stickers";

export function GifPicker({
  onShare,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: GifPickerProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [tab, setTab] = useState<Tab>("gifs");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server proxy returns a 503 (translated to a "GIPHY not configured"
  // Error message) when GIPHY_API_KEY is missing. We surface that as a
  // dedicated setup screen instead of a generic red error.
  const [notConfigured, setNotConfigured] = useState(false);
  const queryTimer = useRef<NodeJS.Timeout | null>(null);
  const requestSeq = useRef(0);

  // Load results when the picker opens, the tab changes, or the query changes.
  // Query changes are debounced so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        let data;
        const q = query.trim();
        if (tab === "stickers") {
          data = q
            ? await giphyStickersSearch(q, { limit: 30 })
            : await giphyStickersTrending({ limit: 30 });
        } else {
          data = q
            ? await giphySearch(q, { limit: 30 })
            : await giphyTrending({ limit: 30 });
        }
        // Out-of-order guard: if another request started after this one,
        // discard the response.
        if (requestSeq.current !== seq) return;
        setResults(data.data || []);
      } catch (err: any) {
        if (requestSeq.current !== seq) return;
        const msg = err?.message || "Failed to load";
        // The proxy translates a missing server-side key into this prefix.
        // Anything else is treated as a real error.
        if (msg.startsWith("GIPHY not configured")) {
          setNotConfigured(true);
          setError(null);
        } else {
          setNotConfigured(false);
          setError(msg);
        }
        setResults([]);
      } finally {
        if (requestSeq.current === seq) setLoading(false);
      }
    };

    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(run, query ? 300 : 0);
    return () => {
      if (queryTimer.current) clearTimeout(queryTimer.current);
    };
  }, [open, tab, query]);

  const pick = (g: GiphyGif) => {
    const share = pickShare(g);
    if (!share.url) return;
    onShare(
      encodeGif({
        url: share.url,
        w: share.w,
        h: share.h,
        title: g.title,
        kind: tab === "stickers" ? "sticker" : "gif",
        source: share.source,
      })
    );
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
            className
          )}
          title="Send a GIF or sticker"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#15151b] border border-[#2E2E2E] rounded-lg w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
            style={{ maxHeight: "min(540px, 85vh)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2E2E2E]">
              <div className="flex items-center gap-2 text-white text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                GIFs & Stickers
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded text-[#9fa0b8] hover:text-white hover:bg-[#2E2E2E]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#2E2E2E] shrink-0">
              {(["gifs", "stickers"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors",
                    tab === t
                      ? "text-white border-b-2 border-brand"
                      : "text-[#9fa0b8] hover:text-white"
                  )}
                >
                  {t === "gifs" ? (
                    <ImagePlay className="h-3.5 w-3.5" />
                  ) : (
                    <Sticker className="h-3.5 w-3.5" />
                  )}
                  {t === "gifs" ? "GIFs" : "Stickers"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-[#2E2E2E] shrink-0">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0e0e12] border border-[#2E2E2E]">
                <Search className="h-3 w-3 text-[#6E6E6E]" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "stickers"
                      ? "Search GIPHY stickers…"
                      : "Search GIPHY GIFs…"
                  }
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#6E6E6E] outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-[#6E6E6E] hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-2 min-h-[180px]">
              {notConfigured ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                  <Sparkles className="h-8 w-8 text-fuchsia-400/70 mb-2" />
                  <p className="text-xs text-white font-medium mb-1">
                    GIF picker not configured
                  </p>
                  <p className="text-[10px] text-[#9fa0b8] max-w-[280px]">
                    Set <code className="text-brand">GIPHY_API_KEY</code>{" "}
                    in your <code className="text-brand">.env</code> file and
                    restart the dev server to enable GIPHY GIF + sticker search.
                  </p>
                  <a
                    href="https://developers.giphy.com/dashboard/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-[10px] underline text-[#9fa0b8] hover:text-white"
                  >
                    Get a free GIPHY API key
                  </a>
                </div>
              ) : loading ? (
                <div className="h-full flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#9fa0b8]" />
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center px-4 py-8 text-center">
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              ) : results.length === 0 ? (
                <div className="h-full flex items-center justify-center py-10 text-xs text-[#9fa0b8]">
                  No results
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {results.map((g) => {
                    const preview = pickPreview(g);
                    if (!preview.url) return null;
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => pick(g)}
                        className={cn(
                          "relative overflow-hidden rounded-md border border-transparent hover:border-brand/60 bg-[#0e0e12] aspect-square focus:outline-none focus:border-brand"
                        )}
                        title={g.title}
                      >
                        <img
                          src={preview.url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GIPHY attribution (required by their brand guidelines) */}
            {!notConfigured && (
              <div className="px-3 py-1.5 border-t border-[#2E2E2E] text-[9px] text-[#6E6E6E] text-center shrink-0">
                Powered by GIPHY
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
