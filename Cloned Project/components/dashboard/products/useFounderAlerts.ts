"use client";

import { useCallback, useState } from "react";

import type { FounderAlerts } from "@/lib/feed-api";
import type { FounderAlertsValue } from "./FounderAlertsSection";

// Single source of truth for the stored shape — re-exported so form files can
// import it from here alongside the hook.
export type { FounderAlerts };

const EMPTY_VALUE: FounderAlertsValue = { enabled: false, recipients: [] };

/**
 * Shared form logic for the founder's "notify me when someone joins" toggle,
 * used by the community, course, product, live stream, service and event
 * forms.
 *
 * Much smaller than its sibling `useEmailAlerts` because there is no template
 * to resolve or snapshot — nothing here can fail, so there is no `validate()`
 * for callers to wire into their save path.
 */
export function useFounderAlerts(initial?: Partial<FounderAlerts> | null) {
  const [value, setValue] = useState<FounderAlertsValue>(() =>
    initial
      ? {
          enabled: !!initial.enabled,
          recipients: initial.recipients || [],
        }
      : EMPTY_VALUE,
  );

  /** Copies a saved entity's alerts into the form (edit mode). */
  const hydrate = useCallback((saved?: Partial<FounderAlerts> | null) => {
    setValue({
      enabled: !!saved?.enabled,
      recipients: saved?.recipients || [],
    });
  }, []);

  const reset = useCallback(() => setValue(EMPTY_VALUE), []);

  /**
   * What gets stored on the entity. Turning alerts off drops the extra
   * recipients rather than leaving a stale list behind — matching what the
   * backend normaliser does anyway.
   */
  const buildPayload = useCallback((): FounderAlerts => {
    if (!value.enabled) return { enabled: false, recipients: [] };
    return { enabled: true, recipients: value.recipients };
  }, [value]);

  const onChange = useCallback((next: FounderAlertsValue) => setValue(next), []);

  return {
    value,
    /** Spread onto <FounderAlertsSection>; add the `context` prop. */
    sectionProps: { value, onChange },
    hydrate,
    reset,
    buildPayload,
  };
}
