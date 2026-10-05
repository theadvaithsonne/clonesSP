// Browser-side client for our /api/giphy proxy. The proxy handles auth
// (server-side GIPHY_API_KEY env var) so this file just builds the request
// and normalizes the response.
//
// Docs for the upstream shape: https://developers.giphy.com/docs/api/

const PROXY = "/api/giphy";

export interface GiphyImageVariant {
  url: string;
  width?: string; // Giphy returns numbers as strings
  height?: string;
  size?: string;
  mp4?: string;
  webp?: string;
}

export interface GiphyGif {
  id: string;
  title?: string;
  url?: string; // Giphy share URL
  images: {
    fixed_width_small?: GiphyImageVariant;
    fixed_width?: GiphyImageVariant;
    fixed_height_small?: GiphyImageVariant;
    fixed_height?: GiphyImageVariant;
    original?: GiphyImageVariant;
    downsized?: GiphyImageVariant;
    preview_gif?: GiphyImageVariant;
  };
}

interface GiphyResponse {
  data: GiphyGif[];
  pagination?: { total_count: number; count: number; offset: number };
}

export type GiphyRating = "g" | "pg" | "pg-13" | "r";

interface FetchOpts {
  limit?: number;
  offset?: number;
  rating?: GiphyRating;
}

interface CallParams {
  action: "search" | "trending";
  type: "gifs" | "stickers";
  q?: string;
  opts?: FetchOpts;
}

async function callProxy({ action, type, q, opts = {} }: CallParams): Promise<GiphyResponse> {
  const url = new URL(PROXY, window.location.origin);
  url.searchParams.set("action", action);
  url.searchParams.set("type", type);
  if (q) url.searchParams.set("q", q);
  if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset != null) url.searchParams.set("offset", String(opts.offset));
  if (opts.rating) url.searchParams.set("rating", opts.rating);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || body?.detail || "";
    } catch {}
    if (res.status === 503) {
      throw new Error(
        "GIPHY not configured — set GIPHY_API_KEY in .env and restart the server."
      );
    }
    throw new Error(detail || `Giphy proxy ${res.status}`);
  }
  return res.json();
}

export async function giphyTrending(opts: FetchOpts = {}): Promise<GiphyResponse> {
  return callProxy({ action: "trending", type: "gifs", opts });
}

export async function giphySearch(
  query: string,
  opts: FetchOpts = {}
): Promise<GiphyResponse> {
  return callProxy({ action: "search", type: "gifs", q: query, opts });
}

export async function giphyStickersTrending(
  opts: FetchOpts = {}
): Promise<GiphyResponse> {
  return callProxy({ action: "trending", type: "stickers", opts });
}

export async function giphyStickersSearch(
  query: string,
  opts: FetchOpts = {}
): Promise<GiphyResponse> {
  return callProxy({ action: "search", type: "stickers", q: query, opts });
}

// Tiny helper: Giphy returns dimensions as strings — coerce to number.
function num(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Preview = grid thumbnail. We prefer fixed_width_small (~100px wide) so the
// 3-col grid stays light. Falls through to larger variants if missing.
export function pickPreview(g: GiphyGif): { url: string; w?: number; h?: number } {
  const v =
    g.images.fixed_width_small ||
    g.images.fixed_height_small ||
    g.images.preview_gif ||
    g.images.fixed_width ||
    g.images.fixed_height ||
    g.images.downsized;
  if (!v?.url) return { url: "" };
  return { url: v.url, w: num(v.width), h: num(v.height) };
}

// Share = full-quality URL we embed in the chat bubble. We prefer downsized
// (~2 MB cap, still high quality) before falling back to original.
export function pickShare(g: GiphyGif): { url: string; w?: number; h?: number; source?: string } {
  const v =
    g.images.downsized ||
    g.images.original ||
    g.images.fixed_height ||
    g.images.fixed_width;
  if (!v?.url) return { url: "" };
  return { url: v.url, w: num(v.width), h: num(v.height), source: g.url };
}
