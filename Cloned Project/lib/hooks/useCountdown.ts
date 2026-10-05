"use client";

import { useEffect, useRef, useState } from "react";

export interface CountdownParts {
  /** Milliseconds remaining, clamped at 0. */
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  /**
   * Human label that drops empty leading units:
   *   "2d 04h 13m" · "4h 13m 09s" · "13m 09s" · "09s"
   */
  label: string;
}

function computeParts(target: number): CountdownParts {
  const total = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(total / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  let label: string;
  if (days > 0) label = `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  else if (hours > 0) label = `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  else if (minutes > 0) label = `${minutes}m ${pad(seconds)}s`;
  else label = `${pad(seconds)}s`;

  return { total, days, hours, minutes, seconds, isExpired: total <= 0, label };
}

/**
 * Ticking countdown to `targetDate`.
 *
 * Returns `null` on the first render (and on the server) so the markup a
 * client hydrates against never disagrees with what the server produced —
 * a live clock is inherently non-deterministic. Callers should render a
 * placeholder while the value is null.
 *
 * `onExpire` fires exactly once per target, on the tick where the remaining
 * time first reaches zero. Passing a target that is already in the past
 * fires it on mount.
 */
export function useCountdown(
  targetDate: Date | string | number | null | undefined,
  onExpire?: () => void
): CountdownParts | null {
  const target =
    targetDate == null
      ? null
      : targetDate instanceof Date
      ? targetDate.getTime()
      : typeof targetDate === "number"
      ? targetDate
      : new Date(targetDate).getTime();

  const validTarget = target != null && Number.isFinite(target) ? target : null;

  const [parts, setParts] = useState<CountdownParts | null>(null);

  // Keep the latest callback without making it an effect dependency —
  // otherwise an inline arrow prop would tear down and rebuild the interval
  // on every parent render, resetting the tick phase each time.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Reset when the target moves so a stale "already fired" flag from the
  // previous target can't swallow the new expiry.
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (validTarget == null) {
      setParts(null);
      return;
    }

    const tick = () => {
      const next = computeParts(validTarget);
      setParts(next);
      if (next.isExpired && firedForRef.current !== validTarget) {
        firedForRef.current = validTarget;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [validTarget]);

  return parts;
}

export default useCountdown;
