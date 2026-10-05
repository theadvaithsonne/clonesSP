"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { SimplePagination, paginationRangeLabel } from "@/components/dashboard/docusign/shared/SimplePagination";
import { formatMailTimestamp, isUnreadDocument } from "@/components/dashboard/docusign/shared/listFormat";
import { Avatar } from "@/components/ui/data-table/cells";
import { RecipientsList, RecipientsToggle, ShowRecipientsSwitch, useRecipientToggles } from "@/components/dashboard/docusign/shared/DocumentRecipients";
import { DsFolder, FolderFilter } from "@/lib/docusign/types";
import { DsDocument, moveDocuments } from "@/lib/docusign/internal-api";
import { createFolder, renameFolder, deleteFolder } from "@/lib/docusign/shared-api";
import { isDocusignAdminUser } from "@/lib/docusign/access";
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
import { Inbox, UserCheck, Send, MailCheck, FileEdit, Clock, CheckCircle2, Ban, Loader2, Folder, FolderInput, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgreementsViewProps {
  // Passed the full row, not just the id — a row carries myRecipientStatus only when
  // it came back from the "Assigned to Me" scope, which is the caller's signal to open
  // it as a signer (SigningView) rather than as the owner (FieldEditorView).
  onOpen: (doc: DsDocument) => void;
}

// Backend status values a filter maps to. "Sent" and "In Progress" are separate buckets so a
// filter label always means the same thing as the badge on the rows it returns: picking
// "In Progress" used to also return everything still badged "Sent", because the two were folded
// into one filter — which disagreed with the status badge, the Dashboard's donut and the External
// tab, all of which treat them as distinct. "Assigned to Me"/"Sent by Me"
// fold what used to be their own top-level tabs into this same list as a scope filter,
// via listAllInOrg's scope param — one table, one pagination state, instead of three.
// `count` reads off the Dashboard's already-fetched stats — an inbox-style "how many
// need attention" badge per folder, not a full recount (Sent/All have no single number
// worth badging, same as Gmail's own Sent folder has no unread count).
// `group` is purely presentational — it separates two different questions this one flat list used to
// blur together: "whose agreements am I looking at" (view) vs "what stage are they at" (status). Picking
// one filter is still exclusive of the others (the backend call takes one status/scope at a time), but
// grouping them under two headings in the sidebar at least tells a founder/admin which kind of choice
// they're making, instead of 7 identical-looking buttons in a row.
const FILTERS: Array<{
  label: string;
  icon: LucideIcon;
  group: "view" | "status";
  status?: string;
  scope?: "sent" | "assigned";
  count?: (s: ReturnType<typeof useDocusignStore.getState>["stats"]) => number | undefined;
}> = [
  { label: "All Agreements", icon: Inbox, group: "view", count: (s) => s?.total },
  { label: "Assigned to Me", icon: UserCheck, group: "view", scope: "assigned", count: (s) => s?.assignedToMePending },
  { label: "Sent by Me", icon: Send, group: "view", scope: "sent" },
  { label: "Drafts", icon: FileEdit, group: "status", status: "draft", count: (s) => s?.draft },
  { label: "Sent", icon: MailCheck, group: "status", status: "sent", count: (s) => s?.sent },
  { label: "In Progress", icon: Clock, group: "status", status: "in_progress", count: (s) => s?.in_progress },
  { label: "Completed", icon: CheckCircle2, group: "status", status: "completed", count: (s) => s?.completed },
  { label: "Voided", icon: Ban, group: "status", status: "voided", count: (s) => s?.voided },
];

const GROUP_LABELS: Record<"view" | "status", string> = { view: "Views", status: "Status" };

// "Unread" here means "still needs someone's attention" — bold row + dot, same visual
// job an email client's unread marker does. Assigned-scope rows go by the caller's own
// signing status; everything else goes by whether the envelope is still in flight.
export function AgreementsView({ onOpen }: AgreementsViewProps) {
  const {
    allDocuments,
    allPagination,
    isLoadingAll,
    fetchAllDocuments,
    stats,
    fetchStats,
    me,
    folders,
    unfiledCount,
    maxFolders,
    foldersLoaded,
    isLoadingFolders,
    fetchFolders,
    folderStats,
    fetchFolderStats,
  } = useDocusignStore();
  const isAdmin = isDocusignAdminUser(me);
  // A sender has no org-wide view — the backend narrows "all" (and every status filter) to their own
  // documents — so "All Agreements" would only repeat "Sent by Me". They get the rest and land on "Sent by Me".
  const filters = useMemo(() => (isAdmin ? FILTERS : FILTERS.filter((f) => f.group !== "view" || f.scope)), [isAdmin]);
  const [activeFilter, setActiveFilter] = useState(() => (isAdmin ? 0 : Math.max(0, filters.findIndex((f) => f.scope === "sent"))));
  // undefined = every folder; "unfiled" = Global (no folder); otherwise a folder id.
  const [activeFolder, setActiveFolder] = useState<FolderFilter | undefined>(undefined);
  const hasLoadedRef = useRef(false);
  const recipientToggles = useRecipientToggles();

  // Folders are founder/admin-only end to end (the backend enforces it too), so everything folder-related below
  // is simply not rendered for anyone else — and their folder endpoints are never called.
  const canOrganise = isAdmin;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DsFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DsFolder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (canOrganise && !foldersLoaded) fetchFolders("internal", { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOrganise]);

  const folderNameById = useMemo(() => new Map(folders.map((f) => [f._id, f.name])), [folders]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    fetchAllDocuments(filters[activeFilter].status, 1, filters[activeFilter].scope);
    if (!stats) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (filterIndex: number, folder: FolderFilter | undefined, page = 1) => {
    setSelectedIds([]);
    fetchAllDocuments(filters[filterIndex].status, page, filters[filterIndex].scope, folder);
  };

  const handleFilter = (index: number) => {
    setActiveFilter(index);
    load(index, activeFolder);
  };

  const handleFolder = (next: FolderFilter | undefined) => {
    setActiveFolder(next);
    load(activeFilter, next);
    // Status badges follow the folder being browsed; leaving folders goes back to the org-wide numbers.
    fetchFolderStats(next);
  };

  const goToPage = (page: number) => load(activeFilter, activeFolder, page);

  // Moving or deleting the last rows of a later page leaves that page empty — and the empty state
  // has no pager to leave it with. Step back to the last page that can still have rows instead
  // (always strictly lower, and at most once per response — a failed step leaves the same
  // pagination object behind, which must not trigger another). Read from the store, not this
  // render: on mount the list effect above has just started page 1, and this must not race it.
  const steppedBackFromRef = useRef<typeof allPagination | null>(null);
  useEffect(() => {
    const { isLoadingAll: loading, allDocuments: rows, allPagination: p } = useDocusignStore.getState();
    if (loading || rows.length || p.page <= 1 || steppedBackFromRef.current === p) return;
    steppedBackFromRef.current = p;
    goToPage(Math.max(1, Math.min(p.totalPages, p.page - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAll, allDocuments, allPagination]);

  // After anything that changes which folder a document is in (or a folder's contents): re-read the current
  // page, the folder counts, and the badge numbers.
  const refreshAfterFolderChange = () => {
    load(activeFilter, activeFolder, allPagination.page);
    fetchFolders("internal", { silent: true });
    fetchFolderStats(activeFolder);
  };

  const handleCreateFolder = async (name: string) => {
    await createFolder(name, "internal");
    await fetchFolders("internal", { silent: true });
    toast.success(`Folder “${name}” created`);
  };

  const handleRenameFolder = async (name: string) => {
    if (!renameTarget) return;
    await renameFolder(renameTarget._id, name);
    await fetchFolders("internal", { silent: true });
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
        load(activeFilter, undefined);
        fetchFolderStats(undefined);
      } else {
        load(activeFilter, activeFolder, allPagination.page);
      }
      fetchFolders("internal", { silent: true });
    } catch (err: any) {
      toast.error(err.message || "Could not delete the folder");
    } finally {
      setIsDeleting(false);
    }
  };

  const allOnPageSelected = !!allDocuments.length && allDocuments.every((d) => selectedIds.includes(d._id));
  const toggleSelected = (id: string) => setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAllOnPage = () => setSelectedIds(allOnPageSelected ? [] : allDocuments.map((d) => d._id));

  // Pre-select the current folder in the move dialog when every chosen document is in the same one.
  const selectedDocs = allDocuments.filter((d) => selectedIds.includes(d._id));
  const sharedFolderId = selectedDocs.length && selectedDocs.every((d) => (d.folderId ?? null) === (selectedDocs[0].folderId ?? null)) ? selectedDocs[0].folderId ?? null : null;

  // Under a folder, the badges come from that folder's own stats. "Assigned to Me" is an org-wide personal count
  // (not per folder), so it is left off rather than shown with a number that doesn't match the list.
  const badgeStats = activeFolder ? folderStats : stats;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      {/* Every other Docusign tab leads with its name and a one-line description; this one used to
          drop straight into the filter rail, so the title matching the nav item was missing. */}
      <div className="shrink-0">
        <h2 className="text-sm font-semibold text-white/90">Agreements</h2>
        <p className="text-xs text-[#7a7a90]">
          Every document in your organization — filter by whose they are or what stage they have reached.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
      {/* Fixed-width rail that scrolls independently of the list beside it: both panes are
          bounded by this row's height, so the filters and folders stay put while the list scrolls,
          and a long folder list scrolls inside the rail instead of running off the bottom of the
          screen. min-h-0 is what makes that work — a flex child otherwise refuses to shrink below
          its content and overflows rather than scrolling. Not sticky: sticky was the wrong fix for
          this, since nothing here was ever inside the list's scroll box. */}
      <div className="w-52 shrink-0 min-h-0 overflow-y-auto space-y-0.5 pr-1">
        {filters.map((f, i) => {
          const count = activeFolder && f.scope === "assigned" ? undefined : f.count?.(badgeStats);
          const active = activeFilter === i;
          // A heading whenever the group changes from the row before it — "Views" always leads (no
          // top border, it's the first thing in the sidebar), "Status" gets a divider above it so it
          // reads as a distinct second list, the same visual break Folders already uses below.
          const isNewGroup = i === 0 || filters[i - 1].group !== f.group;
          return (
            <div key={f.label}>
              {isNewGroup && (
                <div className={cn("px-3 pb-1", i === 0 ? "pt-0" : "mt-2 border-t border-[#2a2a35] pt-3")}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{GROUP_LABELS[f.group]}</span>
                </div>
              )}
              <button
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
            </div>
          );
        })}

        {canOrganise && (
          <FolderRail
            folders={folders}
            scope="internal"
            unfiledCount={unfiledCount}
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

      {/* min-h-0 is load-bearing: a flex column's children default to min-height:auto,
          which refuses to shrink below content size — without it, the row list below
          just silently pushed past its overflow-hidden box instead of scrolling
          (that's what was clipping rows 7+ in the previous version). The scrolling box
          itself is the row list below, not this whole column, so pagination stays put. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isLoadingAll ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : !allDocuments.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#8a8a9b]">
            <Inbox className="h-8 w-8" />
            <p className="text-xs">{activeFolder ? "No agreements in this folder" : "No agreements in this view"}</p>
          </div>
        ) : (
          <>
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
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#2a2a35] bg-[#111116]">
              <div className="divide-y divide-[#2a2a35]">
              {allDocuments.map((doc) => {
                const unread = isUnreadDocument(doc);
                return (
                  <div key={doc._id}>
                  <div
                    onClick={() => onOpen(doc)}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    {canOrganise && (
                      // Stops the click reaching the row, which would open the document.
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
                    <Avatar src={doc.ownerImage} name={doc.ownerName || doc.ownerEmail} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className={cn("truncate text-[13px] text-white/90", unread && "font-medium")}>
                            {doc.title}
                          </p>
                          {/* Sent together with other documents — opening it shows the whole group as tabs. */}
                          {doc.bundleId && doc.bundleSize && (
                            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[#8a8a9b]" title="Sent together with other documents">
                              {(doc.bundleIndex ?? 0) + 1} of {doc.bundleSize}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-white/45">{formatMailTimestamp(doc.updatedAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 truncate text-[11px] text-white/45">
                          <span className="truncate">From: {doc.ownerName || doc.ownerEmail || "—"}</span>
                          {canOrganise && doc.folderId && folderNameById.get(doc.folderId) && (
                            <span className="flex shrink-0 items-center gap-1 rounded bg-[#2a2a35] px-1.5 py-0.5 text-[10px] text-[#8a8a9b]" title="Folder">
                              <Folder className="h-2.5 w-2.5" />
                              <span className="max-w-[10rem] truncate">{folderNameById.get(doc.folderId)}</span>
                            </span>
                          )}
                        </p>
                        <StatusBadge status={doc.myRecipientStatus || doc.status} className="shrink-0" />
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
                      <RecipientsList recipients={doc.recipients} showOrder={doc.signingOrder === "sequential" && doc.recipients.length > 1} />
                    </div>
                  )}
                  </div>
                );
              })}
              </div>
            </div>
            <SimplePagination
              page={allPagination.page}
              totalPages={allPagination.totalPages}
              rangeLabel={paginationRangeLabel(allPagination)}
              onPrev={() => goToPage(allPagination.page - 1)}
              onNext={() => goToPage(allPagination.page + 1)}
            />
          </>
        )}
      </div>
      </div>

      {canOrganise && (
        <>
          <MoveToFolderDialog
            scope="internal"
            open={moveOpen}
            onClose={() => setMoveOpen(false)}
            documentIds={selectedIds}
            initialFolderId={sharedFolderId}
            onMoved={refreshAfterFolderChange}
            moveFn={moveDocuments}
          />
          <FolderNameDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="New folder"
            description="Folders only organise your agreements; they don't change who can see or sign them."
            submitLabel="Create"
            onSubmit={handleCreateFolder}
          />
          <FolderNameDialog
            open={!!renameTarget}
            onClose={() => setRenameTarget(null)}
            title="Rename folder"
            submitLabel="Save"
            initialName={renameTarget?.name ?? ""}
            onSubmit={handleRenameFolder}
          />
          <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget?.documentCount
                    ? `The ${deleteTarget.documentCount} document${deleteTarget.documentCount === 1 ? "" : "s"} in this folder will not be deleted; they move back to Global (no folder).`
                    : "This folder is empty."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeleting}
                  onClick={(e) => {
                    // Keep the dialog open until the request finishes.
                    e.preventDefault();
                    handleDeleteFolder();
                  }}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete folder"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
