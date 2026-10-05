"use client";

// Drips the host's scripted audience into the live chat.
//
// Purely additive to the real room: it only ever calls `addMessage`, the same
// store action the socket path uses, so a webinar with no simulated audience
// behaves exactly as before and nothing here touches peers, mediasoup or the
// socket.
//
// The server decides which lines are due (it holds the session's real start
// time and filters by it) rather than sending the whole script — otherwise
// every "spontaneous" message would be readable in devtools before it appears.

import { useEffect, useRef } from "react";
import useWebinarStore from "@/store/webinarStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Often enough to feel live, rarely enough to be free. */
const POLL_MS = 10_000;

interface SimLine {
  atSec: number;
  name: string;
  message: string;
}

export function useSimulatedAudience(webinarId: string | undefined, active: boolean) {
  // Which lines are already on screen. Keyed by content+offset rather than by
  // index, so a host editing the script mid-session can't cause replays.
  const seen = useRef<Set<string>>(new Set());
  // First poll of a session that is already underway would otherwise dump
  // every past line at once; those are marked seen instead.
  const primed = useRef(false);

  useEffect(() => {
    if (!webinarId || !active) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${API_URL}/public/webinar/${webinarId}/simulated-audience`);
        const data = await res.json();
        if (cancelled || !data?.enabled) return;

        // The roster is published even before the session starts — the People
        // list needs it the moment someone joins, unlike the chat script which
        // the server withholds until its moment has passed.
        useWebinarStore.getState().setSimulatedPeople(
          Array.isArray(data.people)
            ? data.people
                .map((p: { name?: string }) => ({ name: String(p?.name ?? "").trim() }))
                .filter((p: { name: string }) => p.name)
            : []
        );

        if (!data?.started) return;

        const due: SimLine[] = data.chat || [];
        const add = useWebinarStore.getState().addMessage;

        for (const line of due) {
          const key = `${line.atSec}|${line.name}|${line.message}`;
          if (seen.current.has(key)) continue;
          seen.current.add(key);
          // Everything already in the past when we arrived is backfilled
          // silently — it belongs in the transcript, not as 20 notifications.
          if (!primed.current) continue;
          add({
            id: `sim-${line.atSec}-${seen.current.size}`,
            userId: `sim:${line.name}`,
            name: line.name,
            text: line.message,
            timestamp: Date.now(),
          });
        }

        if (!primed.current) {
          // Replay the backlog once, in order, so a late joiner sees the
          // conversation that "happened" before they arrived.
          primed.current = true;
          for (const line of due) {
            add({
              id: `sim-backfill-${line.atSec}-${line.name}`,
              userId: `sim:${line.name}`,
              name: line.name,
              text: line.message,
              timestamp: Date.now(),
            });
          }
        }
      } catch {
        // A room that can't reach this endpoint is a room without simulated
        // chat, not a broken room. Nothing is surfaced to the viewer.
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      // Don't let one room's roster bleed into the next.
      useWebinarStore.getState().setSimulatedPeople([]);
    };
  }, [webinarId, active]);
}
