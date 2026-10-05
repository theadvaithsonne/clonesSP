// Shared placeholder for admin nav entries whose translated page hasn't
// shipped yet. Lets the sidebar link somewhere real (no 404) while the
// Figma → code work moves through the queue.

import { Sparkles } from "lucide-react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center backdrop-blur-xl">
      <div className="mb-4 rounded-full border border-[#FBD10D]/30 bg-[#FBD10D]/10 p-3">
        <Sparkles className="h-6 w-6 text-[#FBD10D]" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      <p className="max-w-md text-sm text-zinc-400">
        {description ??
          "This section is being redesigned. It will land here as soon as the translated page is ready."}
      </p>
    </div>
  );
}
