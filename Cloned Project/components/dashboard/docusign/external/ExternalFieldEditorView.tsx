"use client";

import "@/lib/pdfWorkerSetup";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import { LazyPdfPage } from "@/components/dashboard/docusign/shared/LazyPdfPage";
import { PdfPagePlaceholders } from "@/components/dashboard/docusign/shared/PdfPagePlaceholders";
import type { DocumentSeed } from "@/components/dashboard/docusign/shared/documentSeed";
import { PlacedField } from "@/components/dashboard/docusign/shared/PlacedField";
import { FieldStylePanel } from "@/components/dashboard/docusign/shared/FieldStylePanel";
import { fieldTextStyle, signatureStyleKey, signatureStyleOf, usePageSizes, type SignatureStyle } from "@/components/dashboard/docusign/shared/fieldStyle";
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
  Type,
  PenLine,
  Signature,
  Stamp,
  CalendarDays,
  CheckSquare,
  Save,
  User,
  UserRound,
  UserSquare,
  Mail,
  Building2,
  Briefcase,
  UserCheck,
  Send,
  RefreshCw,
  ShieldCheck,
  FileBadge,
  Copy,
  Download,
  Archive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  ExternalRecipientsPanel,
  ExternalRecipientDraft,
} from "@/components/dashboard/docusign/external/ExternalRecipientsPanel";
import { RECIPIENT_COLORS, MAX_SEPARATE_COPIES } from "@/components/dashboard/docusign/shared/recipientConstants";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/dashboard/docusign/shared/editorTokens";
import { AuditTrailView } from "@/components/dashboard/docusign/shared/AuditTrailView";
import { SignatureCaptureModal } from "@/components/dashboard/docusign/shared/SignatureCaptureModal";
import { CopiesProgressPanel } from "@/components/dashboard/docusign/shared/CopiesProgressPanel";
import { DsAuditLogEntry, DsVerifyResult, DsTemplate, DsDeliveryMode } from "@/lib/docusign/types";
import { DsExternalField, DsExternalRecipient, getExternalDocumentDetail, getExternalAuditLogPage, setExternalRecipients as apiSetRecipients, setExternalFields as apiSetFields, voidExternalDocument as apiVoidDocument, fillOnBehalfExternalDocument as apiFillOnBehalf, sendExternalDocument as apiSendForSignature, resendExternalDocument as apiResendDocument, verifyExternalDocument as apiVerifyDocument, downloadExternalEvidencePackage, getExternalCopiesProgress, retryExternalFailedCopies, getExternalDocumentBundle, syncExternalBundleRecipients, sendExternalDocumentBundle, resendExternalDocumentBundle } from "@/lib/docusign/external-api";
import type { DsBundle } from "@/lib/docusign/types";
import { BundleBar } from "@/components/dashboard/docusign/shared/BundleBar";

const PAGE_WIDTH = 720;

interface FieldSpec {
  type: DsExternalField["type"];
  label: string;
  icon: any;
  w: number;
  h: number;
}

// Deliberately duplicated from FieldEditorView.tsx rather than shared — this flow is
// kept fully independent of the internal one (separate collections, separate routes),
// and the palette is small enough that duplicating it is simpler than coupling the two.
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

const isImageFieldType = (type: DsExternalField["type"]) => type === "signature" || type === "initials" || type === "stamp";

const FIELD_PLACEHOLDERS: Partial<Record<DsExternalField["type"], string>> = {
  date: "Date",
  text: "Text",
  name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email address",
  company: "Company",
  title: "Title",
};

interface FieldDraft {
  id: string;
  recipientIndex: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: DsExternalField["type"];
  required: boolean;
  // Optional per-field styling chosen by the sender. fontSize is in PDF points; colour is
  // "#rrggbb". Absent = drawn at DEFAULT_FONT_SIZE / black. Both follow the field through to
  // the signer's view and the flattened PDF.
  fontSize?: number;
  color?: string;
  value?: string;
  checked?: boolean;
}

interface ExternalFieldEditorViewProps {
  documentId: string;
  // A template's field layout, still keyed by abstract recipientSlot numbers (see
  // TemplatesList.tsx) — seeded onto the canvas once real recipients exist to map slots onto.
  initialTemplateFields?: DsTemplate["fields"];
  // What the caller already knew when it navigated here — lets the PDF download start on the
  // first render instead of behind the detail round-trip. See documentSeed.ts; mirrors
  // FieldEditorView.tsx.
  seed?: DocumentSeed;
  onBack: () => void;
  onSent: () => void;
  // For a document sent together with others (a group): open another document of the group in this editor.
  onSwitchDocument?: (documentId: string) => void;
}

export function ExternalFieldEditorView({ documentId, initialTemplateFields, seed, onBack, onSent, onSwitchDocument }: ExternalFieldEditorViewProps) {
  const [title, setTitle] = useState(seed?.title ?? "");
  const [numPages, setNumPages] = useState(0);
  // Placeholder page count only, for the pages pdf.js hasn't parsed yet.
  const [seededPageCount] = useState(seed?.pageCount ?? 0);
  const [recipients, setRecipients] = useState<ExternalRecipientDraft[]>([]);
  const [fields, setFieldsState] = useState<FieldDraft[]>([]);
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Seeded with `flattenedFileUrl || originalFileUrl` already resolved, so <Document> can
  // mount on the first render. loadDocument() then sets both properly.
  const [originalFileUrl, setOriginalFileUrl] = useState(seed?.fileUrl ?? "");
  const [flattenedFileUrl, setFlattenedFileUrl] = useState("");
  const [status, setStatus] = useState(seed?.status ?? "draft");
  const [recipientRecords, setRecipientRecords] = useState<DsExternalRecipient[]>([]);
  const [auditLog, setAuditLog] = useState<DsAuditLogEntry[]>([]);
  // Newest-first, one page at a time — see getExternalAuditLogPage. Mirrors FieldEditorView.
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [isLoadingMoreAudit, setIsLoadingMoreAudit] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [signingOrder, setSigningOrder] = useState<"sequential" | "parallel">("parallel");
  // "separate": Send creates one independent copy per recipient, all from the single field layout placed here
  // (kept on recipient #1, index 0). "shared": everyone signs the one document — mirrors FieldEditorView.tsx.
  const [deliveryMode, setDeliveryMode] = useState<DsDeliveryMode>(seed?.deliveryMode ?? "shared");
  const [isResending, setIsResending] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSelected, setReminderSelected] = useState<string[]>([]);
  // Fingerprints recorded at completion, and the certificate — only ever set once status === "completed".
  const [certificateFileUrl, setCertificateFileUrl] = useState("");
  const [flattenedFileHash, setFlattenedFileHash] = useState("");
  const [originalFileHash, setOriginalFileHash] = useState("");
  const [originalFileHashSource, setOriginalFileHashSource] = useState<"upload" | "completion" | "">("");
  const [originalIntegrity, setOriginalIntegrity] = useState<"match" | "mismatch" | "unverified" | "">("");
  const [auditChainHash, setAuditChainHash] = useState("");
  const [auditChainEvents, setAuditChainEvents] = useState(0);
  const [verifyDetails, setVerifyDetails] = useState<DsVerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [showFingerprints, setShowFingerprints] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [packageHash, setPackageHash] = useState("");
  // isLoading covers only the document/recipients/fields metadata fetch. The PDF download +
  // parse is handled by <Document loading={...}> below, scoped to the page column so the rest
  // of the editor stays visible — mirrors FieldEditorView.tsx.
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const { onPageSize, sizeOf } = usePageSizes();
  const hasFetchedDetailRef = useRef(false);
  // Set when this document was uploaded together with others (a group): the group's documents for the tabs above
  // the page, and its one shared recipient list. A group is always sent for signature (never filled in on behalf).
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<DsBundle<DsExternalRecipient> | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const refreshBundle = async (id: string) => {
    try {
      const res = await getExternalDocumentBundle(id);
      setBundle(res.data);
    } catch {
      /* the tabs just keep their last state */
    }
  };

  // The founder fills in every recipient's fields themselves, right here, in one pass —
  // no sign link is ever emailed. State below is keyed by recipientIndex/fieldId across
  // every recipient on the document, since the founder is filling in for all of them.
  const [isFillingForAll, setIsFillingForAll] = useState(false);
  const [isStartingFillForAll, setIsStartingFillForAll] = useState(false);
  const [isSendingForSignature, setIsSendingForSignature] = useState(false);
  const [isConfirmingFillForAll, setIsConfirmingFillForAll] = useState(false);
  const [fillConsentGiven, setFillConsentGiven] = useState(false);
  const [fillSignatureModalOpen, setFillSignatureModalOpen] = useState(false);
  // Which field the signature dialog is open for: whose signature it is, the key its result is stored under,
  // and the size/colour the sender chose for that field (if any).
  const [fillActiveCapture, setFillActiveCapture] = useState<{ recipientIdx: number; key: string; style?: SignatureStyle }>({
    recipientIdx: 0,
    key: "0",
  });
  // Keyed by recipient index when the sender set no style (one signature covers all of that recipient's image
  // fields, as before), or by recipient + type + style when a field asks for its own size/colour.
  const [fillSignatureImages, setFillSignatureImages] = useState<Record<string, { type: "draw" | "type" | "upload"; imageUrl: string }>>({});
  const [fillTextValues, setFillTextValues] = useState<Record<string, string>>({});
  const [fillCheckedValues, setFillCheckedValues] = useState<Record<string, boolean>>({});

  const loadDocument = async () => {
    try {
      const res = await getExternalDocumentDetail(documentId);
      setTitle(res.data.document.title);
      setOriginalFileUrl(res.data.document.originalFileUrl);
      setFlattenedFileUrl(res.data.document.flattenedFileUrl || "");
      setStatus(res.data.document.status);
      setSigningOrder(res.data.document.signingOrder || "parallel");
      setDeliveryMode(res.data.document.deliveryMode ?? "shared");
      setBundleId(res.data.document.bundleId || null);
      if (res.data.document.bundleId) refreshBundle(res.data.document.bundleId);
      setCertificateFileUrl(res.data.document.certificateFileUrl || "");
      setFlattenedFileHash(res.data.document.flattenedFileHash || "");
      setOriginalFileHash(res.data.document.originalFileHash || "");
      setOriginalFileHashSource(res.data.document.originalFileHashSource || "");
      setOriginalIntegrity(res.data.document.originalIntegrity || "");
      setAuditChainHash(res.data.document.auditChainHash || "");
      setAuditChainEvents(res.data.document.auditChainEvents || 0);
      const sortedRecipients = res.data.recipients.slice().sort((a, b) => a.order - b.order);
      setRecipientRecords(sortedRecipients);
      setAuditLog(res.data.auditLog);
      setAuditHasMore(!!res.data.auditHasMore);

      const loadedRecipients = sortedRecipients
        .map((r) => ({ email: r.email, name: r.name, order: r.order }));
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
      return res.data.document.status;
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
  // recipientSlot numbers onto — mirrors FieldEditorView.tsx's identical effect. Guarded to fire exactly
  // once, and only while the canvas is still empty, so it never overwrites fields already placed/edited.
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
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  const fieldCounts = recipients.map((_, idx) => fields.filter((f) => f.recipientIndex === idx).length);

  const fillCaptureKeyOf = (f: FieldDraft) => {
    const style = signatureStyleOf(f, sizeOf(f.page));
    return style ? `${f.recipientIndex}|${f.type}|${signatureStyleKey(style)}` : String(f.recipientIndex);
  };

  const fillAllRequiredFilled =
    fillConsentGiven &&
    fields
      .filter((f) => f.required)
      .every((f) => {
        if (isImageFieldType(f.type)) return !!fillSignatureImages[fillCaptureKeyOf(f)];
        if (f.type === "checkbox") return !!fillCheckedValues[f.id];
        return !!fillTextValues[f.id]?.trim();
      });

  const handleDropOnPage = (e: React.DragEvent<HTMLDivElement>, page: number) => {
    e.preventDefault();
    if (!isDraft) return;
    if (!recipients.length) {
      toast.error("Add a recipient before placing fields");
      return;
    }
    const fieldType = e.dataTransfer.getData("fieldType") as DsExternalField["type"];
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
        recipientIndex: activeRecipientIdx,
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
  };

  const removeField = (id: string) => {
    setFieldsState((prev) => prev.filter((f) => f.id !== id));
    setSelectedFieldId((cur) => (cur === id ? null : cur));
  };

  // Move / resize / restyle one placed field. A patch key set to `undefined` clears that property.
  const updateField = (id: string, patch: Partial<FieldDraft>) =>
    setFieldsState((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  // Reorder / remove recipients WITHOUT changing who owns which field: fields follow their person, and the
  // fields of a removed person are dropped (with a notice) instead of passing to whoever slides into their slot.
  const applyRecipientsChange = (next: ExternalRecipientDraft[]) => {
    // Separate copies: the one layout belongs to "the signer", not to a person, so adding/removing/reordering
    // people never moves or drops it.
    if (separate) {
      setRecipients(next);
      return;
    }
    const { fields: remapped, removed, indexMap, removedRecipients } = remapFieldOwners(recipients, next, fields, (r) => r.email.trim().toLowerCase());
    setRecipients(next);
    setFieldsState(remapped);
    setActiveRecipientIdx((cur) => {
      const moved = indexMap[cur];
      return moved !== undefined && moved >= 0 ? moved : 0;
    });
    if (removed.length) {
      const names = (removedRecipients as ExternalRecipientDraft[]).map((r) => r.name || r.email).join(", ");
      toast.warning(`Removed ${removed.length} field${removed.length === 1 ? "" : "s"} that belonged to ${names}`);
      setSelectedFieldId((cur) => (removed.some((f) => f.id === cur) ? null : cur));
    }
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
      // One list for every document of the group (see FieldEditorView.tsx) — people who stay keep their ids.
      const synced = await syncExternalBundleRecipients(
        bundleId,
        recipients.map((r) => ({ email: r.email, name: r.name }))
      );
      recipientIds = (synced.data.recipients[documentId] || []).map((r) => r._id);
    } else {
      const recipientRes = await apiSetRecipients(documentId, {
        deliveryMode,
        recipients: recipients.map((r, idx) => ({ email: r.email, name: r.name, order: idx + 1 })),
      });
      recipientIds = recipientRes.data.map((r) => r._id);
    }

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

  // Opens another document of the group, saving this draft first so nothing placed here is lost.
  const handleSwitchDocument = async (id: string) => {
    if (!onSwitchDocument || id === documentId) return;
    if (status === "draft") {
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

  // A group is reminded together: each person still to sign gets one email with a fresh link covering every document.
  const handleBundleResend = async () => {
    if (!bundleId) return;
    setIsResending(true);
    try {
      const res = await resendExternalDocumentBundle(bundleId);
      const who = res.sent.length > 3 ? `${res.sent.slice(0, 3).join(", ")} and ${res.sent.length - 3} more` : res.sent.join(", ");
      toast.success(`Reminder queued for ${who}`);
      await loadDocument();
    } catch (err: any) {
      toast.error(err.message || "Failed to send the reminder");
    } finally {
      setIsResending(false);
    }
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

  // Who a reminder can go to — mirrors FieldEditorView.tsx's reminderBlockedReason exactly.
  const isActionable = (r: DsExternalRecipient) => r.status === "pending" || r.status === "viewed";
  const currentSigner = signingOrder === "sequential" ? recipientRecords.find(isActionable) : undefined;
  const reminderBlockedReason = (r: DsExternalRecipient): string | null => {
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
      toast.success(
        res.queued
          ? `Reminder queued for ${who || "the selected people"}. Emails are sent in waves, so large groups can take a few minutes.`
          : names.length
            ? `Reminder sent to ${who}`
            : "Reminder sent"
      );
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

  // Re-reads just the audit trail (a download/verify adds an entry) without resetting the verify result on screen.
  const refreshAuditLog = async () => {
    try {
      const res = await getExternalDocumentDetail(documentId);
      setAuditLog(res.data.auditLog);
      setAuditHasMore(!!res.data.auditHasMore);
    } catch {
      /* the trail will refresh on the next load */
    }
  };

  // "Load earlier activity": entries are newest-first, so the oldest one currently on screen is
  // exactly where the next page picks up. Mirrors FieldEditorView's loadMoreAuditLog.
  const loadMoreAuditLog = async () => {
    const oldest = auditLog[auditLog.length - 1];
    if (!oldest || isLoadingMoreAudit) return;
    setIsLoadingMoreAudit(true);
    try {
      const res = await getExternalAuditLogPage(documentId, { createdAt: oldest.createdAt, id: oldest._id });
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

  const handleExportEvidence = async () => {
    setIsExporting(true);
    try {
      const { blob, filename, sha256 } = await downloadExternalEvidencePackage(documentId);
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
      refreshAuditLog();
    } catch (err: any) {
      toast.error(err.message || "Could not download the evidence package");
    } finally {
      setIsExporting(false);
    }
  };

  // Invites every recipient to sign themselves via a public, no-login link — an alternative to
  // Fill & complete, not a replacement for it. Same "save first" reasoning as fill-on-behalf: the
  // backend needs real, persisted field/recipient ids before it can send.
  const handleSendForSigning = async () => {
    setIsSendingForSignature(true);
    try {
      if (separate && recipients.length > MAX_SEPARATE_COPIES) {
        toast.error(`Separate copies support up to ${MAX_SEPARATE_COPIES} people. Remove ${recipients.length - MAX_SEPARATE_COPIES} to send.`);
        return;
      }
      const ok = await persistRecipientsAndFields();
      if (!ok) return;
      if (bundleId) {
        // The whole group goes out together: every document is checked, then each person gets one email with one link.
        try {
          const res = await sendExternalDocumentBundle(bundleId);
          toast.success(`${res.data.documents.length} documents sent — each recipient gets one email with a link to sign them all`);
          onSent();
        } catch (err: any) {
          if (err.documentId && err.documentId !== documentId && onSwitchDocument) {
            toast.error(err.message);
            onSwitchDocument(err.documentId);
            return;
          }
          throw err;
        }
        return;
      }
      const sent = await apiSendForSignature(documentId);
      await loadDocument();
      if (sent.job) {
        // Separate copies are built in the background: stay here so the progress panel is visible. Leaving is safe.
        toast.success(`Sending ${sent.job.total} separate cop${sent.job.total === 1 ? "y" : "ies"}. They are created in the background, so you can leave this page.`);
        return;
      }
      toast.success("Sent — recipients will get an email with a link to sign");
      onSent();
    } catch (err: any) {
      toast.error(err.message || "Failed to send for signature");
    } finally {
      setIsSendingForSignature(false);
    }
  };

  // Fields need real, saved _ids before fill-on-behalf can reference them — save (and
  // reload, so the canvas gets the persisted ids) before entering fill mode.
  const handleStartFillForAll = async () => {
    setIsStartingFillForAll(true);
    try {
      const ok = await persistRecipientsAndFields();
      if (!ok) return;
      await loadDocument();
      setFillTextValues({});
      setFillCheckedValues({});
      setFillSignatureImages({});
      setFillConsentGiven(false);
      setIsFillingForAll(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save before filling");
    } finally {
      setIsStartingFillForAll(false);
    }
  };

  const handleConfirmFillForAll = async () => {
    if (!fillConsentGiven) {
      toast.error("You must consent to sign electronically first");
      return;
    }
    if (!fillAllRequiredFilled) {
      toast.error("Complete every required field first");
      return;
    }
    setIsConfirmingFillForAll(true);
    try {
      const fieldsPayload = fields.map((f) => ({
        fieldId: f.id,
        value: isImageFieldType(f.type)
          ? fillSignatureImages[fillCaptureKeyOf(f)]?.imageUrl
          : f.type === "checkbox"
            ? undefined
            : fillTextValues[f.id],
        checked: f.type === "checkbox" ? !!fillCheckedValues[f.id] : undefined,
      }));

      const signaturesByRecipient: Record<string, { signatureType: "draw" | "type" | "upload"; signatureImageUrl: string }> = {};
      recipientRecords.forEach((r, idx) => {
        // The certificate records one primary signature per recipient: the shared one, else any styled one.
        const sig =
          fillSignatureImages[String(idx)] ??
          Object.entries(fillSignatureImages).find(([key]) => key.startsWith(`${idx}|`))?.[1];
        if (sig) signaturesByRecipient[r._id] = { signatureType: sig.type, signatureImageUrl: sig.imageUrl };
      });

      await apiFillOnBehalf(documentId, { fields: fieldsPayload, signaturesByRecipient });
      toast.success("Filled and completed — everyone gets a copy by email");
      setIsFillingForAll(false);
      await loadDocument();
      onSent();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete");
      // The entries may already be saved with only the signed file still to be made (the server retries that), so
      // show the document as it now is. Still a draft (e.g. a validation error): stay in fill mode, entries kept.
      const nowStatus = await loadDocument();
      if (nowStatus && nowStatus !== "draft") setIsFillingForAll(false);
    } finally {
      setIsConfirmingFillForAll(false);
    }
  };

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);
  const fileUrl = flattenedFileUrl || originalFileUrl;
  // True once `status` can be trusted — seeded by the caller, or the detail call has landed.
  // Until then the isDraft-only palette renders as a same-width skeleton rather than guessing.
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
      {statusKnown && isDraft && !isFillingForAll && (
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {title ? (
              <h2 className="text-sm font-semibold text-white/90">{title}</h2>
            ) : (
              <div className="h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
            )}
            {statusKnown && !isDraft && <StatusBadge status={status} />}
          </div>
          {/* Every mutating action stays disabled until the detail call lands: the seed carries
              only the title/status/URL, so recipients and fields are still empty here and
              saving or sending now would persist that emptiness over real data. */}
          {statusKnown && isDraft && !isFillingForAll && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={handleSaveDraft} disabled={isLoading || isSaving || isStartingFillForAll || isSendingForSignature}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save draft
              </Button>
              {/* A group is only ever sent for signature — filling in on someone's behalf stays single-document. */}
              {!bundleId && (
                <Button size="sm" className={BTN_PRIMARY} onClick={handleStartFillForAll} disabled={isLoading || isSaving || isStartingFillForAll || isSendingForSignature}>
                  {isStartingFillForAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="mr-1.5 h-4 w-4" />}
                  Fill &amp; complete
                </Button>
              )}
              <Button
                variant={bundleId ? "default" : "outline"}
                size="sm"
                className={bundleId ? BTN_PRIMARY : BTN_SECONDARY}
                onClick={handleSendForSigning}
                disabled={isLoading || isSaving || isStartingFillForAll || isSendingForSignature || isSwitching}
              >
                {isSendingForSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                {bundleId && bundle ? `Send all ${bundle.size} for signing` : "Send for signing"}
              </Button>
              <Button variant="outline" size="sm" className={BTN_SECONDARY} onClick={() => setVoidOpen(true)} disabled={isLoading || isVoiding}>
                {isVoiding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Void document"}
              </Button>
            </div>
          )}
          {isFillingForAll && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsFillingForAll(false)} disabled={isConfirmingFillForAll}>
                Cancel
              </Button>
              <Button size="sm" className={BTN_PRIMARY} onClick={handleConfirmFillForAll} disabled={isConfirmingFillForAll || !fillAllRequiredFilled}>
                {isConfirmingFillForAll ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & complete"}
              </Button>
            </div>
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

        {bundle && !isFillingForAll && (
          <BundleBar
            documents={bundle.documents}
            currentId={documentId}
            currentReady={isDraft ? recipients.length > 0 && recipients.every((_, idx) => fields.some((f) => f.recipientIndex === idx)) : undefined}
            onSelect={handleSwitchDocument}
            busy={isSwitching || isSaving || isSendingForSignature}
          />
        )}

        {statusKnown && isDraft && !isFillingForAll && (
          <div className="flex items-center gap-2 border-b border-[#2a2a35] px-4 py-2">
            <span className="text-xs text-[#7a7a90]">Placing fields for:</span>
            {recipients.map((r, idx) => (
              <button
                key={r.email}
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
            {!recipients.length && <span className="text-xs text-[#7a7a90]">Add a recipient's email on the right first</span>}
            <span className="ml-auto text-xs text-[#7a7a90]">Drag a field from the left onto the page</span>
          </div>
        )}

        {isFillingForAll && (
          <label className="flex items-start gap-2 border-b border-[#2a2a35] bg-[#0c0c10] px-4 py-3 text-xs text-[#8a8a9b]">
            <Checkbox checked={fillConsentGiven} onCheckedChange={(v) => setFillConsentGiven(!!v)} className="mt-0.5" />
            I am filling in and signing this document on behalf of every recipient listed, with their authorization,
            and consent to conduct this transaction electronically (ESIGN/UETA).
          </label>
        )}

        {/* Light grey, not the app's near-black: while scrolling faster than Chrome can
            paint, the not-yet-painted area shows this background colour — grey reads as a
            page still loading, black read as the whole screen going blank. */}
        <div className="flex-1 overflow-auto bg-[#e4e4e7] p-6">
          {/* fileUrl is normally already known on the first render (seeded from the row the
              user clicked), so the S3 download starts without waiting for the detail call.
              Only a seedless entry falls back to placeholders until a URL arrives —
              <Document file=""> would otherwise throw. */}
          {fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
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
                      const style = {
                        left: `${f.x * 100}%`,
                        top: `${f.y * 100}%`,
                        width: `${f.width * 100}%`,
                        height: `${f.height * 100}%`,
                      };
                      const accent = RECIPIENT_COLORS[f.recipientIndex % RECIPIENT_COLORS.length];
                      // The sender's size/colour, previewed on the label, the filled value and the fill input.
                      const textStyle: React.CSSProperties = fieldTextStyle(f, sizeOf(f.page).w, PAGE_WIDTH);

                      // Fill-on-behalf mode — every field on the document is fillable,
                      // regardless of which recipient it belongs to (the founder is
                      // filling in for all of them). One captured signature per
                      // recipient covers every signature/initials/stamp field of theirs.
                      if (isFillingForAll) {
                        const recipientColor = RECIPIENT_COLORS[f.recipientIndex % RECIPIENT_COLORS.length];
                        if (isImageFieldType(f.type)) {
                          const captureKey = fillCaptureKeyOf(f);
                          const captured = fillSignatureImages[captureKey];
                          return (
                            <button
                              key={f.id}
                              onClick={() => {
                                setFillActiveCapture({ recipientIdx: f.recipientIndex, key: captureKey, style: signatureStyleOf(f, sizeOf(f.page)) });
                                setFillSignatureModalOpen(true);
                              }}
                              className="absolute flex items-center justify-center gap-1 rounded border-2 bg-white/5 text-[10px] hover:bg-white/10"
                              style={{ ...style, borderColor: recipientColor, color: recipientColor }}
                            >
                              {captured ? (
                                <img src={captured.imageUrl} alt={f.type} className="h-full w-full object-contain" />
                              ) : (
                                <>
                                  <PenLine className="h-3 w-3" /> {recipients[f.recipientIndex]?.name || recipients[f.recipientIndex]?.email}
                                </>
                              )}
                            </button>
                          );
                        }
                        if (f.type === "checkbox") {
                          return (
                            <div key={f.id} className="absolute flex items-center justify-center" style={style}>
                              <Checkbox
                                checked={!!fillCheckedValues[f.id]}
                                onCheckedChange={(v) => setFillCheckedValues((prev) => ({ ...prev, [f.id]: !!v }))}
                              />
                            </div>
                          );
                        }
                        return (
                          <input
                            key={f.id}
                            value={fillTextValues[f.id] || ""}
                            onChange={(e) => setFillTextValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                            placeholder={FIELD_PLACEHOLDERS[f.type] || "Text"}
                            className="absolute rounded border-2 bg-white/5 px-1 text-[11px] text-black outline-none"
                            style={{ ...style, borderColor: recipientColor, ...textStyle }}
                          />
                        );
                      }

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
                              {recipients.length > 1 ? `${shortRecipientName(recipients[f.recipientIndex])} · ${f.type}` : f.type}
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
                            // matching how they'll actually look once flattened into the final
                            // PDF — not the recipient's editing-time accent color.
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

      {!isFillingForAll && (
        <div className="w-72 shrink-0 overflow-y-auto border-l border-[#2a2a35] p-4">
          {isDraft ? (
            <>
              {selectedField && (
                <FieldStylePanel
                  type={selectedField.type}
                  typeLabel={FIELD_TYPES.find((t) => t.type === selectedField.type)?.label ?? selectedField.type}
                  recipientName={recipients[selectedField.recipientIndex]?.name || recipients[selectedField.recipientIndex]?.email}
                  recipientColor={RECIPIENT_COLORS[selectedField.recipientIndex % RECIPIENT_COLORS.length]}
                  recipients={recipients.map((r, i) => ({ label: r.name || r.email, color: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }))}
                  assignedIndex={selectedField.recipientIndex}
                  color={selectedField.color}
                  fontSize={selectedField.fontSize}
                  required={selectedField.required}
                  onChange={(patch) => updateField(selectedField.id, patch)}
                  onDelete={() => removeField(selectedField.id)}
                />
              )}
              <p className="mb-4 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2 text-xs text-[#c4c4d4]">
                {bundleId
                  ? "Add the people below once — they're on every document of this group. Place each person's fields on every tab, then send them all together."
                  : "Add whoever it's for below and place their fields. Then either use \"Fill & complete\" to fill and sign for everyone yourself, or \"Send for signing\" to email each person a link."}
              </p>
              <h3 className="mb-3 text-sm font-semibold text-white/90">Recipients</h3>
              <ExternalRecipientsPanel
                recipients={recipients}
                onChange={applyRecipientsChange}
                disabled={false}
                deliveryMode={bundleId ? undefined : deliveryMode}
                onDeliveryModeChange={bundleId ? undefined : handleDeliveryModeChange}
                grouped={!!bundleId}
              />
            </>
          ) : (
            <div className="space-y-6">
              {status === "completed" && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-white/90">Certificate &amp; integrity</h3>

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
                            <Button size="sm" className={BTN_PRIMARY} asChild>
                              <a href={certificateFileUrl} target="_blank" rel="noopener noreferrer">
                                <FileBadge className="mr-1.5 h-3.5 w-3.5" />
                                Download certificate
                              </a>
                            </Button>
                          )}
                          {flattenedFileUrl && (
                            <Button size="sm" variant="outline" className={BTN_SECONDARY} asChild>
                              <a href={flattenedFileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Signed PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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
                  <CopiesProgressPanel documentId={documentId} fetchProgress={getExternalCopiesProgress} retryProgress={retryExternalFailedCopies} />
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
      )}

      <SignatureCaptureModal
        open={fillSignatureModalOpen}
        title={`Signature for ${recipients[fillActiveCapture.recipientIdx]?.name || recipients[fillActiveCapture.recipientIdx]?.email || "recipient"}`}
        style={fillActiveCapture.style}
        onClose={() => setFillSignatureModalOpen(false)}
        onCaptured={(result) => setFillSignatureImages((prev) => ({ ...prev, [fillActiveCapture.key]: result }))}
      />

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
