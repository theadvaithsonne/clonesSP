"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { isDocusignAdminUser } from "@/lib/docusign/access";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { RecipientsList, RecipientsToggle, ShowRecipientsSwitch, useRecipientToggles } from "@/components/dashboard/docusign/shared/DocumentRecipients";
import { SimplePagination, paginationRangeLabel } from "@/components/dashboard/docusign/shared/SimplePagination";
import { FolderRail } from "@/components/dashboard/docusign/shared/FolderRail";
import { FolderNameDialog } from "@/components/dashboard/docusign/shared/FolderNameDialog";
import { MoveToFolderDialog } from "@/components/dashboard/docusign/shared/MoveToFolderDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Mail, Loader2, Plus, Download, Folder, FolderInput, X, Inbox, FileEdit, MailCheck, Clock, CheckCircle2, Ban, type LucideIcon } from "lucide-react";
import { DsFolder, FolderFilter } from "@/lib/docusign/types";
import { DsExternalDocument, moveExternalDocuments } from "@/lib/docusign/external-api";
import { createFolder, renameFolder, deleteFolder } from "@/lib/docusign/shared-api";
import { Avatar } from "@/components/ui/data-table/cells";
import { formatMailTimestamp, isUnreadDocument } from "@/components/dashboard/docusign/shared/listFormat";
import type { ExternalStats } from "@/store/docusign/types";
import { cn } from "@/lib/utils";

// The left rail's status buckets, mirroring AgreementsView's FILTERS. There is deliberately no
// "Views" group here: external recipients never have accounts, so "Assigned to Me" is meaningless
// (ExternalStats has no assignedToMePending), and the list endpoint already scopes to documents
// this user owns, so "Sent by Me" would be every row.
//
// `status` is sent to the backend as-is — comma-separated spans several statuses. Counts come from
// stats that are already fetched, not a recount.
const FILTERS: Array<{
  label: string;
  icon: LucideIcon;
  status?: string;
  count?: (s: ExternalStats | null) => number | undefined;
}> = [
  { label: "All Documents", icon: Inbox, count: (s) => s?.total },
  { label: "Drafts", icon: FileEdit, status: "draft", count: (s) => s?.draft },
  { label: "Sent", icon: MailCheck, status: "sent", count: (s) => s?.sent },
  { label: "In Progress", icon: Clock, status: "in_progress", count: (s) => s?.in_progress },
  { label: "Completed", icon: CheckCircle2, status: "completed", count: (s) => s?.completed },
  { label: "Voided", icon: Ban, status: "voided", count: (s) => s?.voided },
];

interface ExternalSignaturesListProps {
  // The whole row, not just its id — the caller uses it to seed the editor so the PDF download
  // can start on click instead of after the detail fetch (see documentSeed.ts).
  onOpen: (doc: DsExternalDocument) => void;
  onNew: () => void;
}

export function ExternalSignaturesList({ onOpen, onNew }: ExternalSignaturesListProps) {
  const {
    externalDocuments,
    externalPagination,
    externalStats,
    isLoadingExternal,
    fetchExternalDocuments,
    fetchStats,
    me,
    externalFolders: folders,
    externalUnfiledCount,
    maxFolders,
    externalFoldersLoaded: foldersLoaded,
    isLoadingExternalFolders: isLoadingFolders,
    fetchFolders,
    externalFolderStats,
    fetchExternalFolderStats,
  } = useDocusignStore();
  const hasLoadedRef = useRef(false);
  const recipientToggles = useRecipientToggles();

  // Folders are founder/admin-only end to end (same as the internal Agreements view) — the backend enforces
  // it too (every esign-documents route is requireDocusignAdmin-gated), so this is only a UI convenience.
  const canOrganise = isDocusignAdminUser(me);
  // undefined = every folder; "unfiled" = Global (no folder); otherwise a folder id. The folder list itself
  // is shared with the internal Agreements view (see esign_document.model.js's folderId comment).
  const [activeFolder, setActiveFolder] = useState<FolderFilter | undefined>(undefined);
  // An index into FILTERS, matching AgreementsView.
  const [activeFilter, setActiveFilter] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DsFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DsFolder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (canOrganise && !foldersLoaded) fetchFolders("external", { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOrganise]);

  const folderNameById = useMemo(() => new Map(folders.map((f) => [f._id, f.name])), [folders]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    fetchExternalDocuments(1);
    if (!externalStats) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (folder: FolderFilter | undefined, page = 1, filterIndex = activeFilter) => {
    setSelectedIds([]);
    fetchExternalDocuments(page, folder, FILTERS[filterIndex].status);
  };

  const handleFilter = (index: number) => {
    setActiveFilter(index);
    // A new filter always restarts at page 1 — page 3 of the previous one means nothing here.
    load(activeFolder, 1, index);
  };

  const handleFolder = (next: FolderFilter | undefined) => {
    setActiveFolder(next);
    load(next);
    fetchExternalFolderStats(next);
  };

  const refreshAfterFolderChange = () => {
    load(activeFolder, externalPagination.page);
    fetchFolders("external", { silent: true });
    fetchExternalFolderStats(activeFolder);
  };

  // Moving or deleting the last rows of a later page leaves that page empty — and the empty state
  // has no pager to leave it with. Step back to the last page that can still have rows instead
  // (always strictly lower, and at most once per response — a failed step leaves the same
  // pagination object behind, which must not trigger another). Read from the store, not this
  // render: on mount the list effect above has just started page 1, and this must not race it.
  const steppedBackFromRef = useRef<typeof externalPagination | null>(null);
  useEffect(() => {
    const { isLoadingExternal: loading, externalDocuments: rows, externalPagination: p } = useDocusignStore.getState();
    if (loading || rows.length || p.page <= 1 || steppedBackFromRef.current === p) return;
    steppedBackFromRef.current = p;
    load(activeFolder, Math.max(1, Math.min(p.totalPages, p.page - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingExternal, externalDocuments, externalPagination]);

  const handleCreateFolder = async (name: string) => {
    await createFolder(name, "external");
    await fetchFolders("external", { silent: true });
    toast.success(`Folder "${name}" created`);
  };

  const handleRenameFolder = async (name: string) => {
    if (!renameTarget) return;
    await renameFolder(renameTarget._id, name);
    await fetchFolders("external", { silent: true });
    toast.success("Folder renamed");
  };

  const handleDeleteFolder = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteFolder(deleteTarget._id);
      const n = res.data.documentsUnfiled;
      toast.success(n ? `Folder deleted. ${n} document${n === 1 ? "" : "s"} moved to Global.` : "Folder deleted");
      const wasActive = activeFolder === deleteTarget._id;
      setDeleteTarget(null);
      if (wasActive) {
        setActiveFolder(undefined);
        load(undefined);
        fetchExternalFolderStats(undefined);
      } else {
        load(activeFolder, externalPagination.page);
      }
      fetchFolders("external", { silent: true });
    } catch (err: any) {
      toast.error(err.message || "Could not delete the folder");
    } finally {
      setIsDeleting(false);
    }
  };

  const allOnPageSelected = !!externalDocuments.length && externalDocuments.every((d) => selectedIds.includes(d._id));
  const toggleSelected = (id: string) => setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAllOnPage = () => setSelectedIds(allOnPageSelected ? [] : externalDocuments.map((d) => d._id));

  const selectedDocs = externalDocuments.filter((d) => selectedIds.includes(d._id));
  const sharedFolderId =
    selectedDocs.length && selectedDocs.every((d) => (d.folderId ?? null) === (selectedDocs[0].folderId ?? null)) ? selectedDocs[0].folderId ?? null : null;

  const badgeStats = activeFolder ? externalFolderStats : externalStats;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="shrink-0">
        <h2 className="text-sm font-semibold text-white/90">External Signatures</h2>
        <p className="text-xs text-[#7a7a90]">
          Documents shared with people outside your organization — either filled in on their behalf (they just
          get a copy, no account needed), or sent to them as a link to sign themselves, still with no account.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Status filters then folders, in one independently-scrolling rail — the same left column
            Agreements uses. FolderRail draws its own top divider, so it is meant to sit under
            something rather than lead a bare column. */}
        <div className="w-52 shrink-0 min-h-0 overflow-y-auto space-y-0.5 pr-1">
          {FILTERS.map((f, i) => {
            const count = f.count?.(badgeStats);
            const active = activeFilter === i;
            return (
              <button
                key={f.label}
                onClick={() => handleFilter(i)}
                className={cn(
                  "relative flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                  active
                    ? "bg-white/[0.06] font-medium text-white/90 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand"
                    : "text-[#8a8a9b] hover:bg-white/[0.03] hover:text-white/80"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <f.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.label}</span>
                </span>
                {!!count && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active ? "bg-brand/15 text-brand" : "bg-[#2a2a35] text-[#8a8a9b]"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {canOrganise && (
            <FolderRail
              folders={folders}
              scope="external"
              unfiledCount={externalUnfiledCount}
              maxFolders={maxFolders}
              isLoading={isLoadingFolders}
              selected={activeFolder}
              onSelect={handleFolder}
              onCreate={() => setCreateOpen(true)}
              onRename={setRenameTarget}
              onDelete={setDeleteTarget}
            />
          )}
        </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

        {isLoadingExternal ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : !externalDocuments.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#8a8a9b]">
            <Mail className="h-8 w-8" />
            <p className="text-xs">
              {activeFolder
                ? "No external documents in this folder"
                : activeFilter > 0
                  ? `No external documents in ${FILTERS[activeFilter].label}`
                  : "You haven't sent anything to an external email yet"}
            </p>
            <Button size="sm" variant="outline" onClick={onNew} className="mt-1">
              <Plus className="mr-1.5 h-4 w-4" />
              Send to an email
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
              {canOrganise && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#8a8a9b]">
                  <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Select all on this page" />
                  {selectedIds.length ? `${selectedIds.length} selected` : "Select all"}
                </label>
              )}
              {!!selectedIds.length && (
                <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
                  <FolderInput className="mr-1.5 h-3.5 w-3.5" />
                  Move to folder
                </Button>
              )}
              {activeFolder && (
                <span className="flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs text-brand">
                  <Folder className="h-3 w-3" />
                  {activeFolder === "unfiled" ? "Global (no folder)" : folderNameById.get(activeFolder) ?? "Folder"}
                  <button type="button" onClick={() => handleFolder(undefined)} aria-label="Show every folder" className="ml-0.5 rounded-full hover:bg-white/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              </div>
              <ShowRecipientsSwitch checked={recipientToggles.showAll} onChange={recipientToggles.setShowAll} />
            </div>
            {/* One bordered box with dividers, as Agreements uses — not per-row cards. */}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#2a2a35] bg-[#111116]">
              <div className="divide-y divide-[#2a2a35]">
                {externalDocuments.map((doc) => {
                  const unread = isUnreadDocument(doc);
                  // Every row on this tab is owned by the viewer (the endpoint scopes to their own
                  // documents), so Agreements' "From: <owner>" would repeat the same name forever.
                  // "To:" is the meaningful counterpart on an outbound list, and the recipients are
                  // already on the row — no extra request.
                  const firstRecipient = doc.recipients?.[0];
                  const recipientLabel = firstRecipient?.name || firstRecipient?.email || "—";
                  const extra = (doc.recipients?.length ?? 0) - 1;
                  return (
                    <div key={doc._id}>
                      <div
                        onClick={() => onOpen(doc)}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        {canOrganise && (
                          <span onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center">
                            <Checkbox
                              checked={selectedIds.includes(doc._id)}
                              onCheckedChange={() => toggleSelected(doc._id)}
                              aria-label={`Select ${doc.title}`}
                            />
                          </span>
                        )}
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", unread ? "bg-brand" : "bg-transparent")}
                          aria-hidden
                        />
                        <Avatar name={recipientLabel} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className={cn("truncate text-[13px] text-white/90", unread && "font-medium")}>{doc.title}</p>
                              {/* Sent together with other documents — opening it shows the whole group as tabs. */}
                              {doc.bundleId && doc.bundleSize && (
                                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[#8a8a9b]" title="Sent together with other documents">
                                  {(doc.bundleIndex ?? 0) + 1} of {doc.bundleSize}
                                </span>
                              )}
                              {/* sentAt is only ever set by the send-for-signature (self-sign) path — fill-on-behalf
                                  goes straight draft -> completed and never sets it, so its absence reliably means
                                  this document was filled in on the recipients' behalf rather than sent to them. */}
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  doc.sentAt ? "bg-brand/15 text-brand" : "bg-white/5 text-[#8a8a9b]"
                                }`}
                              >
                                {doc.sentAt ? "Sent for signature" : "Filled on behalf"}
                              </span>
                            </div>
                            <span className="shrink-0 text-[11px] text-white/45">{formatMailTimestamp(doc.updatedAt)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-3">
                            <p className="flex min-w-0 items-center gap-2 truncate text-[11px] text-white/45">
                              <span className="truncate">
                                To: {recipientLabel}
                                {extra > 0 ? ` +${extra}` : ""}
                              </span>
                              {canOrganise && doc.folderId && folderNameById.get(doc.folderId) && (
                                <span className="flex shrink-0 items-center gap-1 rounded bg-[#2a2a35] px-1.5 py-0.5 text-[10px] text-[#8a8a9b]" title="Folder">
                                  <Folder className="h-2.5 w-2.5" />
                                  <span className="max-w-[10rem] truncate">{folderNameById.get(doc.folderId)}</span>
                                </span>
                              )}
                            </p>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={doc.status} />
                              {doc.status === "completed" && doc.flattenedFileUrl && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild onClick={(e) => e.stopPropagation()}>
                                  <a href={doc.flattenedFileUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="mt-1">
                            <RecipientsToggle
                              recipients={doc.recipients}
                              expanded={recipientToggles.isExpanded(doc._id)}
                              onToggle={() => recipientToggles.toggle(doc._id)}
                            />
                          </div>
                        </div>
                      </div>
                      {recipientToggles.isExpanded(doc._id) && !!doc.recipients?.length && (
                        <div className="border-t border-[#2a2a35]/60 bg-[#111116] py-2 pl-[4.25rem] pr-3">
                          <RecipientsList
                            recipients={doc.recipients}
                            showOrder={doc.signingOrder === "sequential" && doc.recipients.length > 1}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <SimplePagination
              page={externalPagination.page}
              totalPages={externalPagination.totalPages}
              rangeLabel={paginationRangeLabel(externalPagination)}
              onPrev={() => load(activeFolder, externalPagination.page - 1)}
              onNext={() => load(activeFolder, externalPagination.page + 1)}
            />
          </div>
        )}
      </div>
      </div>

        <MoveToFolderDialog
          scope="external"
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          documentIds={selectedIds}
          initialFolderId={sharedFolderId}
          onMoved={refreshAfterFolderChange}
          moveFn={moveExternalDocuments}
        />
        <FolderNameDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="New folder"
          submitLabel="Create"
          onSubmit={handleCreateFolder}
        />
        <FolderNameDialog
          open={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          title="Rename folder"
          submitLabel="Save"
          initialName={renameTarget?.name}
          onSubmit={handleRenameFolder}
        />
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Documents in this folder are not deleted — they move back to Global. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteFolder();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
