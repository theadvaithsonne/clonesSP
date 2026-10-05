"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PhoneOff, Maximize2 } from "lucide-react";
import { useWorkspaceLiveKit } from "@/lib/workspace-livekit-context";
import { cn } from "@/lib/utils";

// Persistent in-app PiP bridge for the workspace LiveKit call (the HQ
// conference room shared between /workspace and the ConferenceRoomPage
// popover). Renders a compact floating pill at the dashboard layout
// level whenever:
//
//   • The user is currently in a workspace call (inCall=true on the
//     layout-scoped useWorkspaceLiveKit) — provided by the lift to a
//     shared provider in f5af85ba + ff2a831b. Without that lift this
//     component couldn't see the call from outside its host pages.
//
//   • The user has navigated AWAY from the call's render-host page
//     (anything not under /workspace). The ConferenceRoomPage popover
//     also hosts the call, but it lives over the dashboard URL the
//     user was on — when the popover is closed AND inCall is still
//     true, that's exactly the case the persistent PiP exists to
//     solve.
//
// V1 is intentionally a status pill (no video preview) — keeps the
// component tiny, avoids any double-render risk with the host pages,
// and gets the persistence affordance shipped today. Video tile can
// layer on later via the same tracks the host pages already render.
export default function WorkspacePipBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { inCall, leaveCall } = useWorkspaceLiveKit();

  // Hide while the user is on the workspace page itself — the full
  // call UI is rendered there, the pill would be redundant. The
  // ConferenceRoomPage popover doesn't change the URL, so when the
  // popover is open over a non-workspace URL the pill would render
  // alongside; popover takes over the viewport visually, so they
  // don't fight for the same screen real estate.
  const onHostPage = useMemo(
    () => Boolean(pathname?.startsWith("/workspace")),
    [pathname],
  );

  const onReturnToWorkspace = useCallback(() => {
    router.push("/workspace");
  }, [router]);

  const onHangup = useCallback(() => {
    leaveCall();
  }, [leaveCall]);

  if (!inCall || onHostPage) return null;

  return (
    <div
      className={cn(
        // bottom-right, above mobile-nav and most floating UI; not so
        // aggressive that it covers chat input on small viewports.
        "fixed bottom-4 right-4 z-[60]",
        "flex items-center gap-2 rounded-full",
        "bg-[#0f0f12]/95 border border-emerald-400/30 shadow-lg shadow-black/40",
        "px-3 py-2 backdrop-blur",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
      role="status"
      aria-live="polite"
      aria-label="Conference call in progress"
    >
      {/* Live indicator dot */}
      <span
        aria-hidden
        className="relative flex h-2 w-2 shrink-0"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>

      <span className="text-xs text-white/90 font-medium pr-1">
        In conference call
      </span>

      <button
        type="button"
        onClick={onReturnToWorkspace}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full",
          "bg-white/[0.06] text-white hover:bg-white/[0.12] transition",
        )}
        title="Return to conference"
        aria-label="Return to conference"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onHangup}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full",
          "bg-red-500/90 text-white hover:bg-red-600 transition",
        )}
        title="Hang up"
        aria-label="Hang up"
      >
        <PhoneOff className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
