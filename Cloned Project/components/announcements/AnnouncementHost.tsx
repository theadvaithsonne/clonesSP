"use client";

// Mounts Alerts & Promotions on one surface. Two instances exist:
//   • (auth)/layout.tsx      → surface="pre-login"
//   • (dashboard)/layout.tsx → surface="post-login"
//
// It shows the highest-priority live announcement this browser has not
// dismissed yet. Dismissing shows the next one (there is usually none), and a
// failed fetch renders nothing — a promo must never be able to break a login
// screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Announcement,
  discardAnnouncement,
  fetchActiveAnnouncements,
  isAnnouncementHidden,
  snoozeAnnouncement,
} from "@/lib/announcements";
import { AnnouncementOverlay } from "./AnnouncementCard";

export default function AnnouncementHost({
  surface,
  /**
   * Wait this long before showing. The default gives a freshly-loaded
   * dashboard a beat to paint before a dialog lands on top of it.
   */
  delayMs = 900,
}: {
  surface: "pre-login" | "post-login";
  delayMs?: number;
}) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [ready, setReady] = useState(false);
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    fetchActiveAnnouncements(surface).then((list) => {
      if (!alive) return;
      const fresh = list.filter((a) => !isAnnouncementHidden(a));
      if (!fresh.length) return;
      setRows(fresh);
      timer = setTimeout(() => {
        if (alive) setReady(true);
      }, delayMs);
    });

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [surface, delayMs]);

  const current = useMemo(
    () => rows.find((a) => !dismissedNow.includes(a.id)) || null,
    [rows, dismissedNow],
  );

  /** Close for now: gone for this tab session, back on the next visit. */
  const dismiss = useCallback(() => {
    if (!current) return;
    snoozeAnnouncement(current);
    setDismissedNow((prev) => [...prev, current.id]);
  }, [current]);

  /** Never again on this browser, until the admin bumps the version. */
  const discard = useCallback(() => {
    if (!current) return;
    discardAnnouncement(current);
    setDismissedNow((prev) => [...prev, current.id]);
  }, [current]);

  if (!ready || !current) return null;

  return (
    <AnnouncementOverlay
      data={current}
      onDismiss={dismiss}
      onDiscard={discard}
      // Following the CTA counts as having seen it — otherwise the dialog is
      // waiting again on the page the button just navigated to. Permanent,
      // not a snooze: they acted on it.
      onNavigate={discard}
    />
  );
}
