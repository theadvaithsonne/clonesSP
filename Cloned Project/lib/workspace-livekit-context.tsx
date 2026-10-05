"use client";

import { createContext, useContext, ReactNode } from "react";
import { useLiveKit } from "@/app/(dashboard)/workspace/hooks/useLiveKit";

// WorkspaceLiveKit shared context.
//
// Background: the HQ conference room is joined from BOTH
// ConferenceRoomPage and WorkspaceClient through the same useLiveKit
// hook. Previously each component instance ran the hook independently
// — so the call's Room object lived inside that component, and
// navigating away unmounted it, losing the call. Persistent PiP
// can't reattach to nothing, which is why the previous PiP attempt
// was reverted ("invasive WorkspaceClient refactor" in the dev log).
//
// Fix: lift useLiveKit() to a layout-scoped provider so the SAME
// Room state is shared between the two pages and survives navigation
// between any (dashboard) route. The hook's return shape is forwarded
// through context verbatim — call sites switch from useLiveKit() to
// useWorkspaceLiveKit() and read the exact same destructured fields.
//
// Scope is the dashboard layout, not the root layout, deliberately:
// the public Meet flow (/meet/join) has its own MeetingProvider /
// useMeetLiveKit at root level. Keeping the workspace provider
// scoped to (dashboard)/* avoids any cross-talk with that surface.
type WorkspaceLiveKitValue = ReturnType<typeof useLiveKit>;

const WorkspaceLiveKitContext = createContext<WorkspaceLiveKitValue | null>(
  null,
);

export function WorkspaceLiveKitProvider({ children }: { children: ReactNode }) {
  // useLiveKit() runs ONCE here. Its internal Room ref / socket
  // listeners / track subscriptions live in this provider instance
  // for the lifetime of the (dashboard) layout — i.e. for as long as
  // the user is anywhere under /workspace, /conference-room, the
  // founder dashboard, etc.
  const livekit = useLiveKit();
  return (
    <WorkspaceLiveKitContext.Provider value={livekit}>
      {children}
    </WorkspaceLiveKitContext.Provider>
  );
}

/**
 * Read the shared workspace LiveKit state. Returns the same shape
 * useLiveKit() returns — drop-in replacement at call sites.
 *
 * Throws if used outside the provider so the missing wrap is caught
 * at render time, not as a silent broken-call later.
 */
export function useWorkspaceLiveKit(): WorkspaceLiveKitValue {
  const ctx = useContext(WorkspaceLiveKitContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceLiveKit must be used within WorkspaceLiveKitProvider",
    );
  }
  return ctx;
}
