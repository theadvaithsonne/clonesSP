"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Opens the Network Mail builder over whatever host form invoked it, instead of
 * navigating away to the Network Mail app. `TemplateEditorView` is self-contained
 * — it loads the template by id and owns its own save/publish — so it only needs
 * a sized container.
 *
 * The editor lives in NetworkMailApp.tsx (~5.3k lines). Pulling it in via
 * `next/dynamic` keeps it out of the host page's bundle until the modal opens.
 */
const TemplateEditorView = dynamic(
  () => import("./NetworkMailApp").then((m) => m.TemplateEditorView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0e0e0e]">
        <Loader2 className="h-8 w-8 animate-spin text-[#9fa0b8]" />
      </div>
    ),
  },
);

export type EditorModalTemplate = {
  id: string;
  name: string;
  category: string;
};

export function TemplateEditorModal({
  template,
  onClose,
  zIndex = 740,
}: {
  template: EditorModalTemplate;
  onClose: () => void;
  /** Sits above the create-template modal (720) and the campaign wizard (700). */
  zIndex?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // The builder owns Escape for its own popovers, so closing is driven by the
  // editor's own "back" affordance rather than a global key handler.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6" style={{ zIndex }}>
      {/* Deliberately not click-to-dismiss: the editor's own back button routes
          through its unsaved-changes guard, and a stray backdrop click on a
          half-built template would discard the work silently. */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full h-full max-w-[1400px] rounded-2xl overflow-hidden border border-white/10 bg-[#0e0e0e] shadow-2xl shadow-black/60">
        <TemplateEditorView template={template} onBack={onClose} />
      </div>
    </div>,
    document.body,
  );
}
