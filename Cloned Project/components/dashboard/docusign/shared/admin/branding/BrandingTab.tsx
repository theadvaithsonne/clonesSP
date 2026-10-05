"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocusignBranding, previewDocusignBranding, updateDocusignBranding } from "@/lib/docusign/shared-api";
import type { DsBranding, DsBrandingEditor, DsBrandingFieldError, DsBrandingPreview, DsEmailContent, DsEmailKind } from "@/lib/docusign/types";
import { AppearanceSection } from "./AppearanceSection";
import { EmailContentSection } from "./EmailContentSection";
import { BrandingPreview } from "./BrandingPreview";
import {
  FIELD_ERROR,
  FIELD_HINT,
  FIELD_LABEL,
  TEXT_AREA,
  TEXT_INPUT,
  errorFor,
  normalizeBranding,
  withDefaultsFilled,
} from "./brandingUi";

// How long typing has to pause before the preview re-renders (one request per pause, not per keystroke).
const PREVIEW_DEBOUNCE_MS = 400;

// Admin → Branding: how every email to people outside (and inside) the org looks and reads. Everything is
// saved at once; the preview is rendered by the backend with the very builders the real emails use, so
// what's shown here is exactly what goes out.
export function BrandingTab({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [editor, setEditor] = useState<DsBrandingEditor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<DsBranding | null>(null);
  const [draft, setDraft] = useState<DsBranding | null>(null);
  const [kind, setKind] = useState<DsEmailKind>("signature_request");
  const [isSaving, setIsSaving] = useState(false);
  // Problems the last save was rejected with. Live problems come with every preview (see below).
  const [saveErrors, setSaveErrors] = useState<DsBrandingFieldError[]>([]);

  const applyEditor = useCallback((data: DsBrandingEditor) => {
    const filled = withDefaultsFilled(data.branding, data.defaults);
    setEditor(data);
    setBaseline(filled);
    setDraft(filled);
    setSaveErrors([]);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getDocusignBranding();
      applyEditor(res.data);
    } catch (err: any) {
      setLoadError(err.message || "Couldn't load branding");
    }
  }, [applyEditor]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!editor || !draft || !baseline) return false;
    return JSON.stringify(normalizeBranding(draft, editor.defaults)) !== JSON.stringify(normalizeBranding(baseline, editor.defaults));
  }, [editor, draft, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Closing the tab or reloading with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ── Live preview ───────────────────────────────────────────────────────────────────────────
  // The last good preview stays on screen while the next one loads; an older response that arrives after a
  // newer request is dropped (the request is aborted), so the preview never jumps back to stale text.
  const [preview, setPreview] = useState<DsBrandingPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(async () => {
      previewAbortRef.current?.abort();
      const controller = new AbortController();
      previewAbortRef.current = controller;
      setIsPreviewing(true);
      try {
        const res = await previewDocusignBranding(draft, kind, controller.signal);
        if (controller.signal.aborted) return;
        setPreview(res.data);
        setPreviewError(null);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setPreviewError(err.message || "Couldn't render the preview");
      } finally {
        if (!controller.signal.aborted) setIsPreviewing(false);
      }
    }, preview ? PREVIEW_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
    // `preview` only decides whether the very first render waits; it must not re-trigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, kind]);

  useEffect(() => () => previewAbortRef.current?.abort(), []);

  // Live problems for the form as it is now (from the latest preview), plus whatever the last save reported.
  const errors = useMemo(() => {
    const live = preview?.errors || [];
    const liveFields = new Set(live.map((e) => e.field));
    return [...live, ...saveErrors.filter((e) => !liveFields.has(e.field))];
  }, [preview, saveErrors]);

  // ── Editing ────────────────────────────────────────────────────────────────────────────────
  const patch = (next: Partial<DsBranding>) => {
    setDraft((d) => (d ? { ...d, ...next } : d));
    if (saveErrors.length) setSaveErrors((errs) => errs.filter((e) => !Object.keys(next).includes(e.field)));
  };

  const setContent = (k: DsEmailKind, field: keyof DsEmailContent, value: string) => {
    setDraft((d) => (d ? { ...d, content: { ...d.content, [k]: { ...d.content[k], [field]: value } } } : d));
    if (saveErrors.length) setSaveErrors((errs) => errs.filter((e) => e.field !== `content.${k}.${field}`));
  };

  const resetKind = (k: DsEmailKind) => {
    if (!editor) return;
    setDraft((d) => (d ? { ...d, content: { ...d.content, [k]: { ...editor.defaults.content[k] } } } : d));
  };

  const discard = () => {
    if (baseline) setDraft(baseline);
    setSaveErrors([]);
  };

  const save = async () => {
    if (!draft || !editor) return;
    if (errors.length) {
      toast.error(errors[0].message);
      const bad = errors.find((e) => e.field.startsWith("content."));
      if (bad) setKind(bad.field.split(".")[1] as DsEmailKind);
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateDocusignBranding(normalizeBranding(draft, editor.defaults));
      applyEditor(res.data);
      toast.success("Branding saved — new emails will use it");
    } catch (err: any) {
      if (Array.isArray(err.errors)) setSaveErrors(err.errors);
      toast.error(err.message || "Couldn't save branding");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8a8a9b]">
        <Palette className="h-8 w-8" />
        <p className="text-xs">{loadError}</p>
        <button type="button" onClick={load} className="rounded-lg border border-[#2a2a35] px-3 py-1.5 text-xs text-white/80 hover:text-white">
          Try again
        </button>
      </div>
    );
  }

  if (!editor || !draft) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
    );
  }

  const replyError = errorFor(errors, "replyToEmail");
  const footerError = errorFor(errors, "footerText");

  return (
    <div className="flex flex-col">
      {/* Save / Discard sit at the top and stay pinned there while the form scrolls, so they're always in reach. */}
      <div className="sticky top-0 z-20 mb-6 flex flex-wrap items-center justify-end gap-3 border-b border-[#2a2a35] bg-[#0c0c10]/95 pb-4 pt-1 backdrop-blur">
        <span className="mr-auto text-sm">
          {errors.length && dirty ? (
            <span className="text-red-400">{errors[0].message}</span>
          ) : dirty ? (
            <span className="text-[#8a8a9b]">Unsaved changes</span>
          ) : (
            <span className="text-[#5a5a72]">{editor.isSaved ? "All changes saved" : "Using the default branding"}</span>
          )}
        </span>
        <button
          type="button"
          onClick={discard}
          disabled={!dirty || isSaving}
          className="h-10 rounded-lg border border-[#2a2a35] px-4 text-sm font-medium text-white/85 transition-colors hover:border-[#3b3b4a] hover:text-white disabled:opacity-40 disabled:hover:border-[#2a2a35]"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-[#141414] transition-opacity disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* The org's name and logo aren't edited here — they're the organisation's own, and the emails
            (and so the preview) always use them. */}
        <div className="min-w-0 space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="branding-reply" className={FIELD_LABEL}>
              Reply-to email
            </label>
            <input
              id="branding-reply"
              type="email"
              value={draft.replyToEmail}
              onChange={(e) => patch({ replyToEmail: e.target.value })}
              placeholder="e.g. support@yourcompany.com"
              className={cn(TEXT_INPUT, replyError && "border-red-500/60")}
            />
            {replyError ? <p className={FIELD_ERROR}>{replyError}</p> : <p className={FIELD_HINT}>When a recipient hits Reply, it goes here.</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branding-footer" className={FIELD_LABEL}>
              Email footer
            </label>
            <textarea
              id="branding-footer"
              rows={3}
              value={draft.footerText}
              onChange={(e) => patch({ footerText: e.target.value })}
              maxLength={editor.limits.footerText}
              placeholder="e.g. Your company address, phone number or legal line"
              className={cn(TEXT_AREA, footerError && "border-red-500/60")}
            />
            {footerError ? <p className={FIELD_ERROR}>{footerError}</p> : <p className={FIELD_HINT}>Address, legal line or anything recipients should see at the bottom.</p>}
          </div>

          <AppearanceSection
            accentColor={draft.accentColor}
            layout={draft.layout}
            logoSize={draft.logoSize}
            onChange={(p) => patch(p)}
            accentError={errorFor(errors, "accentColor")}
          />

          <EmailContentSection
            catalog={editor.catalog}
            defaults={editor.defaults.content}
            limits={editor.limits}
            kind={kind}
            onKindChange={setKind}
            content={draft.content}
            onChange={setContent}
            onResetKind={resetKind}
            errors={errors}
          />
        </div>

        {/* Pinned just below the save bar (≈ its height), so the two never overlap while scrolling. */}
        <div className="min-w-0 lg:sticky lg:top-20">
          <BrandingPreview preview={preview} isLoading={isPreviewing} error={previewError} />
        </div>
      </div>
    </div>
  );
}
