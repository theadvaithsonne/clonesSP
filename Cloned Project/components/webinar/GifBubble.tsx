"use client";

import type { GifData } from "@/lib/chat-markers";

/**
 * A GIF or sticker in a webinar chat stream.
 *
 * Shared by the live panel and the recorded-session replay so a GIF looks
 * the same in both. That matters more than it sounds: chat history is no
 * longer deleted when a webinar ends, so every GIF sent live is replayed
 * later — a renderer that only existed in the live panel would leave the
 * replay showing raw marker JSON.
 *
 * Sized smaller than the DM equivalent because this is a narrow sidebar
 * beside the video, not a full-width conversation. Stickers keep a
 * transparent background; they're usually transparent assets and a tile
 * behind them looks wrong.
 *
 * Not a link. It used to open the GIF's GIPHY page in a new tab, which
 * nobody asked for — a click on a message should reach the row's own
 * actions (react, reply), not leave the webinar.
 */
export function GifBubble({ data }: { data: GifData }) {
  const isSticker = data.kind === "sticker";
  const maxW = isSticker ? 120 : 190;
  const ratio = data.w && data.h ? data.h / data.w : undefined;
  const renderedH = ratio ? Math.round(maxW * ratio) : undefined;

  return (
    <div
      className={`mt-0.5 block overflow-hidden rounded-md ${
        isSticker ? "bg-transparent" : "bg-white/5"
      }`}
      style={{ width: maxW, height: renderedH }}
      title={data.title || (isSticker ? "Sticker" : "GIF")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.url}
        alt={data.title || (isSticker ? "Sticker" : "GIF")}
        width={maxW}
        height={renderedH}
        loading="lazy"
        className="block h-auto w-full"
      />
    </div>
  );
}
