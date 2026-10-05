"use client";

// Pieces every Jobs settings section shares: the props contract with
// SettingsPage, a section heading, the dirty-state hook and the save bar.

import React from "react";
import { Button } from "../../ui";
import type { JobsSettings, SettingsResponse } from "../../types";

export interface SectionProps {
  data: SettingsResponse;
  /** The saved settings the server sent back — SettingsPage keeps them. */
  onSaved: (settings: JobsSettings) => void;
  /** Lets SettingsPage warn before a section with unsaved edits is left. */
  onDirtyChange: (dirty: boolean) => void;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#7c7d94]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A section's local draft, reset whenever the saved value changes (first
 * load, or after a save), plus whether it differs from what is saved.
 */
export function useDraft<T>(baseline: T, onDirtyChange: (dirty: boolean) => void, compare?: (v: T) => unknown) {
  const baselineKey = JSON.stringify(compare ? compare(baseline) : baseline);
  const [draft, setDraft] = React.useState<T>(baseline);

  React.useEffect(() => {
    setDraft(baseline);
    // Only when the saved value itself changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineKey]);

  const dirty = JSON.stringify(compare ? compare(draft) : draft) !== baselineKey;

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const reset = React.useCallback(() => setDraft(baseline), [baseline]);
  return { draft, setDraft, dirty, reset };
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  problem,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Why saving is blocked, e.g. an empty required field. */
  problem?: string | null;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#1c1c24] bg-[#0c0c0e] px-1 py-4">
      <span className="mr-auto text-xs">
        {problem ? (
          <span className="text-[#f87171]">{problem}</span>
        ) : dirty ? (
          <span className="text-[#fbbf24]">Unsaved changes</span>
        ) : (
          <span className="text-[#61627a]">All changes saved</span>
        )}
      </span>
      {dirty && (
        <Button variant="secondary" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
      )}
      <Button onClick={onSave} loading={saving} disabled={!dirty || !!problem}>
        Save changes
      </Button>
    </div>
  );
}
