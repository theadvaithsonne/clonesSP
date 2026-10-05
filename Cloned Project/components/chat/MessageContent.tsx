"use client";

import React, { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MapPin, User as UserIcon, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CodeBlock, InlineCode } from "@/components/chat/CodeBlock";
import { parseMarker } from "@/lib/chat-markers";
import {
  TaskCard,
  PollCard,
  MeetCard,
  DealCard,
  ApprovalCard,
  DocCard,
  ShareCard,
} from "@/components/chat/SlashCommandCards";
import { cn } from "@/lib/utils";

type MemberLite = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
};

interface MessageContentProps {
  text: string;
  isOwnMessage?: boolean;
  // Optional mention support (used by GroupChatPage). `mentions` holds the
  // mentioned users' IDs, exactly as the backend stores them.
  mentions?: string[];
  userMap?: Record<string, MemberLite>;
  currentUserId?: string;
}

/** Mention key for @all / @here, which the backend expands to member IDs. */
const MENTION_EVERYONE = "everyone";

type MentionTarget = { label: string; key: string };

// What can follow "@" for each mentioned user, keyed by that user's ID. The
// backend resolves a mention from a member's full name, email or ID, so those
// are the strings to look for. Longest first, so "@Chiranjeeb Jena" is tagged
// as a whole even when another member is called just "Chiranjeeb".
function mentionTargets(
  mentions?: string[],
  userMap?: Record<string, MemberLite>
): MentionTarget[] {
  if (!mentions || mentions.length === 0) return [];
  const out: MentionTarget[] = [];
  for (const id of mentions) {
    if (!id) continue;
    const u = userMap?.[id];
    for (const label of [u?.name?.trim(), u?.email?.trim(), id]) {
      if (label) out.push({ label, key: id });
    }
  }
  out.push(
    { label: "all", key: MENTION_EVERYONE },
    { label: "here", key: MENTION_EVERYONE }
  );
  return out.sort((a, b) => b.label.length - a.label.length);
}

// Pre-process plain message text into markdown that react-markdown can render.
// Steps:
//   1. Convert @Mentions into custom markdown links (mention://<userId>) —
//      only for users in the message's `mentions`.
//   2. Wrap bare URLs into [url](url) so react-markdown renders them as links
//      (gfm autolink doesn't always catch them).
// Code spans/blocks are left untouched so backticks keep working.
function preprocess(text: string, targets: MentionTarget[]): string {
  if (!text) return "";

  // One alternation, one pass: a shorter name can't then match again inside
  // the link a longer one has already become. The trailing boundary is the
  // one the backend uses when it resolves mentions.
  const mentionRe = targets.length
    ? new RegExp(
        `(?<![\\w@])@(${targets
          .map((t) => t.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})(?=\\s|$|[.,!?;:])`,
        "gi"
      )
    : null;
  const keyByLabel = new Map<string, string>();
  for (const t of targets) {
    const k = t.label.toLowerCase();
    if (!keyByLabel.has(k)) keyByLabel.set(k, t.key);
  }

  // Split out code regions so we don't mutate text inside them
  // (covers ``` blocks and `inline` code)
  const codeRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = text.split(codeRegex);

  return parts
    .map((part, i) => {
      // Odd indexes are code segments — return as-is
      if (i % 2 === 1) return part;

      let out = part;

      // Mentions → markdown link with mention:// scheme, keeping the text as
      // typed
      if (mentionRe) {
        out = out.replace(mentionRe, (tag: string, label: string) => {
          const key = keyByLabel.get(label.toLowerCase()) ?? label;
          const linkText = tag.replace(/[\\[\]`]/g, "\\$&");
          return `[${linkText}](mention://${encodeURIComponent(key)})`;
        });
      }

      // WhatsApp-style single-char formatting shortcuts → standard markdown.
      // Order matters: do these BEFORE URL conversion so we don't accidentally
      // wrap parts of links.
      //
      //   *bold*    → **bold**   (single asterisks; ignore ** and ***)
      //   ~strike~  → ~~strike~~ (single tildes;     ignore ~~ and ~~~ )
      //
      // _italic_ and `code` are already valid markdown, no rewrite needed.
      // The regex uses a lookbehind to skip if preceded by another * (so
      // **already bold** is not double-wrapped), and a non-greedy match for
      // the content between the delimiters.
      out = out.replace(
        /(?<![\*\w])\*(?!\*)(?!\s)([^\*\n]+?)(?<!\s)\*(?!\*)/g,
        (_m, body) => `**${body}**`
      );
      out = out.replace(
        /(?<![~\w])~(?!~)(?!\s)([^~\n]+?)(?<!\s)~(?!~)/g,
        (_m, body) => `~~${body}~~`
      );

      // Bare URLs → autolinks (skip ones already inside parens of an existing link)
      const urlRe = /(?<!\]\()https?:\/\/[^\s<>)]+/g;
      out = out.replace(urlRe, (u) => `[${u}](${u})`);

      // Preserve single newlines the user typed by turning them into markdown
      // hard breaks ("  \n"). Markdown otherwise collapses single newlines
      // into spaces, which would surprise chat users.
      out = out.replace(/([^\n])\n(?!\n)/g, "$1  \n");

      return out;
    })
    .join("");
}

// Render a location card (clickable Google Maps link)
function LocationCard({
  data,
  isOwn,
}: {
  data: { lat: number; lng: number; label?: string };
  isOwn?: boolean;
}) {
  const mapsUrl = `https://www.google.com/maps?q=${data.lat},${data.lng}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-md border overflow-hidden no-underline",
        isOwn ? "bg-black/15 border-black/25" : "bg-white/5 border-white/10"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="h-20 w-full bg-cover bg-center"
        style={{
          // Static OSM tile preview (no API key). Falls back to plain bg if blocked.
          backgroundImage: `linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25)), url(https://staticmap.openstreetmap.de/staticmap.php?center=${data.lat},${data.lng}&zoom=14&size=300x80&markers=${data.lat},${data.lng},lightblue)`,
        }}
      />
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <MapPin className="h-3 w-3 text-rose-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-white truncate">
            {data.label || "Shared location"}
          </div>
          <div className="text-[9px] text-white/50 truncate">
            {data.lat.toFixed(4)}, {data.lng.toFixed(4)}
          </div>
        </div>
        <ExternalLink className="h-2.5 w-2.5 text-white/40 shrink-0" />
      </div>
    </a>
  );
}

// Render an animated GIF/sticker card. Stickers get a transparent background
// since they're typically transparent PNGs/WebPs and don't need a tile bg.
function GifCard({
  data,
  isOwn,
}: {
  data: { url: string; w?: number; h?: number; title?: string; kind?: "gif" | "sticker"; source?: string };
  isOwn?: boolean;
}) {
  const isSticker = data.kind === "sticker";
  // Cap the displayed size so a single GIF doesn't blow out the bubble.
  const maxW = isSticker ? 140 : 220;
  const ratio = data.w && data.h ? data.h / data.w : undefined;
  const renderedH = ratio ? Math.round(maxW * ratio) : undefined;
  return (
    <a
      href={data.source || data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "block overflow-hidden rounded-md",
        isSticker ? "bg-transparent" : isOwn ? "bg-black/15" : "bg-white/5"
      )}
      style={{ width: maxW, height: renderedH }}
      title={data.title || (isSticker ? "Sticker" : "GIF")}
    >
      <img
        src={data.url}
        alt={data.title || "GIF"}
        width={maxW}
        height={renderedH}
        loading="lazy"
        className="block w-full h-auto"
      />
    </a>
  );
}

// Render a contact card
function ContactCard({
  data,
  isOwn,
}: {
  data: { id: string; name: string; email?: string; avatar?: string; role?: string };
  isOwn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 min-w-[180px]",
        isOwn ? "bg-black/15 border-black/25" : "bg-white/5 border-white/10"
      )}
    >
      <Avatar className="h-8 w-8 border border-white/10">
        <AvatarImage src={data.avatar || ""} />
        <AvatarFallback className="text-[10px] bg-[#2E2E2E] text-white">
          {data.name?.charAt(0) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-white truncate flex items-center gap-1">
          <UserIcon className="h-2.5 w-2.5 text-blue-400" />
          {data.name}
        </div>
        {data.email && (
          <div className="text-[9px] text-white/50 truncate">{data.email}</div>
        )}
        {data.role && (
          <div className="text-[8px] text-white/40 truncate">{data.role}</div>
        )}
      </div>
    </div>
  );
}

export function MessageContent({
  text,
  isOwnMessage = false,
  mentions,
  userMap,
  currentUserId,
}: MessageContentProps) {
  // Compute marker + preprocessed text up-front to keep hook order stable.
  const marker = useMemo(() => parseMarker(text), [text]);
  const targets = useMemo(
    () => mentionTargets(mentions, userMap),
    [mentions, userMap]
  );
  const processed = useMemo(() => preprocess(text, targets), [text, targets]);

  if (marker?.type === "location") {
    return <LocationCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "contact") {
    return <ContactCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "gif") {
    return <GifCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "task") {
    return <TaskCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "poll") {
    return <PollCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "meet") {
    return <MeetCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "deal") {
    return <DealCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "approval") {
    return (
      <ApprovalCard
        data={marker.data}
        isOwn={isOwnMessage}
        currentUserId={currentUserId}
      />
    );
  }
  if (marker?.type === "doc") {
    return <DocCard data={marker.data} isOwn={isOwnMessage} />;
  }
  if (marker?.type === "share") {
    return <ShareCard data={marker.data} isOwn={isOwnMessage} />;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // The default transform blanks every scheme except http(s)/mailto/irc/
      // xmpp, which turned each mention:// link into href="" before `a` below
      // could recognise it. Only callers passing `mentions` (group chat) let
      // it through; DMs keep the default untouched.
      urlTransform={(url) =>
        mentions && url.startsWith("mention://")
          ? url
          : defaultUrlTransform(url)
      }
      // Restrict and customize the rendered elements so they look right inside
      // a tight chat bubble (no oversized headings, paragraphs are spans).
      components={{
        // Render paragraphs as plain spans so chat bubbles can keep their
        // inline metadata (timestamp, edit marker) on the same line as the
        // final line of text. Block-level markdown (lists, code blocks)
        // still produces real block elements.
        p: ({ children }) => <span>{children}</span>,
        a: ({ href, children }) => {
          const url = href || "";
          // Mention link
          if (url.startsWith("mention://")) {
            let key = url.slice("mention://".length);
            try {
              key = decodeURIComponent(key);
            } catch {}
            // Only tag users the backend actually resolved — a hand-typed
            // [@x](mention://…) link renders as plain text.
            const resolved =
              key === MENTION_EVERYONE
                ? !!mentions?.length
                : !!mentions?.includes(key);
            if (!resolved) return <>{children}</>;
            // @all / @here tag you when the backend expanded them to you.
            const isSelf =
              !!currentUserId &&
              (key === MENTION_EVERYONE
                ? !!mentions?.includes(currentUserId)
                : key === currentUserId);
            // WhatsApp-style: the whole tag, every word of the name, in the
            // brand colour; a tint behind it when the tag is you.
            return (
              <span
                className={cn(
                  "font-semibold text-brand",
                  isSelf && "rounded bg-brand/15 px-0.5 box-decoration-clone"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </span>
            );
          }
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "underline transition-colors break-all",
                isOwnMessage
                  ? "text-indigo-200 hover:text-purple-200"
                  : "text-indigo-400 hover:text-purple-400"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        del: ({ children }) => <del className="line-through opacity-80">{children}</del>,
        code: ({ inline, className: cl, children }: any) => {
          const raw = String(children).replace(/\n$/, "");
          if (inline) return <InlineCode>{raw}</InlineCode>;
          const langMatch = /language-([\w-]+)/.exec(cl || "");
          return <CodeBlock code={raw} lang={langMatch?.[1]} />;
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => <ul className="list-disc pl-5 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-1">{children}</ol>,
        li: ({ children }) => <li className="my-0.5">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/30 pl-2 my-1 italic opacity-90">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <span className="block font-semibold">{children}</span>,
        h2: ({ children }) => <span className="block font-semibold">{children}</span>,
        h3: ({ children }) => <span className="block font-semibold">{children}</span>,
        hr: () => <hr className="my-1 border-white/10" />,
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}
