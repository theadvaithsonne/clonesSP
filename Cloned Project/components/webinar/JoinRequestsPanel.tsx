"use client";

import { Check, UserRound, X } from "lucide-react";

export interface PendingJoinRequest {
  requestId: string;
  name: string;
}

/**
 * Bat246 "knock" — floating panel for the host, listing visitors currently
 * waiting to be let into the webinar. See WebinarPreJoin's
 * "waiting-for-host" state (the other end of this flow) and
 * webinar:requestJoin / webinar:respondJoinRequest in mediasoupHandlers.ts.
 *
 * Only ever rendered for Bat246 webinars — see the org check where this is
 * mounted in WebinarRoomClient.tsx.
 */
export default function JoinRequestsPanel({
  requests,
  onApprove,
  onDeny,
}: {
  requests: PendingJoinRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-72 space-y-2">
      {requests.map((req) => (
        <div
          key={req.requestId}
          className="rounded-xl border border-[#2a2a35] bg-[#111116]/95 p-3 shadow-xl backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
              <UserRound className="h-4 w-4 text-white/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {req.name}
              </p>
              <p className="text-xs text-zinc-500">wants to join</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onDeny(req.requestId)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#2a2a35] bg-[#1a1a20] py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-[#22222c] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </button>
            <button
              type="button"
              onClick={() => onApprove(req.requestId)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-bold text-black transition-colors hover:bg-emerald-400"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
