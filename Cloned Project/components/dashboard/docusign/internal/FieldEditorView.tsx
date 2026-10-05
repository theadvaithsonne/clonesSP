"use client";

import "@/lib/pdfWorkerSetup";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import { LazyPdfPage } from "@/components/dashboard/docusign/shared/LazyPdfPage";
import { PlacedField } from "@/components/dashboard/docusign/shared/PlacedField";
import { FieldStylePanel } from "@/components/dashboard/docusign/shared/FieldStylePanel";
import { fieldTextStyle, usePageSizes } from "@/components/dashboard/docusign/shared/fieldStyle";
import { remapFieldOwners, shortRecipientName } from "@/components/dashboard/docusign/shared/recipientRemap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  ArrowLeft,
  Loader2,
  Send,
  Type,
  PenLine,
  Signature,
  Stamp,
  CalendarDays,
  CheckSquare,
  Save,
  RefreshCw,
  ShieldCheck,
  FileBadge,
  Copy,
  Download,
  Archive,
  User,
  UserRound,
  UserSquare,
  Mail,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { RecipientsPanel, RecipientDraft } from "@/components/dashboard/docusign/internal/RecipientsPanel";
import { RECIPIENT_COLORS, MAX_SEPARATE_COPIES } from "@/components/dashboard/docusign/shared/recipientConstants";
import { useDocusignStore } from "@/store/docusign/docusignStore";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/dashboard/docusign/shared/editorTokens";
import { AuditTrailView } from "@/components/dashboard/docusign/shared/AuditTrailView";
import { CopiesProgressPanel } from "@/components/dashboard/docusign/shared/CopiesProgressPanel";
import type { DsField, DsAuditLogEntry, DsDeliveryMode, DsVerifyResult, DsTemplate } from "@/lib/docusign/types";
import {
  DsRecipient,
  getDocumentDetail,
  getAuditLogPage,
  getDocumentFileLink,
  downloadEvidencePackage,
  setRecipients as apiSetRecipients,
  setFields as apiSetFields,
  sendDocument as apiSendDocument,
  voidDocument as apiVoidDocument,
  resendDocument as apiResendDocument,
  verifyDocument as apiVerifyDocument,
  // Passed explicitly into the shared CopiesProgressPanel — it takes no default, so that
  // shared component never has to import either flow's API.
  getCopiesProgress,
  retryFailedCopies,
  getDocumentBundle,
  syncBundleRecipients,
  sendDocumentBundle,
  resendDocumentBundle,
} from "@/lib/docusign/internal-api";
import type { DsBundle } from "@/lib/docusign/types";
import { BundleBar } from "@/components/dashboard/docusign/shared/BundleBar";
import { createTemplate as apiCreateTemplate } from "@/lib/docusign/shared-api";
import type { DocumentSeed } from "@/components/dashboard/docusign/shared/documentSeed";
import { PdfPagePlaceholders } from "@/components/dashboard/docusign/shared/PdfPagePlaceholders";

const PAGE_WIDTH = 720;

interface FieldSpec {
  type: DsField["type"];
  label: string;
  icon: any;
  w: number;
  h: number;
}

// Grouped to match the standard signer-field palette: signing marks, auto-filled
// recipient info, then free-form inputs.
const FIELD_GROUPS: Array<{ fields: FieldSpec[] }> = [
  {
    fields: [
      { type: "signature", label: "Signature", icon: PenLine, w: 0.22, h: 0.055 },
      { type: "initials", label: "Initial", icon: Signature, w: 0.08, h: 0.05 },
      { type: "stamp", label: "Stamp", icon: Stamp, w: 0.14, h: 0.08 },
      { type: "date", label: "Date Signed", icon: CalendarDays, w: 0.14, h: 0.035 },
    ],
  },
  {
    fields: [
      { type: "name", label: "Name", icon: User, w: 0.18, h: 0.035 },
      { type: "first_name", label: "First Name", icon: UserRound, w: 0.12, h: 0.035 },
      { type: "last_name", label: "Last Name", icon: UserSquare, w: 0.12, h: 0.035 },
      { type: "email", label: "Email Address", icon: Mail, w: 0.2, h: 0.035 },
      { type: "company", label: "Company", icon: Building2, w: 0.18, h: 0.035 },
      { type: "title", label: "Title", icon: Briefcase, w: 0.15, h: 0.035 },
    ],
  },
  {
    fields: [
      { type: "text", label: "Text", icon: Type, w: 0.18, h: 0.035 },
      { type: "checkbox", label: "Checkbox", icon: CheckSquare, w: 0.03, h: 0.025 },
    ],
  },
];

const FIELD_TYPES: FieldSpec[] = FIELD_GROUPS.flatMap((g) => g.fields);

// signature/initials/stamp fields render their captured image; every other type
// (including the recipient-info autofill fields) renders as plain text.
const isImageFieldType = (type: DsField["type"]) => type === "signature" || type === "initials" || type === "stamp";

interface FieldDraft {
  id: string; // temp client id, or the real _id once loaded from the server
  recipientIndex: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: DsField["type"];
  required: boolean;
  // Optional per-field styling chosen by the sender. fontSize is in PDF points; colour is
  // "#rrggbb". Absent = drawn at DEFAULT_FONT_SIZE / black. Both follow the field through to
  // the signer's view and the flattened PDF.
  fontSize?: number;
  color?: string;
  value?: string;
  checked?: boolean;
}

interface FieldEditorViewProps {
  documentId: string;
  // A template's field layout, still keyed by abstract recipientSlot numbers (see
  // TemplatesList.tsx) — seeded onto the canvas once real recipients exist to map slots onto.
  initialTemplateFields?: DsTemplate["fields"];
  // What the caller already knew about this document when it navigated here (see
  // DocusignPage's ViewMode). Every entry point into this view — a list row, a template
  // instantiation, a fresh upload — is holding the whole DsDocument already, so passing it
  // through lets <Document> start downloading the PDF on the very first render instead of
  // waiting a full getDocumentDetail round-trip to learn a URL the caller already had.
  // Purely a head start: loadDocument() below still overwrites all of it and remains the
  // source of truth.
  seed?: DocumentSeed;
  onBack: () => void;
  onSent: () => void;
  // For a document sent together with others (a group): open another document of the group in this editor.
  onSwitchDocument?: (documentId: string) => void;
}

export function FieldEditorView({ documentId, initialTemplateFields, seed, onBack, onSent, onSwitchDocument }: FieldEditorViewProps) {
  const { orgMembers, fetchOrgMembers, me } = useDocusignStore();
  const [title, setTitle] = useState(seed?.title ?? "");
  const [numPages, setNumPages] = useState(0);
  // Only ever a placeholder count for the not-yet-parsed pages — once the PDF loads,
  // numPages (pdf.js's own answer) takes over and this is unused.
  const [seededPageCount] = useState(seed?.pageCount ?? 0);
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);
  const [signingOrder, setSigningOrder] = useState<"sequential" | "parallel">("sequential");
  // "separate": Send creates one independent copy per recipient, all from the single field layout placed here
  // (kept on recipient #1, index 0). "shared": everyone signs the one document (the original behaviour).
  const [deliveryMode, setDeliveryMode] = useState<DsDeliveryMode>(seed?.deliveryMode ?? "shared");
  const [fields, setFieldsState] = useState<FieldDraft[]>([]);
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  // The ds_user who created this document (compared with `me._id`). A founder/admin can open anyone's
  // draft, but only its owner may save or send it — the backend answers 404 for anyone else.
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  // Seeded (when the caller knew it) with `flattenedFileUrl || originalFileUrl` already
  // resolved, so it can be handed straight to <Document> on the first render. loadDocument()
  // then sets both properly; re-setting the identical string is a no-op in React, so the
  // common case costs no extra fetch.
  const [originalFileUrl, setOriginalFileUrl] = useState(seed?.fileUrl ?? "");
  const [flattenedFileUrl, setFlattenedFileUrl] = useState("");
  const [status, setStatus] = useState(seed?.status ?? "draft");
  const [recipientRecords, setRecipientRecords] = useState<DsRecipient[]>([]);
  // Newest-first, one page at a time — see getAuditLogPage. auditHasMore reflects whichever page is currently
  // the tail of auditLog, so it only ever means "the entries after the last one shown are still out there."
  const [auditLog, setAuditLog] = useState<DsAuditLogEntry[]>([]);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [isLoadingMoreAudit, setIsLoadingMoreAudit] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // The "Resend reminder" dialog: which recipients are ticked.
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSelected, setReminderSelected] = useState<string[]>([]);
  const [envelopeId, setEnvelopeId] = useState("");
  const [certificateFileUrl, setCertificateFileUrl] = useState("");
  const [flattenedFileHash, setFlattenedFileHash] = useState("");
  // Fingerprints recorded at completion: the original PDF, and the audit trail (see the backend's evidence work).
  const [originalFileHash, setOriginalFileHash] = useState("");
  const [originalFileHashSource, setOriginalFileHashSource] = useState<"upload" | "completion" | "">("");
  const [originalIntegrity, setOriginalIntegrity] = useState<"match" | "mismatch" | "unverified" | "">("");
  const [auditChainHash, setAuditChainHash] = useState("");
  const [auditChainEvents, setAuditChainEvents] = useState(0);
  const [verifyDetails, setVerifyDetails] = useState<DsVerifyResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [packageHash, setPackageHash] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  // The SHA-256 fingerprints are for someone who wants to independently verify the document —
  // collapsed by default so the panel leads with the certificate/verify actions everyone wants.
  const [showFingerprints, setShowFingerprints] = useState(false);
  // True once recipients/fields/signingOrder differ from what's last known-saved on the
  // server — Send only re-persists when this is set, instead of unconditionally redoing
  // the same PUT recipients + PUT fields calls Save Draft just did.
  const [isDirty, setIsDirty] = useState(false);
  // isLoading covers only the document/recipients/fields metadata fetch. The PDF download +
  // parse is a separate wait, and it is handled entirely by <Document loading={...}> below
  // (PdfPagePlaceholders) — scoped to the page column, so the header, field palette and
  // recipients rail stay usable throughout rather than being hidden behind a full-view
  // overlay as they used to be.
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const { onPageSize, sizeOf } = usePageSizes();
  // next.config.ts has reactStrictMode on, which double-invokes effects in dev —
  // without this guard the load below fires twice on every mount.
  // (The organisation's members are deliberately NOT loaded here: RecipientsPanel asks for them the first
  // time its "Add a recipient" list is opened.)
  const hasFetchedDetailRef = useRef(false);
  // Set when this document was uploaded together with others (a group sent to the same people): the group's
  // documents for the tabs above the page, and its one shared recipient list (see syncBundleRecipients).
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<DsBundle<DsRecipient> | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const refreshBundle = async (id: string) => {
    try {
      const res = await getDocumentBundle(id);
      setBundle(res.data);
    } catch {
      /* the tabs just keep their last state */
    }
  };

  // The single source of truth for this view's document/recipient/field state — always
  // re-fetched from the backend after a mutation succeeds, rather than patching local
  // state from assumptions about what the mutation did.
  const loadDocument = async () => {
    try {
      const res = await getDocumentDetail(documentId);
      setTitle(res.data.document.title);
      setOwnerUserId(res.data.document.ownerUserId || null);
      setOriginalFileUrl(res.data.document.originalFileUrl);
      setFlattenedFileUrl(res.data.document.flattenedFileUrl || "");
      setStatus(res.data.document.status);
      setSigningOrder(res.data.document.signingOrder);
      setDeliveryMode(res.data.document.deliveryMode ?? "shared");
      setBundleId(res.data.document.bundleId || null);
      if (res.data.document.bundleId) refreshBundle(res.data.document.bundleId);
      const sortedRecipients = res.data.recipients.slice().sort((a, b) => a.order - b.order);
      setRecipientRecords(sortedRecipients);
      setAuditLog(res.data.auditLog);
      setAuditHasMore(res.data.auditHasMore);
      setEnvelopeId(res.data.document.envelopeId || "");
      setCertificateFileUrl(res.data.document.certificateFileUrl || "");
      setFlattenedFileHash(res.data.document.flattenedFileHash || "");
      setOriginalFileHash(res.data.document.originalFileHash || "");
      setOriginalFileHashSource(res.data.document.originalFileHashSource || "");
      setOriginalIntegrity(res.data.document.originalIntegrity || "");
      setAuditChainHash(res.data.document.auditChainHash || "");
      setAuditChainEvents(res.data.document.auditChainEvents || 0);
      setVerifyResult(null);
      setVerifyDetails(null);

      const loadedRecipients = sortedRecipients
        .map((r) => ({ userId: r.userId, email: r.email, name: r.name, order: r.order }));
      setRecipients(loadedRecipients);

      const recipientIdToIndex = new Map(sortedRecipients.map((r, idx) => [r._id, idx]));
      setFieldsState(
        res.data.fields.map((f) => ({
          id: f._id,
          recipientIndex: recipientIdToIndex.get(f.recipientId) ?? 0,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          type: f.type,
          required: f.required,
          fontSize: f.fontSize,
          color: f.color,
          value: f.value,
          checked: f.checked,
        }))
      );
      // Local state now matches the server exactly — nothing to re-persist until the
      // user changes something again.
      setIsDirty(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document");
    }
  };

  useEffect(() => {
    if (hasFetchedDetailRef.current) return;
    hasFetchedDetailRef.current = true;
    loadDocument().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Seeds the canvas from a template's field layout once real recipients exist to map its abstract
  // recipientSlot numbers onto — a freshly-instantiated document has none yet (see TemplatesList.tsx's
  // "Use template"), so this can't run until the sender adds recipients. Guarded to fire exactly once,
  // and only while the canvas is still empty, so it never overwrites fields the user has since placed/edited.
  const appliedTemplateFieldsRef = useRef(false);
  useEffect(() => {
    if (appliedTemplateFieldsRef.current) return;
    if (!initialTemplateFields?.length || !recipients.length || fields.length) return;
    appliedTemplateFieldsRef.current = true;
    setFieldsState(
      initialTemplateFields.map((f) => ({
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        recipientIndex: Math.min(Math.max((f.recipientSlot || 1) - 1, 0), recipients.length - 1),
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        type: f.type,
        required: f.required,
        fontSize: f.fontSize,
        color: f.color,
      }))
    );
  }, [initialTemplateFields, recipients.length, fields.length]);

  const isDraft = status === "draft";
  const separate = deliveryMode === "separate";
  // Assumed true until the detail call says otherwise (the draft actions are disabled until then anyway).
  const isOwner = !ownerUserId || !me || ownerUserId === me._id;

  const handleDropOnPage = (e: React.DragEvent<HTMLDivElement>, page: number) => {
    e.preventDefault();
    if (!isDraft) return;
    if (!recipients.length) {
      toast.error("Add a recipient before placing fields");
      return;
    }
    const fieldType = e.dataTransfer.getData("fieldType") as DsField["type"];
    if (!fieldType) return;
    const spec = FIELD_TYPES.find((f) => f.type === fieldType);
    if (!spec) return;

    const container = pageRefs.current[page];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const newId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFieldsState((prev) => [
      ...prev,
      {
        id: newId,
        recipientIndex: separate ? 0 : activeRecipientIdx,
        page,
        x: Math.min(Math.max(relX - spec.w / 2, 0), 1 - spec.w),
        y: Math.min(Math.max(relY - spec.h / 2, 0), 1 - spec.h),
        width: spec.w,
        height: spec.h,
        type: fieldType,
        required: true,
      },
    ]);
    setSelectedFieldId(newId);
    setIsDirty(true);
  };

  const removeField = (id: string) => {
    setFieldsState((prev) => prev.filter((f) => f.id !== id));
    setSelectedFieldId((cur) => (cur === id ? null : cur));
    setIsDirty(true);
  };

  // Move / resize / restyle one placed field. A patch key set to `undefined` clears that property.
  const updateField = (id: string, patch: Partial<FieldDraft>) => {
    setFieldsState((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setIsDirty(true);
  };

  // Reorder / remove recipients WITHOUT changing who owns which field: fields follow their person, and the
  // fields of a removed person are dropped (with a notice) instead of passing to whoever slides into their slot.
  const applyRecipientsChange = (next: RecipientDraft[]) => {
    // Separate copies: the one layout belongs to "the signer", not to a person, so adding/removing/reordering
    // people never moves or drops it.
    if (separate) {
      setRecipients(next);
      setIsDirty(true);
      return;
    }
    const { fields: remapped, removed, indexMap, removedRecipients } = remapFieldOwners(recipients, next, fields, (r) => r.userId);
    setRecipients(next);
    setFieldsState(remapped);
    setActiveRecipientIdx((cur) => {
      const moved = indexMap[cur];
      return moved !== undefined && moved >= 0 ? moved : 0;
    });
    if (removed.length) {
      const names = (removedRecipients as RecipientDraft[]).map((r) => r.name || r.email).join(", ");
      toast.warning(`Removed ${removed.length} field${removed.length === 1 ? "" : "s"} that belonged to ${names}`);
      setSelectedFieldId((cur) => (removed.some((f) => f.id === cur) ? null : cur));
    }
    setIsDirty(true);
  };


  const handleDeliveryModeChange = (mode: DsDeliveryMode) => {
    setDeliveryMode(mode);
    if (mode === "separate") {
      // One layout for everyone: pull every field onto the first slot so nothing is left owned by a
      // specific person (the backend clones this layout for each recipient at send time).
      setFieldsState((prev) => prev.map((f) => ({ ...f, recipientIndex: 0 })));
      setActiveRecipientIdx(0);
      if (recipients.length > MAX_SEPARATE_COPIES) {
        toast.warning(`Separate copies support up to ${MAX_SEPARATE_COPIES} people; remove ${recipients.length - MAX_SEPARATE_COPIES} to send.`);
      }
    }
    setIsDirty(true);
  };

  // `allowEmpty`: switching to another document of a group saves whatever is here, even before any field is placed.
  const persistRecipientsAndFields = async ({ allowEmpty = false } = {}): Promise<boolean> => {
    if (!recipients.length) {
      if (allowEmpty && bundleId) return true;
      toast.error("Add at least one recipient");
      return false;
    }
    if (!fields.length && !allowEmpty) {
      toast.error("Place at least one field");
      return false;
    }

    let recipientIds: string[];
    if (bundleId) {
      // One list for every document of the group; people who stay keep their ids, so fields already placed for them on
      // the other documents are kept. The response has each document's rows, in list order.
      const synced = await syncBundleRecipients(
        bundleId,
        recipients.map((r) => ({ userId: r.userId, email: r.email, name: r.name }))
      );
      recipientIds = (synced.data.recipients[documentId] || []).map((r) => r._id);
    } else {
      const recipientRes = await apiSetRecipients(documentId, {
        signingOrder,
        deliveryMode,
        recipients: recipients.map((r, idx) => ({ userId: r.userId, email: r.email, name: r.name, order: idx + 1 })),
      });
      recipientIds = recipientRes.data.map((r) => r._id);
    }

    // A recipient may have been removed after fields were already placed for them —
    // drop those orphaned fields rather than send an invalid recipientId.
    const validFields = (separate ? fields.map((f) => ({ ...f, recipientIndex: 0 })) : fields).filter(
      (f) => f.recipientIndex < recipientIds.length
    );
    if (validFields.length !== fields.length) {
      setFieldsState(validFields);
      toast.warning("Removed fields that belonged to a recipient you took off the list");
    }

    await apiSetFields(documentId, {
      fields: validFields.map((f) => ({
        recipientId: recipientIds[f.recipientIndex],
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        type: f.type,
        required: f.required,
        fontSize: f.fontSize,
        color: f.color,
      })),
    });
    if (bundleId) refreshBundle(bundleId);
    return true;
  };

  // Opens another document of the group, saving this one first so nothing placed here is lost.
  const handleSwitchDocument = async (id: string) => {
    if (!onSwitchDocument || id === documentId) return;
    if (isDraft && isOwner && isDirty) {
      setIsSwitching(true);
      try {
        const ok = await persistRecipientsAndFields({ allowEmpty: true });
        if (!ok) return;
      } catch (err: any) {
        toast.error(err.message || "Couldn't save this document");
        return;
      } finally {
        setIsSwitching(false);
      }
    }
    onSwitchDocument(id);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const ok = await persistRecipientsAndFields();
      if (ok) {
        await loadDocument();
        toast.success("Draft saved");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      if (!recipients.length) {
        toast.error("Add at least one recipient");
        return;
      }
      if (!fields.length) {
        toast.error("Place at least one field");
        return;
      }
      if (separate && recipients.length > MAX_SEPARATE_COPIES) {
        toast.error(`Separate copies support up to ${MAX_SEPARATE_COPIES} people. Remove ${recipients.length - MAX_SEPARATE_COPIES} to send.`);
        return;
      }
      // In separate mode the layout is cloned for everyone, so nobody needs "their own" fields.
      const withoutFields = separate ? [] : recipients.filter((_, idx) => !fields.some((f) => f.recipientIndex === idx));
      if (withoutFields.length) {
        toast.error(
          `${withoutFields.map((r) => r.name || r.email).join(", ")} ${withoutFields.length === 1 ? "has" : "have"} no fields to fill. Place a field for each recipient, or remove them.`
        );
        return;
      }
      // Skip re-persisting recipients/fields if nothing changed since the last save —
      // e.g. clicking Save Draft then Send right after shouldn't redo the same two PUTs.
      if (isDirty) {
        const ok = await persistRecipientsAndFields();
        if (!ok) return;
      }
      if (bundleId) {
        // The whole group goes out together: every document is checked, then each person gets one email.
        try {
          const res = await sendDocumentBundle(bundleId);
          toast.success(`${res.data.documents.length} documents sent — each person gets one email for all of them`);
          onSent();
        } catch (err: any) {
          // The problem is on another document of the group: open it, so it can be fixed there.
          if (err.documentId && err.documentId !== documentId && onSwitchDocument) {
            toast.error(err.message);
            onSwitchDocument(err.documentId);
            return;
          }
          throw err;
        }
        return;
      }
      const sent = await apiSendDocument(documentId);
      await loadDocument();
      if (sent.job) {
        // Separate copies are built in the background: stay here so the progress panel is visible. Leaving is safe.
        toast.success(`Sending ${sent.job.total} separate cop${sent.job.total === 1 ? "y" : "ies"}. They are created in the background, so you can leave this page.`);
        return;
      }
      toast.success("Document sent for signing");
      onSent();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleVoid = async () => {
    setIsVoiding(true);
    try {
      await apiVoidDocument(documentId);
      setVoidOpen(false);
      await loadDocument();
      toast.success("Document voided");
    } catch (err: any) {
      toast.error(err.message || "Failed to void document");
    } finally {
      setIsVoiding(false);
    }
  };

  // Who a reminder can go to. Someone who already signed or declined never can; on a sequential document neither
  // can anyone whose turn it is not yet (they could not sign anyway) — only the person who is up now.
  const isActionable = (r: DsRecipient) => r.status === "pending" || r.status === "viewed";
  const currentSigner = signingOrder === "sequential" ? recipientRecords.find(isActionable) : undefined;
  const reminderBlockedReason = (r: DsRecipient): string | null => {
    if (r.status === "signed") return "Already signed";
    if (r.status === "declined") return "Declined";
    if (currentSigner && r._id !== currentSigner._id) return `Waiting for ${currentSigner.name || currentSigner.email} to sign first`;
    return null;
  };
  const remindable = recipientRecords.filter((r) => !reminderBlockedReason(r));

  const openReminder = () => {
    setReminderSelected(remindable.map((r) => r._id));
    setReminderOpen(true);
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const res = await apiResendDocument(documentId, reminderSelected);
      setReminderOpen(false);
      const names = (res.sent || []).map((s) => s.name || s.email);
      const who = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
      // Reminders are queued and go out in waves, so for a big group they arrive over a few minutes, not instantly.
      toast.success(
        res.queued
          ? `Reminder queued for ${who || "the selected people"}. Emails are sent in waves, so large groups can take a few minutes.`
          : names.length
            ? `Reminder sent to ${who}`
            : "Reminder sent"
      );
      // A partial failure is still worth saying out loud: the rest went out, these did not.
      if (res.failed?.length) {
        toast.warning(`Could not email ${res.failed.map((f) => f.name || f.email).join(", ")}: ${res.failed[0].error}`);
      }
      await loadDocument();
    } catch (err: any) {
      toast.error(err.message || "Failed to send the reminder");
    } finally {
      setIsResending(false);
    }
  };

  // A group sent together is reminded together: one email per person still to sign, covering every document.
  const handleBundleResend = async () => {
    if (!bundleId) return;
    setIsResending(true);
    try {
      const res = await resendDocumentBundle(bundleId);
      const who = res.sent.length > 3 ? `${res.sent.slice(0, 3).join(", ")} and ${res.sent.length - 3} more` : res.sent.join(", ");
      toast.success(`Reminder queued for ${who}`);
      await loadDocument();
    } catch (err: any) {
      toast.error(err.message || "Failed to send the reminder");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await apiVerifyDocument(documentId);
      setVerifyResult(res.data.valid);
      setVerifyDetails(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to verify document");
    } finally {
      setIsVerifying(false);
    }
  };

  // Re-reads just the audit trail (a download or export adds an entry) without resetting anything else on screen, such as
  // the result of "Verify integrity".
  const refreshAuditLog = async () => {
    try {
      const res = await getDocumentDetail(documentId);
      setAuditLog(res.data.auditLog);
      setAuditHasMore(res.data.auditHasMore);
    } catch {
      /* the trail will refresh on the next load */
    }
  };

  // "Load earlier activity": entries are newest-first, so the oldest one currently on screen is exactly
  // where the next page picks up.
  const loadMoreAuditLog = async () => {
    const oldest = auditLog[auditLog.length - 1];
    if (!oldest || isLoadingMoreAudit) return;
    setIsLoadingMoreAudit(true);
    try {
      const res = await getAuditLogPage(documentId, { createdAt: oldest.createdAt, id: oldest._id });
      setAuditLog((prev) => [...prev, ...res.data.entries]);
      setAuditHasMore(res.data.hasMore);
    } catch (err: any) {
      toast.error(err.message || "Failed to load earlier activity");
    } finally {
      setIsLoadingMoreAudit(false);
    }
  };

  const copyText = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  // Opens a document file THROUGH the app, so the download is recorded in the audit trail (opening the storage link
  // directly would leave no trace). The tab is opened first, synchronously, so browsers don't treat it as a blocked popup.
  const openFile = async (kind: "original" | "signed" | "certificate") => {
    const tab = window.open("about:blank", "_blank");
    try {
      const res = await getDocumentFileLink(documentId, kind);
      if (tab) tab.location.href = res.data.url;
      else window.location.assign(res.data.url);
      // The download was just recorded: show it in the trail.
      refreshAuditLog();
    } catch (err: any) {
      tab?.close();
      toast.error(err.message || "Could not open the file");
    }
  };

  const handleExportEvidence = async () => {
    setIsExporting(true);
    try {
      const { blob, filename, sha256 } = await downloadEvidencePackage(documentId);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      if (sha256) setPackageHash(sha256);
      toast.success("Evidence package downloaded");
      refreshAuditLog(); // shows the "exported" entry in the audit trail
    } catch (err: any) {
      toast.error(err.message || "Could not download the evidence package");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (isSavingTemplate) return;
    if (!fields.length) {
      toast.error("Place at least one field before saving a template");
      return;
    }
    setIsSavingTemplate(true);
    try {
      await apiCreateTemplate({
        title: `${title} Template`,
        originalFileUrl,
        // Only a fingerprint taken at upload describes this file for later documents made from the template.
        ...(originalFileHash && originalFileHashSource === "upload" ? { originalFileHash } : {}),
        pageCount: numPages,
        fields: fields.map((f) => ({
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          type: f.type,
          required: f.required,
          fontSize: f.fontSize,
          color: f.color,
          recipientSlot: f.recipientIndex + 1,
        })),
      });
      toast.success("Saved as template");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  const fieldCounts = recipients.map((_, idx) => fields.filter((f) => f.recipientIndex === idx).length);
  const fileUrl = flattenedFileUrl || originalFileUrl;
  // True once `status` can be trusted — either the caller seeded it or the detail call has
  // landed. Until then the isDraft-only field palette renders as a same-width skeleton
  // instead of guessing, so it can't pop in or out and shove the page column sideways.
  // In practice every in-app entry point seeds, so this is only false on an email deep link.
  const statusKnown = !isLoading || !!seed;

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {!statusKnown && (
        <div className="w-52 shrink-0 space-y-2 border-r border-[#2a2a35] p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-white/[0.04]" />
          ))}
        </div>
      )}
      {statusKnown && isDraft && (
        <div className="w-52 shrink-0 overflow-y-auto border-r border-[#2a2a35] p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/90">Fields</h3>
          <div className="space-y-4">
            {FIELD_GROUPS.map((group, gi) => (
              <div key={gi} className={gi > 0 ? "border-t border-[#2a2a35] pt-4" : ""}>
                <div className="space-y-1">
                  {group.fields.map((f) => (
                    <div
                      key={f.type}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("fieldType", f.type)}
                      className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/80 hover:bg-[#0c0c10] active:cursor-grabbing"
                    >
                      <f.icon className="h-4 w-4 shrink-0 text-white/45" />
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2a2a35] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {title ? (
                  <h2 className="truncate text-sm font-semibold text-white/90">{title}</h2>
                ) : (
                  <div className="h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
                )}
                {statusKnown && !isDraft && <StatusBadge status={status} />}
              </div>
              {envelopeId && (
                <p data-testid="envelope-id" className="mt-0.5 truncate text-xs text-[#7a7a90]">
                  Envelope ID: {envelopeId}
                </p>
              )}
            </div>
          </div>
          {/* Every mutating action stays disabled until the detail call lands: the seed carries
              only the title/status/URL, so recipients and fields are still empty here and
              saving or sending now would persist that emptiness over real data. */}
          {statusKnown && isDraft && isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={handleSaveDraft} disabled={isLoading || isSaving || isSending || isSavingTemplate}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save draft
              </Button>
              <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={handleSaveAsTemplate} disabled={isLoading || isSaving || isSending || isSavingTemplate}>
                {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as template"}
              </Button>
              <Button size="sm" className={BTN_PRIMARY} onClick={handleSend} disabled={isLoading || isSaving || isSending || isSavingTemplate || isSwitching}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                {bundleId && bundle ? `Send all ${bundle.size}` : "Send"}
              </Button>
            </div>
          )}
          {statusKnown && isDraft && !isOwner && (
            <span data-testid="draft-read-only" className="shrink-0 text-xs text-[#7a7a90]">
              Only the sender can edit or send this draft
            </span>
          )}
          {statusKnown && !isDraft && status !== "voided" && status !== "completed" && (
            <div className="flex gap-2">
              {(status === "sent" || status === "in_progress") && (
                <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={bundleId ? handleBundleResend : openReminder} disabled={isLoading || isResending}>
                  {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                  {bundleId ? "Remind everyone" : "Resend reminder"}
                </Button>
              )}
              <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={() => setVoidOpen(true)} disabled={isLoading || isVoiding}>
                {isVoiding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Void document"}
              </Button>
            </div>
          )}
        </div>

        {bundle && (
          <BundleBar
            documents={bundle.documents}
            currentId={documentId}
            currentReady={isDraft ? recipients.length > 0 && recipients.every((_, idx) => fields.some((f) => f.recipientIndex === idx)) : undefined}
            onSelect={handleSwitchDocument}
            busy={isSwitching || isSaving || isSending}
          />
        )}

        {statusKnown && isDraft && (
          <div className="flex items-center gap-2 border-b border-[#2a2a35] px-4 py-2">
            <span className="text-xs text-[#7a7a90]">{separate ? "Place the fields once" : "Placing fields for:"}</span>
            {separate && (
              <span className="text-xs text-white/70">
                Each of the {recipients.length || "selected"} recipient{recipients.length === 1 ? "" : "s"} gets their own copy with these fields
                {!fieldCounts[0] && <span className="ml-1 font-medium text-brand">· no fields yet</span>}
              </span>
            )}
            {!separate && recipients.map((r, idx) => (
              <button
                key={r.userId}
                onClick={() => setActiveRecipientIdx(idx)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
                style={{
                  borderColor: activeRecipientIdx === idx ? RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] : "#2a2a35",
                  color: activeRecipientIdx === idx ? "#fff" : "#8a8a9b",
                  backgroundColor: activeRecipientIdx === idx ? RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] + "33" : "transparent",
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }} />
                {r.name || r.email}
                <span
                  className={fieldCounts[idx] ? "text-white/45" : "font-medium text-brand"}
                  title={fieldCounts[idx] ? `${fieldCounts[idx]} field${fieldCounts[idx] === 1 ? "" : "s"}` : "No fields yet: this person has nothing to fill in"}
                >
                  · {fieldCounts[idx]}
                </span>
              </button>
            ))}
            {!recipients.length && <span className="text-xs text-[#7a7a90]">Add recipients on the right first</span>}
            <span className="ml-auto text-xs text-[#7a7a90]">Drag a field from the left onto the page</span>
          </div>
        )}

        {/* Light grey, not the app's near-black: while scrolling faster than Chrome can
            paint, the not-yet-painted area shows this background colour — grey reads as a
            page still loading, black read as the whole screen going blank. */}
        <div className="flex-1 overflow-auto bg-[#e4e4e7] p-6">
          {/* fileUrl is normally already known on the first render (seeded from the row the
              user clicked), so this mounts — and the S3 download starts — without waiting for
              getDocumentDetail. Only a seedless entry (email deep link) falls back to showing
              placeholders until the detail call supplies a URL; <Document file=""> would
              otherwise throw. */}
          {fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              // No onLoadError handler is needed to clear a spinner any more — react-pdf swaps
              // `loading` for `error` on its own. Left as the default so a broken PDF shows
              // react-pdf's failure message instead of placeholders that never resolve.
              loading={<PdfPagePlaceholders count={seededPageCount} width={PAGE_WIDTH} />}
            >
            <div className="mx-auto flex flex-col items-center gap-6">
              {pages.map((page) => (
                <div
                  key={page}
                  ref={(el) => {
                    pageRefs.current[page] = el;
                  }}
                  className="relative ring-1 ring-black/15"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnPage(e, page)}
                  // A click on empty page space (fields stop propagation) deselects.
                  onPointerDown={() => setSelectedFieldId(null)}
                >
                  <LazyPdfPage pageNumber={page} width={PAGE_WIDTH} onPageSize={onPageSize} />
                  {!flattenedFileUrl && fields
                    .filter((f) => f.page === page)
                    .map((f) => {
                      const accent = RECIPIENT_COLORS[f.recipientIndex % RECIPIENT_COLORS.length];
                      // The sender's size/colour, previewed on the label, the filled value and the fill input.
                      const textStyle: React.CSSProperties = fieldTextStyle(f, sizeOf(f.page).w, PAGE_WIDTH);
                      return (
                        <PlacedField
                          key={f.id}
                          box={{ x: f.x, y: f.y, width: f.width, height: f.height }}
                          accent={accent}
                          editable={isDraft}
                          selected={isDraft && selectedFieldId === f.id}
                          getPageRect={() => pageRefs.current[f.page]?.getBoundingClientRect() ?? null}
                          onSelect={() => setSelectedFieldId(f.id)}
                          onChange={(patch) => updateField(f.id, patch)}
                          onRemove={() => removeField(f.id)}
                        >
                          {isDraft ? (
                            // Always black while placing. This is the field-type name, not content, and
                            // drawing it in the recipient accent (or in a pale colour the sender picked,
                            // like white or yellow) made it hard to read against the page. The accent
                            // stays on the box outline, which is what tells whose field is whose.
                            // `color` comes after the spread so it also wins over the sender's own
                            // colour in textStyle; the size still previews their choice.
                            <span className="pointer-events-none truncate px-0.5" style={{ ...textStyle, color: "#000000" }}>
                              {/* Separate copies place ONE layout that every person gets, so it isn't "Aakash's" field:
                                  show just the field name. With a shared document, the owner's name tells fields apart. */}
                              {recipients.length > 1 && !separate ? `${shortRecipientName(recipients[f.recipientIndex])} · ${f.type}` : f.type}
                            </span>
                          ) : isImageFieldType(f.type) ? (
                            f.value ? (
                              <img src={f.value} alt={f.type} className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-black">awaiting</span>
                            )
                          ) : f.type === "checkbox" ? (
                            <span className="text-black">{f.checked ? "✓" : ""}</span>
                          ) : (
                            // Filled-in values render black unless the sender chose a colour,
                            // matching how the values will actually look once flattened into the
                            // final PDF — not the recipient's editing-time accent color.
                            <span className="truncate px-1 text-black" style={textStyle}>
                              {f.value || ""}
                            </span>
                          )}
                        </PlacedField>
                      );
                    })}
                </div>
              ))}
              </div>
            </Document>
          ) : (
            <PdfPagePlaceholders count={seededPageCount} width={PAGE_WIDTH} />
          )}
        </div>
      </div>

      <div className="w-72 shrink-0 overflow-y-auto border-l border-[#2a2a35] p-4">
        {isDraft ? (
          <>
            {selectedField && (
              <FieldStylePanel
                type={selectedField.type}
                typeLabel={FIELD_TYPES.find((t) => t.type === selectedField.type)?.label ?? selectedField.type}
                recipientName={separate ? undefined : recipients[selectedField.recipientIndex]?.name || recipients[selectedField.recipientIndex]?.email}
                recipientColor={separate ? undefined : RECIPIENT_COLORS[selectedField.recipientIndex % RECIPIENT_COLORS.length]}
                recipients={separate ? [] : recipients.map((r, i) => ({ label: r.name || r.email, color: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }))}
                assignedIndex={selectedField.recipientIndex}
                color={selectedField.color}
                fontSize={selectedField.fontSize}
                required={selectedField.required}
                onChange={(patch) => updateField(selectedField.id, patch)}
                onDelete={() => removeField(selectedField.id)}
              />
            )}
            <h3 className="mb-3 text-sm font-semibold text-white/90">Recipients</h3>
            <RecipientsPanel
              orgMembers={orgMembers}
              onLoadMembers={() => fetchOrgMembers()}
              recipients={recipients}
              onChange={applyRecipientsChange}
              signingOrder={signingOrder}
              onSigningOrderChange={(order) => {
                setSigningOrder(order);
                setIsDirty(true);
              }}
              deliveryMode={deliveryMode}
              onDeliveryModeChange={handleDeliveryModeChange}
              disabled={false}
              grouped={!!bundleId}
            />
          </>
        ) : (
          <div className="space-y-6">
            {status === "completed" && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-white/90">Certificate &amp; integrity</h3>

                {/* Hero: the certificate itself — the one thing everyone who lands here wants first. */}
                <div className="rounded-2xl border border-[#2a2a35] bg-[#111116] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
                      <ShieldCheck className="h-5 w-5 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white/90">Certificate of Completion</p>
                      <p className="mt-0.5 text-xs leading-snug text-[#8a8a9b]">
                        Every signer, timestamp and consent captured on this document, sealed once everyone signed.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {certificateFileUrl && (
                          <Button size="sm" className={BTN_PRIMARY} onClick={() => openFile("certificate")}>
                            <FileBadge className="mr-1.5 h-3.5 w-3.5" />
                            Download certificate
                          </Button>
                        )}
                        {flattenedFileUrl && (
                          <Button size="sm" variant="outline" className={BTN_SECONDARY} onClick={() => openFile("signed")}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Signed PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verify integrity */}
                <div className="mt-3 space-y-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90">Verify integrity</p>
                      <p className="text-xs leading-snug text-[#7a7a90]">Re-checks the signed file and audit trail against what was recorded at completion.</p>
                    </div>
                    <Button variant="outline" size="sm" className={`${BTN_SECONDARY} h-8 shrink-0`} onClick={handleVerify} disabled={isVerifying}>
                      {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check now"}
                    </Button>
                  </div>
                  {verifyResult !== null && (
                    <div className="space-y-1.5 border-t border-[#2a2a35] pt-2">
                      <Badge
                        className={
                          verifyResult
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-red-500/30 bg-red-500/15 text-red-400"
                        }
                      >
                        {verifyResult ? "Hash matches" : "Hash mismatch"}
                      </Badge>
                      <p className="text-xs text-[#8a8a9b]">
                        {verifyResult
                          ? "The signed file has not been altered since the document was completed."
                          : "This file may have been altered since completion."}
                      </p>
                      {verifyDetails?.auditTrail &&
                        (verifyDetails.auditTrail.checked ? (
                          <p className={`text-xs ${verifyDetails.auditTrail.intact ? "text-emerald-400" : "text-red-400"}`}>
                            {verifyDetails.auditTrail.intact
                              ? `Audit trail unchanged since completion (${verifyDetails.auditTrail.events} events).`
                              : "Audit trail differs from completion — an event was changed or removed."}
                          </p>
                        ) : (
                          <p className="text-xs text-[#7a7a90]">Audit trail check not available: this document was completed before it was recorded.</p>
                        ))}
                      {verifyDetails?.original?.hash && (
                        <p className={`text-xs ${verifyDetails.original.integrity === "mismatch" ? "text-red-400" : "text-[#7a7a90]"}`}>
                          {verifyDetails.original.integrity === "match"
                            ? "Original document was unchanged from the upload when the document was completed."
                            : verifyDetails.original.integrity === "mismatch"
                              ? "Original document did NOT match the uploaded file when the document was completed."
                              : "Original document was fingerprinted at completion only (no fingerprint from the upload)."}
                        </p>
                      )}
                    </div>
                  )}
                  {originalIntegrity === "mismatch" && (
                    <p className="border-t border-[#2a2a35] pt-2 text-xs text-red-400">
                      Warning: when the document was completed, the original file did not match the file that was uploaded.
                    </p>
                  )}
                </div>

                {/* Technical fingerprints — collapsed by default; most people never need these. */}
                <div className="mt-3 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
                  <button
                    type="button"
                    onClick={() => setShowFingerprints((v) => !v)}
                    className="flex w-full items-center gap-1.5 text-xs font-medium text-[#8a8a9b] hover:text-white/90"
                  >
                    {showFingerprints ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Technical fingerprints (SHA-256)
                  </button>
                  {showFingerprints && (
                    <div className="mt-2 space-y-2 border-t border-[#2a2a35] pt-2">
                      {flattenedFileHash && (
                        <div className="flex items-center gap-1.5 text-xs text-[#7a7a90]">
                          <span className="truncate font-mono" title={flattenedFileHash}>
                            Signed PDF: {flattenedFileHash.slice(0, 16)}…
                          </span>
                          <button onClick={() => copyText(flattenedFileHash, "Hash")} className="shrink-0 text-[#7a7a90] hover:text-white/90" aria-label="Copy signed PDF hash">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {originalFileHash && (
                        <div className="flex items-center gap-1.5 text-xs text-[#7a7a90]">
                          <span
                            className="truncate font-mono"
                            title={`${originalFileHash} — ${originalFileHashSource === "upload" ? "fingerprinted in the sender's browser at upload" : "fingerprinted by the server at completion (no fingerprint from upload)"}`}
                          >
                            Original: {originalFileHash.slice(0, 16)}…
                          </span>
                          <button onClick={() => copyText(originalFileHash, "Original hash")} className="shrink-0 text-[#7a7a90] hover:text-white/90" aria-label="Copy original hash">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {auditChainHash && (
                        <div className="flex items-center gap-1.5 text-xs text-[#7a7a90]">
                          <span className="truncate font-mono" title={auditChainHash}>
                            Audit trail ({auditChainEvents} events): {auditChainHash.slice(0, 16)}…
                          </span>
                          <button onClick={() => copyText(auditChainHash, "Audit trail hash")} className="shrink-0 text-[#7a7a90] hover:text-white/90" aria-label="Copy audit trail hash">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidence package */}
                <div className="mt-3 space-y-1.5 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 shrink-0 text-[#8a8a9b]" />
                    <p className="text-sm font-semibold text-white/90">Evidence package</p>
                  </div>
                  <p className="text-xs leading-snug text-[#7a7a90]">
                    One zip with the signed PDF, certificate, original, audit trail, signer details, consent wording and hashes.
                  </p>
                  <Button variant="outline" size="sm" className={`${BTN_SECONDARY} w-full`} onClick={handleExportEvidence} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Download evidence package"}
                  </Button>
                  {packageHash && (
                    <div className="flex items-center gap-1.5 text-xs text-[#7a7a90]">
                      <span className="truncate font-mono" title={packageHash}>
                        Package: {packageHash.slice(0, 16)}…
                      </span>
                      <button onClick={() => copyText(packageHash, "Package hash")} className="shrink-0 text-[#7a7a90] hover:text-white/90" aria-label="Copy package hash">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              {separate && (
                <CopiesProgressPanel
                  documentId={documentId}
                  fetchProgress={getCopiesProgress}
                  retryProgress={retryFailedCopies}
                />
              )}
              <h3 className="mb-3 text-sm font-semibold text-white/90">Recipients</h3>
              {separate && (
                <p className="mb-2 text-xs text-[#7a7a90]">
                  Separate copy: this document is signed and completed on its own. Everyone else you sent to has their own document.
                </p>
              )}
              <div className="space-y-2">
                {recipientRecords.map((r, idx) => (
                  <div key={r._id} className="flex items-center gap-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/90">{r.name || r.email}</p>
                      {r.status === "pending" || r.status === "viewed" ? (
                        r.inviteEmailStatus === "failed" ? (
                          <p className="truncate text-xs text-brand" title={r.inviteEmailError}>
                            Email not delivered. Use Resend reminder
                          </p>
                        ) : r.inviteEmailStatus === "pending" ? (
                          <p className="truncate text-xs text-[#7a7a90]">Email queued</p>
                        ) : null
                      ) : null}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white/90">Audit trail</h3>
              <AuditTrailView
                entries={auditLog}
                hasMore={auditHasMore}
                isLoadingMore={isLoadingMoreAudit}
                onLoadMore={loadMoreAuditLog}
              />
            </div>
          </div>
        )}
      </div>

      <Dialog open={reminderOpen} onOpenChange={(open) => !isResending && setReminderOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send a reminder</DialogTitle>
            <DialogDescription>
              {signingOrder === "sequential"
                ? "Signing is in order, so only the person whose turn it is can sign right now. Later recipients can be reminded once they are up."
                : "Choose who should get the reminder email."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2" data-testid="reminder-list">
            {recipientRecords.map((r, idx) => {
              const blocked = reminderBlockedReason(r);
              const checked = reminderSelected.includes(r._id);
              return (
                <label
                  key={r._id}
                  className={`flex items-center gap-3 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2.5 ${blocked ? "opacity-60" : "cursor-pointer"}`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!!blocked}
                    aria-label={`Remind ${r.name || r.email}`}
                    onCheckedChange={(v) =>
                      setReminderSelected((prev) => (v ? [...prev.filter((x) => x !== r._id), r._id] : prev.filter((x) => x !== r._id)))
                    }
                  />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white/90">{r.name || r.email}</span>
                    {r.name && <span className="block truncate text-xs text-[#7a7a90]">{r.email}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-[#7a7a90]">{blocked ?? "Not signed yet"}</span>
                </label>
              );
            })}
            {!remindable.length && (
              <p className="text-xs text-brand">Nobody can be reminded: everyone has already signed or declined.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setReminderOpen(false)} disabled={isResending}>
              Cancel
            </Button>
            <Button size="sm" className={BTN_PRIMARY} onClick={handleResend} disabled={isResending || !reminderSelected.length}>
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send reminder${reminderSelected.length ? ` (${reminderSelected.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={voidOpen} onOpenChange={(o) => !isVoiding && setVoidOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this document?</AlertDialogTitle>
            <AlertDialogDescription>Signers can no longer sign it. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isVoiding}
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={(e) => {
                // Keep the dialog open until the request finishes.
                e.preventDefault();
                handleVoid();
              }}
            >
              {isVoiding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Void document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
