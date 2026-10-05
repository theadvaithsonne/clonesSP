"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileSignature, Lock } from "lucide-react";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { DocumentsList } from "@/components/dashboard/docusign/internal/DocumentsList";
import { DocumentUploadDialog } from "@/components/dashboard/docusign/internal/DocumentUploadDialog";
import { FieldEditorView } from "@/components/dashboard/docusign/internal/FieldEditorView";
import { SigningView } from "@/components/dashboard/docusign/internal/SigningView";
import { AdminPanel } from "@/components/dashboard/docusign/shared/AdminPanel";
import { TemplatesList } from "@/components/dashboard/docusign/shared/TemplatesList";
import { AgreementsView } from "@/components/dashboard/docusign/internal/AgreementsView";
import { ExternalSignaturesList } from "@/components/dashboard/docusign/external/ExternalSignaturesList";
import { ExternalFieldEditorView } from "@/components/dashboard/docusign/external/ExternalFieldEditorView";
import { ExternalDocumentUploadDialog } from "@/components/dashboard/docusign/external/ExternalDocumentUploadDialog";
import { DocusignDashboardView } from "@/components/dashboard/docusign/DocusignDashboardView";
import { DocusignErrorBoundary } from "@/components/dashboard/docusign/shared/DocusignErrorBoundary";
import type { DsTemplate } from "@/lib/docusign/types";
import { canSendDocuments } from "@/lib/docusign/access";
import { seedFromDocument, type DocumentSeed } from "@/components/dashboard/docusign/shared/documentSeed";
import { preloadPdfWorker } from "@/lib/pdfWorkerSetup";

type ViewMode =
  | { mode: "list" }
  // templateFields is only ever set right after instantiating a template — it carries the layout
  // (still keyed by abstract recipientSlot numbers) for the editor to seed itself with once real
  // recipients exist. Absent for every other way of reaching "edit"/"external-edit".
  //
  // seed carries what the caller already knew about the document (title/status/file URL/page
  // count) so the editor can render its shell and start downloading the PDF immediately rather
  // than behind a getDocumentDetail round-trip — see documentSeed.ts. Every in-app entry point
  // supplies it; it's absent only on an email deep link, where the editor falls back to its
  // previous behaviour.
  | { mode: "edit"; documentId: string; templateFields?: DsTemplate["fields"]; seed?: DocumentSeed }
  | { mode: "sign"; documentId: string }
  | { mode: "external-edit"; documentId: string; templateFields?: DsTemplate["fields"]; seed?: DocumentSeed };

// Simple client-side passcode gate in front of the Docusign tab — not a real
// authorization boundary (that's still founder/admin, enforced server-side); this is
// just an extra "are you sure" prompt before showing the tab's contents. Not
// remembered anywhere — it prompts every time this component mounts (i.e. every time
// anyone navigates into the Docusign tab), for every user, no bypass.
const DOCUSIGN_PASSCODE = "2323";

function DocusignPasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === DOCUSIGN_PASSCODE) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a35] bg-[#111116]">
        <Lock className="h-5 w-5 text-[#7a7a90]" />
      </div>
      <div className="text-center">
        <h2 className="text-sm font-semibold text-white/90">Enter passcode to continue</h2>
        <p className="text-xs text-[#7a7a90]">This area requires a passcode.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="Passcode"
          className="w-40 text-center tracking-widest"
        />
        {error && <p className="text-xs text-red-400">Incorrect passcode</p>}
        <Button type="submit" size="sm" className="mt-1">
          Unlock
        </Button>
      </form>
    </div>
  );
}

interface DocusignPageProps {
  // Seeds the initial view — used to deep-link straight into a specific document (e.g.
  // from the "Review & Sign" link in a notification email) instead of always landing
  // on the documents list. Each mode is one of ViewMode's own shapes, so it is used as-is.
  initialView?: { mode: "sign" | "edit" | "external-edit"; documentId: string };
}

function DocusignPageInner({ initialView }: DocusignPageProps = {}) {
  const {
    me,
    isSyncing,
    syncError,
    sync,
    assignedDocuments,
    isLoadingAssigned,
    assignedPagination,
    fetchAssignedDocuments,
    isFounderOrAdmin,
    canSendDocuments: canSendDocumentsNow,
    activeTab,
    setActiveTab,
  } = useDocusignStore();
  const [view, setView] = useState<ViewMode>(initialView || { mode: "list" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [externalUploadOpen, setExternalUploadOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  // next.config.ts has reactStrictMode on, which double-invokes effects in dev —
  // without this guard the sync + fetchAssignedDocuments calls below fire twice on
  // every load.
  const hasInitializedRef = useRef(false);

  // Runs regardless of the passcode gate — the global bottom nav dock (layout.tsx)
  // needs `me`/its role as soon as this app is opened, to decide which tabs to show,
  // and the passcode is just a client-side speed bump anyway (see the comment on
  // DOCUSIGN_PASSCODE below), not a real gate worth blocking the profile fetch on.
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    // Pull the ~1.26 MB pdf.js worker into the HTTP cache now, while the user is still
    // looking at the document list — otherwise the first document they open pays for it
    // mid-wait. Fire-and-forget; see lib/pdfWorkerSetup.ts.
    preloadPdfWorker();
    (async () => {
      const synced = await sync();
      // Founders/admins land on the Dashboard tab and senders on Agreements (each
      // self-fetches) — no need to also pre-fetch the plain "Assigned to Me" list they
      // won't see. Everyone else lands on "Assigned to Me", so it needs it upfront.
      if (synced && !canSendDocuments(synced)) {
        fetchAssignedDocuments();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The dock's "Add document"/"Send to an email" action buttons live outside this
  // component's tree (app/(dashboard)/layout.tsx), so they signal here the same way
  // Taskroom's "Add Task"/"Invite People" dock buttons do — a window CustomEvent this
  // component listens for, rather than prop drilling or a store round-trip.
  useEffect(() => {
    const openUpload = () => setUploadOpen(true);
    const openExternalUpload = () => setExternalUploadOpen(true);
    window.addEventListener("docusign:open-upload", openUpload);
    window.addEventListener("docusign:open-external-upload", openExternalUpload);
    return () => {
      window.removeEventListener("docusign:open-upload", openUpload);
      window.removeEventListener("docusign:open-external-upload", openExternalUpload);
    };
  }, []);

  if (!isUnlocked) {
    return <DocusignPasscodeGate onUnlock={() => setIsUnlocked(true)} />;
  }

  if (isSyncing) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
      </div>
    );
  }

  if (syncError || !me) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[#7a7a90]">
        <FileSignature className="h-8 w-8" />
        <p className="text-sm">{syncError || "Couldn't load Docusign"}</p>
      </div>
    );
  }

  // isAdmin: Dashboard + Admin tabs. canSend: Agreements, External, Templates (a sender's own
  // documents only — the backend narrows the lists). See lib/docusign/access.ts.
  const isAdmin = isFounderOrAdmin();
  const canSend = canSendDocumentsNow();

  if (view.mode === "edit") {
    // No explicit refetch needed on the way back — Agreements (and the Dashboard's
    // "Recent documents") remount fresh every time their tab becomes active again
    // (Radix unmounts inactive TabsContent by default), so they pick up the change on
    // their own next mount.
    return (
      <FieldEditorView
        // Keyed by document so switching between the documents of a group remounts the editor with a fresh load.
        key={view.documentId}
        documentId={view.documentId}
        initialTemplateFields={view.templateFields}
        seed={view.seed}
        onBack={() => setView({ mode: "list" })}
        onSent={() => setView({ mode: "list" })}
        onSwitchDocument={(documentId) => setView({ mode: "edit", documentId })}
      />
    );
  }

  if (view.mode === "sign") {
    // Only non-admins render the "Assigned to Me" tab off this store list — for
    // founders/admins the equivalent view is Agreements' "Assigned to Me" filter, which
    // remounts fresh on its own (see the "edit" branch above), so refetching this list
    // would just be a wasted call.
    return (
      <SigningView
        key={view.documentId}
        documentId={view.documentId}
        // A document sent together with others: go straight on to the next one.
        onOpenDocument={(documentId) => setView({ mode: "sign", documentId })}
        onBack={() => {
          setView({ mode: "list" });
          if (!canSend) fetchAssignedDocuments();
        }}
        onDone={() => {
          setView({ mode: "list" });
          if (!canSend) fetchAssignedDocuments();
        }}
        // A founder/admin/sender can reach a mode=sign email link for a document they aren't a recipient
        // on (the backend answers 403) — open it in the editor instead of a dead end.
        onOpenEditor={canSend ? (documentId) => setView({ mode: "edit", documentId }) : undefined}
      />
    );
  }

  if (view.mode === "external-edit") {
    return (
      <ExternalFieldEditorView
        key={view.documentId}
        documentId={view.documentId}
        initialTemplateFields={view.templateFields}
        seed={view.seed}
        onBack={() => setView({ mode: "list" })}
        onSent={() => setView({ mode: "list" })}
        onSwitchDocument={(documentId) => setView({ mode: "external-edit", documentId })}
      />
    );
  }

  // Navigation itself now lives in the global bottom nav dock (app/(dashboard)/layout.tsx,
  // case "docusign") — this just renders whatever `activeTab` that dock has set, the same
  // way Taskroom's ProjectMangement.tsx reads projectActiveItem off its own store instead
  // of owning a <Tabs> bar. "Add document"/"Send to an email" are dock actions too (see
  // the window event listeners above), so there's no in-page trigger for them anymore.
  // pb-24 on the outer shell (not just the scrollable inner div) shrinks the space
  // flex-1 below has to work with, so its bottom edge always clears the floating
  // bottom-center nav dock (app/(dashboard)/layout.tsx, ~88px tall including its own
  // bottom-6 offset) — this has to hold even for short tabs (e.g. Admin's default
  // "Admins" scope, often just 1-2 rows) where nothing ever actually scrolls, not only
  // for long lists scrolled to the bottom. Without it, a button that lands at that
  // screen position (a "Next page" arrow, most visibly) gets swallowed by the dock's
  // click target underneath instead of registering its own click.
  // See the wrapper comment below.
  const tabOwnsScroll = activeTab === "Agreements" || activeTab === "External";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6 pb-5">
   

      {/* Agreements and External are two-pane layouts (a filter/folder rail beside the list), and
          each pane scrolls on its own. They therefore need this box to hand them the full remaining
          height WITHOUT scrolling itself — one outer scrollbar here would let the rail grow past the
          bottom of the screen instead of scrolling inside its own column. Every other tab is a
          single column and still scrolls as one. */}
      <div className={`mt-4 min-h-0 flex-1 ${tabOwnsScroll ? "overflow-hidden" : "overflow-y-auto"}`}>
        {activeTab === "Dashboard" && isAdmin && (
          <DocusignDashboardView
            onOpen={(doc, kind) =>
              setView(
                kind === "external"
                  ? { mode: "external-edit", documentId: doc._id, seed: seedFromDocument(doc) }
                  : { mode: "edit", documentId: doc._id, seed: seedFromDocument(doc) }
              )
            }
            onViewAll={() => setActiveTab("Agreements")}
          />
        )}

        {activeTab === "Assigned" && !canSend && (
          // Header lives here rather than inside DocumentsList: that component is a plain list and
          // should stay reusable, but the tab still needs the same title/subtitle every other
          // Docusign tab leads with.
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white/90">Assigned to Me</h2>
              <p className="text-xs text-[#7a7a90]">Documents waiting for your signature.</p>
            </div>
            {isLoadingAssigned ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            ) : (
            <DocumentsList
              documents={assignedDocuments}
              emptyLabel="No documents are waiting for your signature"
              onOpen={(id) => setView({ mode: "sign", documentId: id })}
              pagination={assignedPagination}
              onPageChange={(page) => fetchAssignedDocuments(page)}
            />
            )}
          </div>
        )}

        {activeTab === "Agreements" && canSend && (
          <AgreementsView
            onOpen={(doc) =>
              setView(
                // A row carries myRecipientStatus only when it came from the
                // "Assigned to Me" filter — open it as a signer, not as the owner.
                doc.myRecipientStatus !== undefined
                  ? { mode: "sign", documentId: doc._id }
                  : { mode: "edit", documentId: doc._id, seed: seedFromDocument(doc) }
              )
            }
          />
        )}

        {activeTab === "External" && canSend && (
          <ExternalSignaturesList
            onOpen={(doc) => setView({ mode: "external-edit", documentId: doc._id, seed: seedFromDocument(doc) })}
            onNew={() => setExternalUploadOpen(true)}
          />
        )}

        {activeTab === "Templates" && canSend && (
          <TemplatesList
            canManage={canSend}
            onUseTemplate={(doc, templateFields) =>
              setView({ mode: "edit", documentId: doc._id, templateFields, seed: seedFromDocument(doc) })
            }
            onUseExternalTemplate={(doc, templateFields) =>
              setView({ mode: "external-edit", documentId: doc._id, templateFields, seed: seedFromDocument(doc) })
            }
          />
        )}

        {activeTab === "Admin" && isAdmin && <AdminPanel />}
      </div>

      <DocumentUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={(doc) => {
          setUploadOpen(false);
          setView({ mode: "edit", documentId: doc._id, seed: seedFromDocument(doc) });
        }}
      />

      <ExternalDocumentUploadDialog
        open={externalUploadOpen}
        onClose={() => setExternalUploadOpen(false)}
        onCreated={(doc) => {
          setExternalUploadOpen(false);
          setView({ mode: "external-edit", documentId: doc._id, seed: seedFromDocument(doc) });
        }}
      />
    </div>
  );
}

export default function DocusignPage(props: DocusignPageProps = {}) {
  return (
    <DocusignErrorBoundary>
      <DocusignPageInner {...props} />
    </DocusignErrorBoundary>
  );
}
