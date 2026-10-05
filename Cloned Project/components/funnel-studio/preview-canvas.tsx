"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import type { FunnelNode, FunnelTemplate } from "@/lib/funnel-tree";
import type { FunnelLink } from "@/lib/api/funnels";
import { youTubeThumb } from "@/lib/youtube";
import { type Path } from "./tree-ops";

interface PreviewCanvasProps {
  template: FunnelTemplate;
  selected: Path | null;
  node: FunnelNode | null;
  onSelect: (path: Path | null) => void;
  /** When the funnel has an attached product, the end screen is the product CTA
   *  (what the visitor actually gets) instead of the sign-up screen. */
  link?: FunnelLink | null;
}

export function PreviewCanvas({ template, selected, node, onSelect, link }: PreviewCanvasProps) {
  return (
    <div className="relative flex h-full min-h-[560px] flex-col items-center justify-center">
      {/* spotlight stage — makes the device feel intentionally placed */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,194,0,0.09),transparent_70%)] blur-2xl" />

      {/* Phone frame — realistic ~19.5:9 device, fixed header + scrollable body,
          clamped to the viewport so it always fits. */}
      <div className="relative w-full max-w-[360px]">
        <div className="relative flex h-[760px] max-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-[2.6rem] border border-white/10 bg-[#0a0a0a] shadow-[0_45px_110px_-25px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.05]">
          {/* speaker grabber (no overlap — keeps the logo clear) */}
          <div className="flex shrink-0 items-center justify-center pb-1 pt-2.5">
            <span className="h-1 w-14 rounded-full bg-white/15" />
          </div>
          {/* funnel header (mirrors /f/[id]) */}
          <div className="flex shrink-0 items-center justify-center border-b border-white/[0.06] bg-[#080808]/80 px-4 pb-3 pt-1 backdrop-blur-xl">
            <Image
              src="/garage-logo.png"
              alt="Garage"
              width={96}
              height={26}
              className="h-5 w-auto opacity-90"
            />
          </div>

          {/* scrollable screen body — centers short content, scrolls long content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <motion.div
              key={JSON.stringify(selected)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex min-h-full flex-col justify-center px-4 py-6"
            >
              <Screen
                template={template}
                selected={selected}
                node={node}
                onSelect={onSelect}
                link={link}
              />
            </motion.div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-600">
          Live preview — exactly what the visitor sees
        </p>
      </div>
    </div>
  );
}

function Screen({
  template,
  selected,
  node,
  onSelect,
  link,
}: PreviewCanvasProps) {
  // Opening question
  if (selected === null || !node) {
    return (
      <Question
        prompt={template.rootQuestion || "Which of the following best describes you?"}
        options={template.options}
        onPick={(i) => onSelect([i])}
      />
    );
  }

  // A branch leads to its sub-question (never plays videos); a leaf plays its
  // videos then registration.
  if (node.children.length > 0) {
    return (
      <Question
        prompt={node.prompt || "Select an option"}
        options={node.children}
        onPick={(i) => onSelect([...selected, i])}
      />
    );
  }
  if (node.videos.length > 0) {
    return <VideoStep node={node} link={link} />;
  }
  return link ? <ProductScreen link={link} /> : <RegisterScreen />;
}

function Question({
  prompt,
  options,
  onPick,
}: {
  prompt: string;
  options: FunnelNode[];
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-5 text-center text-base font-semibold text-white">{prompt}</h1>
      <div className="flex w-full flex-col gap-2">
        {options.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-zinc-600">
            No options yet — add one to see it here.
          </div>
        )}
        {options.map((o, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left text-xs text-zinc-300 transition-colors hover:border-brand/50 hover:bg-white/[0.05]"
          >
            <span className="mr-2 font-semibold text-brand">{i + 1}.</span>
            {o.label || <span className="text-zinc-600">Untitled option</span>}
          </button>
        ))}
      </div>
      <button
        disabled
        className="mt-5 w-full rounded-xl bg-gradient-to-br from-brand to-[#FFA800] py-2.5 text-xs font-semibold text-brand-foreground opacity-60"
      >
        Continue
      </button>
    </div>
  );
}

function VideoStep({ node, link }: { node: FunnelNode; link?: FunnelLink | null }) {
  const [i, setI] = useState(0);
  const idx = Math.min(i, node.videos.length - 1);
  const v = node.videos[idx];

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h2 className="text-sm font-semibold text-white">
          {v.title || "Untitled video"}
        </h2>
        {v.subtitle && (
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{v.subtitle}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-black">
        {v.youtubeId ? (
          <div className="relative aspect-video w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={youTubeThumb(v.youtubeId)}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/90">
                <Play className="h-5 w-5 text-black" />
              </span>
            </div>
            <span className="absolute bottom-1.5 right-1.5 rounded bg-red-600 px-1 text-[9px] font-bold text-white">
              YouTube
            </span>
          </div>
        ) : v.videoUrl ? (
          <video key={v.videoUrl} src={v.videoUrl} controls className="aspect-video w-full" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-xs text-zinc-600">
            uploading…
          </div>
        )}
      </div>

      {node.videos.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={idx === 0}
            onClick={() => setI(idx - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-zinc-500">
            {idx + 1} / {node.videos.length}
          </span>
          <button
            disabled={idx === node.videos.length - 1}
            onClick={() => setI(idx + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center text-[10px] text-zinc-500">
        after the last video → {link ? "product" : "registration"}
      </div>
    </div>
  );
}

function RegisterScreen() {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
        <UserPlus className="h-7 w-7" />
      </span>
      <h2 className="text-base font-semibold text-white">Seen enough?</h2>
      <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-zinc-500">
        Get started today — it&apos;s free. Create your account to continue.
      </p>
      <button
        disabled
        className="mt-5 rounded-xl bg-gradient-to-br from-brand to-[#FFA800] px-6 py-2.5 text-xs font-semibold text-brand-foreground opacity-60"
      >
        Register Now
      </button>
    </div>
  );
}

/** End screen when the funnel has an attached product — mirrors the public
 *  ProductCTA (image · name · price + a "Get <product>" button). */
function ProductScreen({ link }: { link: FunnelLink }) {
  const sym = !link.currency || link.currency === "USD" ? "$" : `${link.currency} `;
  const price =
    link.price && link.price > 0
      ? `${sym}${link.price.toFixed(2)}`
      : link.price === 0
        ? "Free"
        : "";

  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
        <ShoppingBag className="h-7 w-7" />
      </span>
      <h2 className="text-base font-semibold text-white">Ready to get started?</h2>

      <div className="mt-4 w-full max-w-[260px] rounded-2xl border border-white/[0.1] bg-white/[0.05] p-3">
        <div className="flex items-center gap-2.5">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.03]">
            {link.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] text-zinc-600">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="line-clamp-2 text-[11px] font-semibold text-white">{link.name}</p>
            {price && <p className="mt-0.5 text-[11px] text-zinc-300">{price}</p>}
          </div>
        </div>
      </div>

      <button
        disabled
        className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand to-[#FFA800] px-6 py-2.5 text-xs font-semibold text-brand-foreground opacity-60"
      >
        Get {link.name.length > 16 ? "This" : link.name}
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
