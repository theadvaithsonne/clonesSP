/* eslint-disable @typescript-eslint/no-explicit-any */

// Parse a YouTube video id from any common URL form (or a bare 11-char id).
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  const patterns = [
    /youtube\.com\/watch\?[^\s]*\bv=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(s)) return s;
  return null;
}

// A no-API thumbnail for a video id.
export function youTubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Load the YouTube IFrame Player API once; resolves with the global `YT` namespace.
let apiPromise: Promise<any> | null = null;
export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}
