"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ExternalLink, Image as ImageIcon } from "lucide-react";

type LinkMetadata = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
};

/** `token` overrides the user token — the admin console passes its admin token. */
export function LinkPreview({ url, token }: { url: string; token?: string | null }) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await api<{
          success?: boolean;
          ok?: boolean;
          metadata?: LinkMetadata;
          meta?: {
            title?: string;
            description?: string;
            thumbnail?: string;
            author?: string;
          };
        }>(
          `/link-preview?url=${encodeURIComponent(url)}`,
          {
            method: "GET",
          },
          token || getToken()!
        );

        if (!cancelled && (res.ok || res.success)) {
          if (res.metadata) {
            setMetadata(res.metadata);
          } else if (res.meta) {
            setMetadata({
              title: res.meta.title,
              description: res.meta.description,
              image: res.meta.thumbnail,
              siteName: res.meta.author,
              url: url,
            });
          } else {
            setError(true);
          }
        } else if (!cancelled) {
          setError(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-between gap-3 mt-1.5 p-2 rounded-r border-l-[3px] border-primary bg-black/25 w-full max-w-sm animate-pulse">
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-white/10 rounded w-1/4" />
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
        <div className="w-16 h-16 rounded bg-white/10 flex-shrink-0" />
      </div>
    );
  }

  // If there's an error, or we couldn't fetch metadata, or the metadata is completely empty,
  // do not render the preview box at all so we don't clutter the chat with a giant empty box.
  // A result with only an image or a site name is still worth showing — the hostname stands in for the title.
  if (error || !metadata) {
    return null;
  }
  const hasMetadata =
    !!metadata.title || !!metadata.description || !!metadata.image || !!metadata.siteName;
  if (!hasMetadata) {
    return null;
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  // Decode HTML entities (like &quot; or &#39;)
  const decodeHtml = (str: string) => {
    if (!str) return "";
    return str
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  };

  const title = decodeHtml(metadata.title || hostname);
  const description = decodeHtml(metadata.description || "");
  
  // Only show site name at the top if it is different from the hostname (to avoid repeating hostname twice)
  const showSiteName = metadata.siteName && 
    metadata.siteName.toLowerCase() !== hostname.toLowerCase() && 
    metadata.siteName.toLowerCase() !== hostname.replace(/^www\./i, "").toLowerCase();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1.5 rounded-r bg-black/25 hover:bg-black/35 border-l-[3px] border-primary transition-all duration-150 overflow-hidden group max-w-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-stretch justify-between min-h-[60px]">
        {/* Left Side: Content */}
        <div className="flex-1 p-2 min-w-0 flex flex-col justify-center gap-0.5">
          {showSiteName && (
            <span className="text-[9px] font-bold text-primary tracking-wide uppercase leading-none mb-0.5">
              {decodeHtml(metadata.siteName!)}
            </span>
          )}
          {/* Title in bold white */}
          <span className="text-[11.5px] font-semibold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {title}
          </span>
          {/* Description */}
          {description && description.toLowerCase() !== title.toLowerCase() && (
            <p className="text-[10px] text-zinc-400 line-clamp-1 leading-normal mt-0.5">
              {description}
            </p>
          )}
          {/* Hostname at the bottom */}
          <span className="text-[9.5px] text-zinc-400 font-medium leading-none mt-0.5">
            {hostname}
          </span>
        </div>

        {/* Right Side: Square Thumbnail */}
        {metadata.image && (
          <div className="w-16 flex-shrink-0 relative overflow-hidden bg-black/30 flex items-center justify-center">
            <img
              src={metadata.image}
              alt={title}
              // Many sites hotlink-block by Referer; sending none makes the og:image load.
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </a>
  );
}
