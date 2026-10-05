// Shared helpers for parsing/transforming YouTube & Vimeo video URLs.
// Consolidates duplicated logic from CoursesPage, ContentPage, and guest pages.

const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function getYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

export function getYouTubeEmbedUrl(url: string): string {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

export function getYouTubeThumbnail(
  url: string,
  quality: "default" | "mq" | "hq" | "sd" | "maxres" = "hq"
): string | null {
  const id = getYouTubeId(url);
  if (!id) return null;
  const map = {
    default: "default",
    mq: "mqdefault",
    hq: "hqdefault",
    sd: "sddefault",
    maxres: "maxresdefault",
  } as const;
  return `https://img.youtube.com/vi/${id}/${map[quality]}.jpg`;
}

export function getVimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : url;
}

export function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export function isVimeoUrl(url: string): boolean {
  return url.includes("vimeo.com");
}

export type YouTubeOEmbed = {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  provider_name: string;
};

// Fetches public oEmbed metadata (title, channel, thumbnail) for a YouTube URL.
// No API key required. Returns null if the URL isn't YouTube or the request fails.
export async function fetchYouTubeOEmbed(
  url: string,
  signal?: AbortSignal
): Promise<YouTubeOEmbed | null> {
  const id = getYouTubeId(url);
  if (!id) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { signal }
    );
    if (!res.ok) return null;
    return (await res.json()) as YouTubeOEmbed;
  } catch {
    return null;
  }
}
