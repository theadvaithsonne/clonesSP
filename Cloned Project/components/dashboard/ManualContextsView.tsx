"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, Loader2, Check, FileText, ChevronRight, Upload, Edit3, Eye
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getOrgId } from "@/lib/auth";
import { UploadDocumentModal } from "./UploadDocumentModal";

interface Context {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

// Note: the assign-context-to-agent flow was deliberately removed from
// this view. Assignment now happens exclusively from the per-agent
// controller page (see OpenClawAgentTabs.tsx), where the user picks
// contexts after selecting an agent. Having a second assignment entry
// point here was redundant and confusing — users would land on the
// library view, assign a context, then have to navigate to an agent
// anyway. The ``agents`` prop was dropped from the component signature
// as a result, and ``Users``/``Bot`` icons were dropped from imports.

const NEW_DOC_ID = "__new__";

export function ManualContextsView({ authCurrent }: { authCurrent: any }) {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);

  // Preview vs edit mode. Default is "preview" — users land on the
  // rendered markdown view and must explicitly click Edit to see the
  // raw source. New drafts start in "edit" mode because previewing
  // an empty document is pointless. Saving a dirty doc also returns
  // the view to preview mode so the save feels like a commit.
  type ViewMode = "preview" | "edit";
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Prepend a newly-uploaded context to the list and open it in the
  // editor. Called by UploadDocumentModal after a successful upload.
  // The upload flow already created the GlobalContext server-side, so
  // we just need to reflect it in local state here. Open in preview
  // mode so the user sees the rendered markdown of their extracted
  // document immediately — the raw markdown is a click away.
  const handleUploadSuccess = useCallback((ctx: Context) => {
    setContexts((prev) => {
      // Drop any unsaved draft so it doesn't linger above the new row.
      const withoutDraft = prev.filter((c) => c.id !== NEW_DOC_ID);
      // Dedupe in case the server returned an existing row (shouldn't
      // happen on create, but cheap safety).
      const withoutDup = withoutDraft.filter((c) => c.id !== ctx.id);
      return [ctx, ...withoutDup];
    });
    setActiveId(ctx.id);
    setDocTitle(ctx.name);
    setDocContent(ctx.content);
    setDirty(false);
    setViewMode("preview");
  }, []);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = getOrgId();
      const url = new URL("/api/openclaw/contexts", window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      const ctxRes = await fetch(url.toString(), { headers: authCurrent });
      const ctxData = await ctxRes.json();
      setContexts(Array.isArray(ctxData) ? ctxData : []);
    } catch {
      toast.error("Failed to load contexts");
    } finally {
      setLoading(false);
    }
  }, [authCurrent]);

  useEffect(() => { load(); }, [load]);

  const openDoc = (ctx: Context) => {
    if (activeId === NEW_DOC_ID) {
      setContexts((prev) => prev.filter((c) => c.id !== NEW_DOC_ID));
    }
    setActiveId(ctx.id);
    setDocTitle(ctx.name);
    setDocContent(ctx.content);
    setDirty(false);
    // Opening an existing context lands in preview mode — user must
    // click the Edit button to see the raw markdown source.
    setViewMode("preview");
  };

  const createNewDoc = () => {
    if (activeId === NEW_DOC_ID) { titleRef.current?.focus(); return; }
    const draft: Context = { id: NEW_DOC_ID, name: "", content: "", created_at: "" };
    setContexts((prev) => [draft, ...prev.filter((c) => c.id !== NEW_DOC_ID)]);
    setActiveId(NEW_DOC_ID);
    setDocTitle("");
    setDocContent("");
    setDirty(false);
    // New drafts start in edit mode because previewing empty content
    // is useless — the user has nothing to look at yet.
    setViewMode("edit");
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const activeCtx = contexts.find((c) => c.id === activeId);

  const handleSave = useCallback(async () => {
    if (!activeId) return;
    if (!docTitle.trim()) { toast.error("Title is required"); titleRef.current?.focus(); return; }
    setSaving(true);
    try {
      const orgId = getOrgId();
      if (activeId === NEW_DOC_ID) {
        const url = new URL("/api/openclaw/contexts", window.location.origin);
        if (orgId) url.searchParams.set("org_id", orgId);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: authCurrent,
          body: JSON.stringify({ name: docTitle.trim(), content: docContent.trim(), ...(orgId ? { org_id: orgId } : {}) }),
        });
        if (!res.ok) throw new Error();
        const data: Context = await res.json();
        setContexts((prev) => [data, ...prev.filter((c) => c.id !== NEW_DOC_ID)]);
        setActiveId(data.id);
        toast.success("Context created");
      } else {
        const url = new URL(`/api/openclaw/contexts/${activeId}`, window.location.origin);
        if (orgId) url.searchParams.set("org_id", orgId);
        const res = await fetch(url.toString(), {
          method: "PATCH",
          headers: authCurrent,
          body: JSON.stringify({ name: docTitle.trim(), content: docContent.trim(), ...(orgId ? { org_id: orgId } : {}) }),
        });
        if (!res.ok) throw new Error();
        const data: Context = await res.json();
        setContexts((prev) => prev.map((c) => c.id === activeId ? data : c));
        toast.success("Saved");
      }
      setDirty(false);
      // After a successful save, return to preview mode so the save
      // feels like a commit — the user sees their rendered result.
      setViewMode("preview");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [activeId, docTitle, docContent, authCurrent]);

  const handleDelete = async (ctx: Context) => {
    if (ctx.id === NEW_DOC_ID) {
      setContexts((prev) => prev.filter((c) => c.id !== NEW_DOC_ID));
      setActiveId(null);
      return;
    }
    if (!confirm(`Delete "${ctx.name}"?`)) return;
    setDeletingId(ctx.id);
    try {
      const orgId = getOrgId();
      const url = new URL(`/api/openclaw/contexts/${ctx.id}`, window.location.origin);
      if (orgId) url.searchParams.set("org_id", orgId);
      await fetch(url.toString(), { method: "DELETE", headers: authCurrent });
      setContexts((prev) => prev.filter((c) => c.id !== ctx.id));
      if (activeId === ctx.id) setActiveId(null);
      toast.success("Context deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && activeId) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, handleSave]);

  const wordCount = docContent.trim() ? docContent.trim().split(/\\s+/).length : 0;
  const savedCount = contexts.filter((c) => c.id !== NEW_DOC_ID).length;

  return (
    <div className="flex h-full min-h-[500px] overflow-hidden">
      <div className="w-52 shrink-0 flex flex-col border-r border-[#1e1e28] bg-[#0c0c11]">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[#1a1a22]">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-[#5a5a72]" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[#5a5a72]">Contexts</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowUpload(true)}
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#1e1e28] text-[#5a5a72] hover:text-brand transition-colors"
              title="Upload PDF or DOCX"
            >
              <Upload className="h-3 w-3" />
            </button>
            <button
              onClick={createNewDoc}
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#1e1e28] text-[#5a5a72] hover:text-brand transition-colors"
              title="New context (⌘N)"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#5a5a72]" /></div>
          ) : contexts.length === 0 ? (
            <div className="px-4 py-8 text-center"><p className="text-[10px] text-[#3a3a50]">No contexts yet</p></div>
          ) : (
            contexts.map((ctx) => {
              const isActive = activeId === ctx.id;
              const isNew = ctx.id === NEW_DOC_ID;
              return (
                <button
                  key={ctx.id}
                  onClick={() => openDoc(ctx)}
                  className={`group w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${ isActive ? "bg-[#16161f] text-white" : "text-[#9fa0b8] hover:bg-[#111118] hover:text-white" }`}
                >
                  <FileText className={`h-3 w-3 shrink-0 transition-colors ${isActive ? "text-brand" : "text-[#3a3a50] group-hover:text-[#5a5a72]"}`} />
                  <span className={`flex-1 text-[11px] truncate ${isNew && !ctx.name ? "text-[#5a5a72] italic" : ""}`}>
                    {ctx.name || "Untitled"}
                  </span>
                  {isActive && <ChevronRight className="h-2.5 w-2.5 text-[#3a3a50] shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-[#1a1a22] px-3 py-2">
          <p className="text-[9px] text-[#3a3a50]">{savedCount} document{savedCount !== 1 && "s"}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#08080d]">
        {activeId && activeCtx ? (
          <>
            <div className="flex items-center justify-between px-8 py-2 border-b border-[#1a1a22] shrink-0">
              <div className="flex items-center gap-1.5 text-[9px] text-[#3a3a50] select-none">
                <span>{wordCount} word{wordCount !== 1 && "s"}</span>
                <span>·</span>
                <span>{docContent.length} chars</span>
                {dirty && <><span>·</span><span className="text-brand/60">unsaved</span></>}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Preview / Edit toggle. Hidden on the new-draft row
                    because there's nothing to preview yet — the toolbar
                    would just show a confusing "Preview" button on an
                    empty document. */}
                {activeId !== NEW_DOC_ID && (
                  <button
                    onClick={() => setViewMode((m) => (m === "preview" ? "edit" : "preview"))}
                    className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md border transition-colors ${
                      viewMode === "edit"
                        ? "bg-brand/10 text-brand border-brand/30"
                        : "text-[#9fa0b8] border-[#2a2a35] hover:text-white hover:border-[#3a3a4a]"
                    }`}
                    title={viewMode === "preview" ? "Edit raw markdown" : "Back to preview"}
                  >
                    {viewMode === "preview" ? (
                      <><Edit3 className="h-3 w-3" /> Edit</>
                    ) : (
                      <><Eye className="h-3 w-3" /> Preview</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => activeCtx && handleDelete(activeCtx)}
                  disabled={deletingId === activeId}
                  className="flex items-center gap-1 text-[10px] text-[#5a5a72] hover:text-red-400 px-2 py-1 rounded-md border border-transparent hover:border-red-500/20 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                >
                  {deletingId === activeId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
                {/* Save button only in edit mode — preview mode has
                    nothing to save (the user can't modify anything
                    in the rendered view). */}
                {viewMode === "edit" && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className={`flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-md border font-medium transition-colors ${ dirty ? "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20" : "text-[#3a3a50] border-transparent cursor-default" } disabled:opacity-60`}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {saving ? "Saving…" : dirty ? "Save" : "Saved"}
                  </button>
                )}
              </div>
            </div>
            {/* Scrollable editor column.
                ────────────────────────────────────────────────────────
                Title block stays pinned; the body block below it takes
                the remaining height and its inner element scrolls.

                Edit mode: the textarea itself is the scroll container
                (``flex-1 min-h-0 overflow-y-auto``). Letting the
                textarea own its scrolling is the simple, reliable path —
                the earlier attempt to auto-grow the textarea to its
                content height and have an outer div scroll broke wheel
                events in edit mode because browsers route wheel events
                to the hovered textarea first, and a textarea with
                ``overflow-y: hidden`` doesn't forward them.

                Preview mode: a plain div is the scroll container
                instead, since markdown rendering doesn't need a
                textarea. */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="shrink-0">
                <div className="max-w-5xl mx-auto px-12 pt-12">
                  {viewMode === "edit" ? (
                    <input
                      ref={titleRef}
                      type="text"
                      value={docTitle}
                      onChange={(e) => { setDocTitle(e.target.value); setDirty(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); contentRef.current?.focus(); } }}
                      placeholder="Untitled"
                      className="w-full bg-transparent text-[2rem] font-bold text-white placeholder:text-[#2a2a35] focus:outline-none leading-tight tracking-tight"
                    />
                  ) : (
                    <h1 className="w-full bg-transparent text-[2rem] font-bold text-white leading-tight tracking-tight">
                      {docTitle || <span className="text-[#2a2a35]">Untitled</span>}
                    </h1>
                  )}
                  <div className="h-px bg-[#16161f] mt-4" />
                </div>
              </div>

              {viewMode === "edit" ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-12 pt-4 pb-16 flex flex-col">
                    <textarea
                      ref={contentRef}
                      value={docContent}
                      onChange={(e) => { setDocContent(e.target.value); setDirty(true); }}
                      placeholder="Start writing — paste instructions, facts, or any knowledge your agent should have…"
                      className="flex-1 min-h-0 w-full bg-transparent text-[13px] leading-[1.85] text-[#b8b9cf] placeholder:text-[#2a2a35] focus:outline-none resize-none font-mono overflow-y-auto"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="max-w-5xl mx-auto px-12 pt-4 pb-16">
                    {docContent.trim() ? (
                      <div className="markdown-preview text-[13px] leading-[1.85] text-[#b8b9cf] min-h-[320px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {docContent}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-[13px] leading-[1.85] text-[#3a3a50] italic min-h-[320px]">
                        No content yet. Click Edit to start writing.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="h-12 w-12 rounded-xl bg-brand/5 border border-brand/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-brand/30" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#5a5a72]">No document open</p>
              <p className="text-[11px] text-[#3a3a50]">Select a context from the sidebar, create a new one, or upload a document</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={createNewDoc}
                className="flex items-center gap-2 text-[11px] text-[#9fa0b8] hover:text-brand border border-[#2a2a35] hover:border-brand/30 rounded-lg px-4 py-2 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New context
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 text-[11px] text-[#9fa0b8] hover:text-brand border border-[#2a2a35] hover:border-brand/30 rounded-lg px-4 py-2 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Upload document
              </button>
            </div>
          </div>
        )}
      </div>

      <UploadDocumentModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={handleUploadSuccess}
        authCurrent={authCurrent}
      />
    </div>
  );
}
