// Status pill mirroring NC's voice-memo states (pending → transcribing
// → processing → ready, plus failed). The label tracks pipeline stage
// so the user knows whether the memo is still working.

import type { MemoStatus } from "@/lib/api/voice-memos";

const COPY: Record<MemoStatus, { label: string; className: string }> = {
  pending: {
    label: "Queued",
    className: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  },
  transcribing: {
    label: "Transcribing",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  processing: {
    label: "Summarizing",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  ready: {
    label: "Ready",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

export default function VoiceMemoStatusBadge({
  status,
}: {
  status: MemoStatus;
}) {
  const c = COPY[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}
