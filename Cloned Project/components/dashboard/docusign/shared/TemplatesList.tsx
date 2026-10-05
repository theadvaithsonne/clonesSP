"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { LayoutTemplate, Loader2, Search, Trash2 } from "lucide-react";
import { DsPagination, DsTemplate } from "@/lib/docusign/types";
import { DsDocument } from "@/lib/docusign/internal-api";
import { DsExternalDocument } from "@/lib/docusign/external-api";
import { listTemplates, deleteTemplate, instantiateTemplate, instantiateExternalTemplate } from "@/lib/docusign/shared-api";
import { SimplePagination, paginationRangeLabel } from "@/components/dashboard/docusign/shared/SimplePagination";

const EMPTY_PAGINATION: DsPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

interface TemplatesListProps {
  canManage: boolean;
  // templateFields carries the template's field layout (still keyed by abstract recipientSlot numbers, not
  // real recipient ids) so the editor can seed itself once real recipients exist — see FieldEditorView.tsx /
  // ExternalFieldEditorView.tsx's initialTemplateFields prop.
  // The freshly-instantiated document, whole — the caller seeds the editor from it so the PDF
  // download starts immediately (see documentSeed.ts).
  onUseTemplate: (document: DsDocument, templateFields: DsTemplate["fields"]) => void;
  onUseExternalTemplate: (document: DsExternalDocument, templateFields: DsTemplate["fields"]) => void;
}

export function TemplatesList({ canManage, onUseTemplate, onUseExternalTemplate }: TemplatesListProps) {
  const [templates, setTemplates] = useState<DsTemplate[]>([]);
  const [pagination, setPagination] = useState<DsPagination>(EMPTY_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingExternalId, setApplyingExternalId] = useState<string | null>(null);
  // What's in the box right now, vs what the server has actually been asked for. Typing updates the
  // former immediately (so the input stays responsive) and the latter only after a pause.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DsTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search and pagination are both server-side, so a keystroke is a request — debounced so typing
  // "agreement" fires one query, not nine.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Stale-response guard: a slow request for an earlier query must not overwrite a newer one's
  // results. Same reason the document lists in the store keep a request counter.
  const latestRequest = useRef(0);

  const load = async (page = 1, q = query) => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    try {
      const res = await listTemplates(page, 20, q);
      if (requestId !== latestRequest.current) return;
      setTemplates(res.data);
      // An older backend answers without `pagination`; fall back to treating the response as one page
      // rather than rendering a broken pager.
      setPagination(res.pagination ?? { ...EMPTY_PAGINATION, total: res.data.length });
    } catch (err: any) {
      if (requestId !== latestRequest.current) return;
      toast.error(err.message || "Failed to load templates");
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  };

  // next.config.ts has reactStrictMode on, which double-invokes effects in dev — this ref stops the
  // first load firing twice. Subsequent loads are driven by `query` below.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      load(1, "");
      return;
    }
    // A new search always restarts at page 1 — page 3 of the previous query means nothing here.
    load(1, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(deleteTarget._id);
      setDeleteTarget(null);
      // Deleting the last row of a page would otherwise leave the user on an empty page.
      await load(templates.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  // Creates a new draft document pre-filled with the template's PDF + field layout (still keyed by
  // abstract recipientSlot numbers — the editor maps them to real recipients once those are added).
  const handleUse = async (template: DsTemplate) => {
    setApplyingId(template._id);
    try {
      const res = await instantiateTemplate(template._id, { title: `${template.title} (copy)` });
      onUseTemplate(res.data.document, res.data.templateFields);
    } catch (err: any) {
      toast.error(err.message || "Failed to create document from template");
    } finally {
      setApplyingId(null);
    }
  };

  const handleUseExternal = async (template: DsTemplate) => {
    setApplyingExternalId(template._id);
    try {
      const res = await instantiateExternalTemplate(template._id, { title: `${template.title} (copy)` });
      onUseExternalTemplate(res.data.document, res.data.templateFields);
    } catch (err: any) {
      toast.error(err.message || "Failed to create document from template");
    } finally {
      setApplyingExternalId(null);
    }
  };

  // Rendered even while a search is running, so the box never disappears from under the cursor.
  const searchBar = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a7a90]" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates..."
        aria-label="Search templates"
        className="h-8 w-56 rounded-lg border border-[#2a2a35] bg-[#0c0c10] pl-8 pr-2.5 text-xs text-white/85 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none"
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/90">Templates</h2>
          <p className="text-xs text-[#7a7a90]">
            A saved field layout you can reuse — start a new document from one instead of placing every field again.
          </p>
        </div>
        {searchBar}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : !templates.length ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#8a8a9b]">
          <LayoutTemplate className="h-8 w-8" />
          <p className="text-xs">
            {query
              ? `No templates match "${query}"`
              : "No templates yet — save a document's field layout as a template to reuse it."}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center gap-3 rounded-2xl border border-[#2a2a35] bg-[#111116] px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                >
                  <LayoutTemplate className="h-4 w-4 shrink-0 text-[#7a7a90]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white/90">{t.title}</p>
                    <p className="text-[11px] tabular-nums text-white/45">
                      {t.fields.length} {t.fields.length === 1 ? "field" : "fields"}
                      {t.pageCount ? ` · ${t.pageCount} ${t.pageCount === 1 ? "page" : "pages"}` : ""}
                    </p>
                  </div>
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" disabled={applyingId === t._id} onClick={() => handleUse(t)}>
                        {applyingId === t._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use template"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={applyingExternalId === t._id} onClick={() => handleUseExternal(t)}>
                        {applyingExternalId === t._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use for external"}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${t.title}`} onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <SimplePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            rangeLabel={paginationRangeLabel(pagination)}
            onPrev={() => load(pagination.page - 1)}
            onNext={() => load(pagination.page + 1)}
          />
        </div>
      )}

      {/* Deleting used to happen on a single click of the trash icon, with no way back — a template
          is not recoverable, so it gets the same confirmation the document lists use. */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; will be removed permanently. Documents already created from it are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
