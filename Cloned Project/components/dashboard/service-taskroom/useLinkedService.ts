"use client";

/**
 * Resolves whether a Taskroom room is a service engagement room.
 *
 * Deliberately fail-silent and non-blocking: ordinary taskrooms resolve to
 * `null` (the backend answers 204) and nothing in the board waits on this. That
 * is what keeps the Service tab from appearing — and the taskroom from
 * behaving any differently — on rooms that have nothing to do with services.
 */

import { useEffect, useState } from "react";
import { getServiceByTaskroom, type TaskroomLinkedService } from "@/lib/feed-api";

export function useLinkedService(roomId?: string | null) {
  const [linked, setLinked] = useState<TaskroomLinkedService | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLinked(null);
      return;
    }

    let cancelled = false;

    getServiceByTaskroom(roomId)
      .then((result) => {
        if (!cancelled) setLinked(result);
      })
      .catch(() => {
        // A lookup failure must leave the taskroom exactly as it was.
        if (!cancelled) setLinked(null);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return linked;
}
