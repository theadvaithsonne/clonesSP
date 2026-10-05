"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  MessageSquareText,
  Youtube,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FunnelNode, FunnelVideo } from "@/lib/funnel-tree";
import type { Path } from "./tree-ops";
import { parseYouTubeId, youTubeThumb } from "@/lib/youtube";

interface NodeInspectorProps {
  selected: Path | null;
  node: FunnelNode | null;
  rootQuestion: string;
  onRootQuestion: (v: string) => void;
  onPatch: (patch: Partial<FunnelNode>) => void;
  uploadFn: (file: File) => Promise<{ key: string; publicUrl: string }>;
}

export function NodeInspector({
  selected,
  node,
  rootQuestion,
  onRootQuestion,
  onPatch,
  uploadFn,
}: NodeInspectorProps) {
  // ── Root / opening question ──────────────────────────────────────────────
  if (selected === null) {
    return (
      <div className="space-y-4">
        <SectionLabel>Opening question</SectionLabel>
        <p className="text-xs leading-relaxed text-zinc-500">
          The first thing every visitor sees. It’s the same across the whole
          funnel — the options below it decide where each visitor goes.
        </p>
        <Textarea
          value={rootQuestion}
          onChange={(e) => onRootQuestion(e.target.value)}
          placeholder="e.g. Which of the following best describes you?"
          className="min-h-[80px] resize-none bg-white/[0.03] border-white/10 text-white"
        />
        <p className="text-[11px] text-zinc-600">
          Add and arrange the answer options from the structure panel on the left.
        </p>
      </div>
    );
  }

  if (!node) return null;

  const videos = node.videos;
  const isBranch = node.children.length > 0;

  const setVideo = (i: number, patch: Partial<FunnelVideo>) =>
    onPatch({ videos: videos.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const removeVideo = (i: number) =>
    onPatch({ videos: videos.filter((_, j) => j !== i) });
  const moveVideo = (i: number, dir: "up" | "down") => {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= videos.length) return;
    const copy = [...videos];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onPatch({ videos: copy });
  };

  const setChildLabel = (i: number, label: string) =>
    onPatch({ children: node.children.map((c, j) => (j === i ? { ...c, label } : c)) });
  const removeChild = (i: number) =>
    onPatch({ children: node.children.filter((_, j) => j !== i) });
  const addChildOption = () =>
    onPatch({
      children: [
        ...node.children,
        { label: "", order: node.children.length, videos: [], children: [] },
      ],
    });
  // Converting between the two mutually-exclusive modes (videos on leaves only).
  const convertToBranch = () =>
    onPatch({ videos: [], children: [{ label: "", order: 0, videos: [], children: [] }] });
  const convertToLeaf = () => onPatch({ prompt: "", children: [] });

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Option label</SectionLabel>
        <Input
          value={node.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="What the visitor taps (e.g. “I own a business”)"
          className="mt-2 bg-white/[0.03] border-white/10 text-white"
        />
      </div>

      {isBranch ? (
        /* BRANCH — this option leads to a sub-question with its own options */
        <div className="space-y-4">
          <div>
            <SectionLabel>
              <MessageSquareText className="mr-1 inline h-3 w-3" />
              Follow-up question
            </SectionLabel>
            <Input
              value={node.prompt ?? ""}
              onChange={(e) => onPatch({ prompt: e.target.value })}
              placeholder="e.g. What kind of business do you run?"
              className="mt-2 bg-white/[0.03] border-white/10 text-white"
            />
          </div>
          <div>
            <SectionLabel>Its options</SectionLabel>
            <div className="mt-2 space-y-1.5">
              {node.children.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-zinc-400">
                    {i + 1}
                  </span>
                  <Input
                    value={c.label}
                    onChange={(e) => setChildLabel(i, e.target.value)}
                    placeholder="Option label"
                    className="h-8 bg-white/[0.03] border-white/10 text-sm text-white"
                  />
                  <button
                    title="Remove option"
                    onClick={() => removeChild(i)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addChildOption}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-brand/50 hover:text-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </button>
            <p className="mt-2 text-[11px] text-zinc-600">
              Select any option in the structure panel to give it videos or a further question.
            </p>
          </div>
          <button
            onClick={convertToLeaf}
            className="text-[11px] text-zinc-500 underline-offset-2 hover:text-red-400 hover:underline"
          >
            Remove follow-up question (make this a video step)
          </button>
        </div>
      ) : (
        /* LEAF — plays videos in order, then registration */
        <>
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>
                Videos <span className="text-zinc-600">· play in order</span>
              </SectionLabel>
              {videos.length > 0 && (
                <span className="text-[11px] text-zinc-500">
                  {videos.length} step{videos.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {videos.map((v, i) => (
                <VideoRow
                  key={i}
                  index={i}
                  total={videos.length}
                  video={v}
                  onChange={(patch) => setVideo(i, patch)}
                  onRemove={() => removeVideo(i)}
                  onMove={(dir) => moveVideo(i, dir)}
                />
              ))}
            </div>
            <UploadButton
              uploadFn={uploadFn}
              onUploaded={(v) =>
                onPatch({
                  videos: [
                    ...videos,
                    { ...v, key: crypto.randomUUID(), order: videos.length },
                  ],
                })
              }
            />
            <YouTubeAddRow
              onAdd={(youtubeId) =>
                onPatch({
                  videos: [
                    ...videos,
                    {
                      title: "",
                      subtitle: "",
                      youtubeId,
                      key: crypto.randomUUID(),
                      order: videos.length,
                    },
                  ],
                })
              }
            />
          </div>
          <button
            onClick={convertToBranch}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-brand/50 hover:text-brand"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Ask a follow-up question instead
          </button>
        </>
      )}

      {/* Flow summary */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
        <span className="text-zinc-500">When picked → </span>
        {isBranch ? (
          <span className="text-zinc-300">
            ask “{node.prompt || "follow-up question"}” ({node.children.length} option
            {node.children.length === 1 ? "" : "s"})
          </span>
        ) : videos.length > 0 ? (
          <span className="text-zinc-300">
            play {videos.length} video{videos.length === 1 ? "" : "s"} →{" "}
            <span className="inline-flex items-center gap-1 text-brand">
              <UserPlus className="h-3 w-3" /> registration
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-brand">
            <UserPlus className="h-3 w-3" /> registration
          </span>
        )}
      </div>
    </div>
  );
}

function VideoRow({
  index,
  total,
  video,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  video: FunnelVideo;
  onChange: (patch: Partial<FunnelVideo>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="flex gap-2.5">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black">
          {video.youtubeId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={youTubeThumb(video.youtubeId)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : video.videoUrl ? (
            <video
              src={video.videoUrl}
              className="h-full w-full object-cover"
              preload="metadata"
              muted
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              <Film className="h-5 w-5" />
            </div>
          )}
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
            {index + 1}
          </span>
          {video.youtubeId && (
            <span className="absolute bottom-1 right-1 rounded bg-red-600 px-1 text-[8px] font-bold text-white">
              YT
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            value={video.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Heading"
            className="h-8 bg-white/[0.03] border-white/10 text-sm text-white"
          />
          <Input
            value={video.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Subtext"
            className="h-8 bg-white/[0.03] border-white/10 text-xs text-zinc-300"
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <button
            title="Move up"
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            title="Move down"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            title="Remove video"
            onClick={onRemove}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadButton({
  uploadFn,
  onUploaded,
}: {
  uploadFn: (file: File) => Promise<{ key: string; publicUrl: string }>;
  onUploaded: (v: FunnelVideo) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    try {
      setBusy(true);
      const { key, publicUrl } = await uploadFn(file);
      onUploaded({
        title: file.name.replace(/\.[^.]+$/, ""),
        subtitle: "",
        s3Key: key,
        videoUrl: publicUrl,
        order: 0,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
      <button
        disabled={busy}
        onClick={() => ref.current?.click()}
        className={cn(
          "mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-colors",
          "bg-gradient-to-br from-brand to-[#FFA800] text-brand-foreground hover:brightness-105",
          busy && "opacity-70"
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" /> Upload video
          </>
        )}
      </button>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
      {children}
    </span>
  );
}

function YouTubeAddRow({ onAdd }: { onAdd: (youtubeId: string) => void }) {
  const [url, setUrl] = useState("");
  const submit = () => {
    const id = parseYouTubeId(url);
    if (!id) {
      toast.error("Enter a valid YouTube link");
      return;
    }
    onAdd(id);
    setUrl("");
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Paste a YouTube link"
        className="h-9 bg-white/[0.03] border-white/10 text-sm text-white"
      />
      <button
        type="button"
        onClick={submit}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-brand/50 hover:text-brand"
      >
        <Youtube className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}
