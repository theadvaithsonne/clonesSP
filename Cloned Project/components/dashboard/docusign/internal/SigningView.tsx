"use client";

import "@/lib/pdfWorkerSetup";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import { LazyPdfPage } from "@/components/dashboard/docusign/shared/LazyPdfPage";
import { fieldTextStyle, signatureStyleKey, signatureStyleOf, usePageSizes, type SignatureStyle } from "@/components/dashboard/docusign/shared/fieldStyle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileEdit, Loader2, PenLine, ShieldCheck, XCircle } from "lucide-react";
import { SignatureCaptureModal } from "@/components/dashboard/docusign/shared/SignatureCaptureModal";
import { DeclineDialog } from "@/components/dashboard/docusign/shared/DeclineDialog";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { useUser } from "@/store/authStore";
import { DsField, type DsBundleStepper } from "@/lib/docusign/types";
import { BundleSteps, isStepOpen, nextOpenStep } from "@/components/dashboard/docusign/shared/BundleSteps";
import { DsDocument, viewDocumentAsRecipient, requestEmailVerification as apiRequestEmailVerification, confirmEmailVerification as apiConfirmEmailVerification, signDocument as apiSignDocument, declineDocument as apiDeclineDocument } from "@/lib/docusign/internal-api";

const PAGE_WIDTH = 720;

// signature/initials/stamp are captured as an image via SignatureCaptureModal; every
// other field type (including the recipient-info autofill fields) is a plain text input.
const isImageFieldType = (type: DsField["type"]) => type === "signature" || type === "initials" || type === "stamp";

const FIELD_PLACEHOLDERS: Partial<Record<DsField["type"], string>> = {
  date: "Date",
  text: "Text",
  name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email address",
  company: "Company",
  title: "Title",
};

interface SigningViewProps {
  documentId: string;
  onBack: () => void;
  onDone: () => void;
  // Opens the same document in the sender's editor instead. Used when the backend says the caller
  // isn't a recipient (403) — an owner/admin following a "Review & Sign" email link. Only passed for
  // people who can manage documents; without it the 403 is shown as an error like any other.
  onOpenEditor?: (documentId: string) => void;
  // For a document sent together with others (a group): open another document of the group — used to go on to
  // the next one once this is signed.
  onOpenDocument?: (documentId: string) => void;
}

// v1 of the consent wording (utils/consentText.util.js on the backend). Only used when the backend doesn't send the text.
const FALLBACK_CONSENT_TEXT =
  "I agree to sign this document electronically and consent to conduct this transaction electronically, in accordance with applicable e-signature law (ESIGN/UETA).";

export function SigningView({ documentId, onBack, onDone, onOpenEditor, onOpenDocument }: SigningViewProps) {
  // The group this document was sent in, if any (the stepper above the page).
  const [bundle, setBundle] = useState<DsBundleStepper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DsDocument | null>(null);
  const [myFields, setMyFields] = useState<DsField[]>([]);
  // The consent wording + version come from the server (so what is shown is what gets recorded). The fallback is the
  // published v1 text, for an older backend that doesn't send it.
  const [consent, setConsent] = useState<{ version: string; text: string }>({ version: "v1", text: FALLBACK_CONSENT_TEXT });
  const [allFields, setAllFields] = useState<DsField[]>([]);
  const [canSign, setCanSign] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  // Signature, initials, and stamp are captured separately — a recipient's initials/stamp
  // are legitimately a different image than their full signature, not the same asset
  // reused everywhere.
  // Which field the signature dialog is open for: its type, the key its result is stored under, and the
  // size/colour the sender chose for it (if any).
  const [activeCapture, setActiveCapture] = useState<{ type: "signature" | "initials" | "stamp"; key: string; style?: SignatureStyle }>({
    type: "signature",
    key: "signature",
  });
  // Keyed by "signature" / "initials" / "stamp" when the sender set no style (one image shared by every field
  // of that type, as before), or by type + style when a field asks for its own size/colour.
  const [signatureImages, setSignatureImages] = useState<Record<string, { type: "draw" | "type" | "upload"; imageUrl: string }>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [checkedValues, setCheckedValues] = useState<Record<string, boolean>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  // Email-OTP gate — backend requires this to have happened before signDocument
  // succeeds; tracked here too so the Sign & Submit button reflects that up front
  // instead of only surfacing it as a failed-submit toast.
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const user = useUser();
  const { onPageSize, sizeOf } = usePageSizes();
  const captureKeyOf = (f: DsField) => {
    const style = signatureStyleOf(f, sizeOf(f.page));
    return style ? `${f.type}|${signatureStyleKey(style)}` : f.type;
  };
  // Who this signer is waiting for on a sequential document (name only), from the server.
  const [waitingFor, setWaitingFor] = useState<{ name: string | null; position: number; total: number } | null>(null);
  // This signer's own status: once they have signed (or declined) they can no longer decline.
  const [myStatus, setMyStatus] = useState<"pending" | "viewed" | "signed" | "declined" | undefined>(undefined);
  const hasActed = myStatus === "signed" || myStatus === "declined";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // The field the guide last jumped to; it pulses until it is filled in.
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await viewDocumentAsRecipient(documentId);
      setDoc(res.data.document);
      setMyFields(res.data.myFields);
      setAllFields(res.data.allFields);
      // Someone who has already signed can't edit or sign again, even on a parallel document.
      setCanSign(res.data.canSign && res.data.myStatus !== "signed");
      setWaitingFor(res.data.waitingFor ?? null);
      setMyStatus(res.data.myStatus);
      if (res.data.consent) setConsent(res.data.consent);
      setBundle(res.data.bundle ?? null);
      // Verified once already — for this document, or for another one of the same group.
      if (res.data.myEmailVerified) setEmailVerified(true);

      // Recipient-info fields are pre-filled from the signed-in user's profile as a
      // starting point — still editable, since the account name/email may not match
      // exactly what the document expects (e.g. a nickname vs. legal name).
      const [firstName = "", ...rest] = (user?.name || "").trim().split(/\s+/).filter(Boolean);
      const lastName = rest.join(" ");
      const defaults: Record<string, string> = {};
      res.data.myFields.forEach((f) => {
        if (f.type === "date") defaults[f._id] = new Date().toLocaleDateString();
        else if (f.type === "name" && user?.name) defaults[f._id] = user.name;
        else if (f.type === "first_name" && firstName) defaults[f._id] = firstName;
        else if (f.type === "last_name" && lastName) defaults[f._id] = lastName;
        else if (f.type === "email" && user?.email) defaults[f._id] = user.email;
      });
      setTextValues(defaults);
    } catch (err: any) {
      // Not a recipient, but allowed to open it as its sender/admin: go there instead of a dead end.
      if (err?.status === 403 && onOpenEditor) {
        onOpenEditor(documentId);
        return;
      }
      setLoadError(err.message || "Failed to load document");
    } finally {
      setIsLoading(false);
    }
  };

  // next.config.ts has reactStrictMode on, which double-invokes effects in dev —
  // without this guard `load` (and the "viewed" audit entry it triggers) fires twice.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const myFieldIds = useMemo(() => new Set(myFields.map((f) => f._id)), [myFields]);

  const isFilled = (f: DsField) => {
    if (isImageFieldType(f.type)) return !!signatureImages[captureKeyOf(f)];
    if (f.type === "checkbox") return !!checkedValues[f._id];
    return !!textValues[f._id]?.trim();
  };

  // The signer's own fields in reading order (page, then top to bottom, then left to right), which is
  // the order Start / Next walk through. Optional fields are skipped, as DocuSign does by default.
  const orderedMine = useMemo(() => [...myFields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [myFields]);
  const requiredMine = orderedMine.filter((f) => f.required);
  const remaining = requiredMine.filter((f) => !isFilled(f));

  const allRequiredFilled = consentGiven && emailVerified && remaining.length === 0;

  // Why Sign & Submit is not available yet, in plain words.
  const blockers = [
    !consentGiven && "agree to sign electronically",
    !emailVerified && "verify your email",
    remaining.length > 0 && `complete ${remaining.length} required field${remaining.length === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  // Scrolls a field into view (from its page's box + its y, so it works even for a page that has not
  // rendered yet), pulses it, and focuses it once the smooth scroll has landed.
  const scrollToField = (f: DsField) => {
    const scroller = scrollerRef.current;
    const pageEl = pageRefs.current[f.page];
    if (!scroller || !pageEl) return;
    const s = scroller.getBoundingClientRect();
    const p = pageEl.getBoundingClientRect();
    const fieldTop = p.top + f.y * p.height;
    scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + (fieldTop - s.top) - s.height / 3), behavior: "smooth" });
    setActiveFieldId(f._id);
    window.setTimeout(() => {
      const el = scroller.querySelector<HTMLElement>(`[data-field-id="${f._id}"]`);
      const target = el && (el.matches("input,button") ? el : el.querySelector<HTMLElement>("button,input"));
      target?.focus({ preventScroll: true });
    }, 450);
  };

  // Start (first empty required field) and Next (the one after the current, wrapping round).
  const goToNext = () => {
    if (!remaining.length) return;
    const currentIdx = activeFieldId ? orderedMine.findIndex((f) => f._id === activeFieldId) : -1;
    scrollToField(remaining.find((f) => orderedMine.indexOf(f) > currentIdx) ?? remaining[0]);
  };

  const handleRequestCode = async () => {
    setIsSendingCode(true);
    try {
      await apiRequestEmailVerification(documentId);
      setOtpSent(true);
      toast.success("Verification code sent to your email");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification code");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!otpCode.trim()) {
      toast.error("Enter the code from your email");
      return;
    }
    setIsVerifyingCode(true);
    try {
      await apiConfirmEmailVerification(documentId, otpCode.trim());
      setEmailVerified(true);
      toast.success("Email verified");
    } catch (err: any) {
      toast.error(err.message || "Incorrect or expired code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // After signing/declining: in a group, go straight on to the next document still waiting on this signer (a
  // decline only cancels this one); otherwise, or when none is left, back to the list.
  const goOnInGroup = (what: "Signed" | "Declined") => {
    const next = nextOpenStep(bundle, documentId);
    if (next && onOpenDocument) {
      const left = bundle ? bundle.documents.filter((d) => isStepOpen(d) && String(d._id) !== String(documentId)).length : 0;
      toast.success(`${what} — ${left} more document${left === 1 ? "" : "s"} to go. Opening the next one.`);
      onOpenDocument(String(next._id));
      return;
    }
    toast.success(bundle ? (what === "Signed" ? "All done — every document in this group is taken care of" : "Document declined") : what === "Signed" ? "Signed successfully" : "Document declined");
    onDone();
  };

  const handleSubmit = async () => {
    if (!consentGiven) {
      toast.error("You must consent to sign electronically first");
      return;
    }
    if (!emailVerified) {
      toast.error("Verify your email first");
      return;
    }
    if (!allRequiredFilled) {
      toast.error("Complete all required fields first");
      return;
    }
    setIsSubmitting(true);
    try {
      const fieldsPayload = myFields.map((f) => ({
        fieldId: f._id,
        value: isImageFieldType(f.type)
          ? signatureImages[captureKeyOf(f)]?.imageUrl
          : f.type === "checkbox"
            ? undefined
            : textValues[f._id],
        checked: f.type === "checkbox" ? !!checkedValues[f._id] : undefined,
      }));

      // ds_recipient.signatureImageUrl/signatureType record the recipient's primary
      // signing method for the certificate — prefer their full signature, falling
      // back to initials, then a stamp, if that's all this document required of them.
      const primary = (["signature", "initials", "stamp"] as const)
        .map((t) => myFields.filter((f) => f.type === t).map((f) => signatureImages[captureKeyOf(f)]).find(Boolean))
        .find(Boolean);

      await apiSignDocument(documentId, {
        fields: fieldsPayload,
        signatureType: primary?.type || "type",
        signatureImageUrl: primary?.imageUrl || "",
        consentGiven: true,
        consentTextVersion: consent.version,
      });
      goOnInGroup("Signed");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (reason?: string) => {
    if (hasActed) return;
    setIsDeclining(true);
    try {
      await apiDeclineDocument(documentId, reason);
      setDeclineOpen(false);
      goOnInGroup("Declined");
    } catch (err: any) {
      toast.error(err.message || "Failed to decline");
    } finally {
      setIsDeclining(false);
    }
  };

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  // Shown in place of the signing UI when there is nothing to sign: the load failed, or the
  // document is still a draft.
  const renderNotice = (icon: React.ReactNode, heading: string, message: string, onRetry?: () => void) => (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
      {icon}
      <h2 className="text-sm font-semibold text-white/90">{heading}</h2>
      <p className="max-w-sm text-xs text-[#7a7a90]">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
      </div>
    );
  }

  if (loadError || !doc) {
    return renderNotice(
      <AlertTriangle className="h-8 w-8 text-amber-400" />,
      "Couldn't open this document",
      loadError || "Failed to load document",
      () => load()
    );
  }

  if (doc.status === "draft") {
    return renderNotice(
      <FileEdit className="h-8 w-8 text-[#7a7a90]" />,
      doc.title,
      "This document hasn't been sent for signing yet."
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1e1e2e] px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold text-white/90">{doc.title}</h2>
          <StatusBadge status={doc.status} />
          {doc.envelopeId && <span className="text-xs text-[#7a7a90]">Envelope ID: {doc.envelopeId}</span>}
        </div>
        {doc.status !== "completed" && doc.status !== "voided" && (
          <div className="flex gap-2">
            {!hasActed && (
              <Button variant="outline" size="sm" onClick={() => setDeclineOpen(true)} disabled={isSubmitting || isDeclining}>
                <XCircle className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
            )}
            {myStatus === "signed" ? (
              <>
                <span data-testid="already-signed" className="self-center text-xs text-emerald-400">
                  You have signed this document
                </span>
                {nextOpenStep(bundle, documentId) && onOpenDocument && (
                  <Button size="sm" onClick={() => onOpenDocument(String(nextOpenStep(bundle, documentId)!._id))}>
                    Next document →
                  </Button>
                )}
              </>
            ) : canSign ? (
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || isDeclining || !allRequiredFilled}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign & Submit"}
              </Button>
            ) : (
              <span className="self-center text-xs text-[#7a7a90]">
                {waitingFor
                  ? `Waiting for ${waitingFor.name || "another recipient"} (${waitingFor.position} of ${waitingFor.total}) to sign first`
                  : "Waiting for other recipients to sign first"}
              </span>
            )}
          </div>
        )}
      </div>

      {bundle && bundle.size > 1 && onOpenDocument && (
        <BundleSteps bundle={bundle} currentId={documentId} onSelect={onOpenDocument} disabled={isSubmitting || isDeclining} />
      )}

      {doc.status !== "completed" && doc.status !== "voided" && canSign && (
        <div
          data-testid="signing-guide"
          className="flex flex-wrap items-center gap-3 border-b border-[#1e1e2e] bg-[#111118] px-4 py-2 text-xs text-[#c7c7da]"
        >
          {requiredMine.length > 0 ? (
            <>
              <span>
                {remaining.length === 0
                  ? "All required fields are done"
                  : `${remaining.length} of ${requiredMine.length} required field${requiredMine.length === 1 ? "" : "s"} left`}
              </span>
              {remaining.length > 0 && (
                <Button size="sm" className="h-7 bg-yellow-400 px-3 font-semibold text-black hover:bg-yellow-300" onClick={goToNext}>
                  {activeFieldId || remaining.length < requiredMine.length ? "Next" : "Start"}
                </Button>
              )}
            </>
          ) : (
            <span>You have no required fields.</span>
          )}
          {blockers.length > 0 ? (
            <span className="ml-auto text-[#7a7a90]">To finish: {blockers.join(", ")}</span>
          ) : (
            <span className="ml-auto text-emerald-400">Ready: press Sign &amp; Submit</span>
          )}
        </div>
      )}

      {doc.status !== "completed" && doc.status !== "voided" && canSign && !emailVerified && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1e1e2e] bg-[#15151b] px-4 py-3 text-xs text-[#a0a0c0]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
          {!otpSent ? (
            <>
              <span>Verify your email before signing.</span>
              <Button variant="outline" size="sm" onClick={handleRequestCode} disabled={isSendingCode}>
                {isSendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
              </Button>
            </>
          ) : (
            <>
              <span>Enter the code we emailed you:</span>
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isVerifyingCode) handleConfirmCode();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                className="h-8 w-28 text-xs"
              />
              <Button size="sm" onClick={handleConfirmCode} disabled={isVerifyingCode}>
                {isVerifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRequestCode} disabled={isSendingCode}>
                Resend code
              </Button>
            </>
          )}
        </div>
      )}

      {doc.status !== "completed" && doc.status !== "voided" && canSign && (
        <label className="flex items-start gap-2 border-b border-[#1e1e2e] bg-[#15151b] px-4 py-3 text-xs text-[#a0a0c0]">
          <Checkbox checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} className="mt-0.5" />
          {consent.text}
        </label>
      )}

      {/* Light grey, not the app's near-black: while scrolling faster than Chrome can
          paint, the not-yet-painted area shows this background colour — grey reads as a
          page still loading, black read as the whole screen going blank. */}
      <div ref={scrollerRef} className="flex-1 overflow-auto bg-[#e4e4e7] p-6">
        <Document file={doc.flattenedFileUrl || doc.originalFileUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)} loading={<Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7a7a90]" />}>
          <div className="mx-auto flex flex-col items-center gap-6">
            {pages.map((page) => (
              <div
                key={page}
                ref={(el) => {
                  pageRefs.current[page] = el;
                }}
                className="relative ring-1 ring-black/15"
              >
                <LazyPdfPage pageNumber={page} width={PAGE_WIDTH} onPageSize={onPageSize} />
                {/* Once the document is completed, flattenedFileUrl already has every
                    value baked directly into the PDF with a normal background — no
                    highlighted overlay boxes needed (or wanted) on top of it. */}
                {!doc.flattenedFileUrl && allFields
                  .filter((f) => f.page === page)
                  .map((f) => {
                    const isMine = myFieldIds.has(f._id) && canSign && doc.status !== "completed" && doc.status !== "voided";
                    const style = {
                      left: `${f.x * 100}%`,
                      top: `${f.y * 100}%`,
                      width: `${f.width * 100}%`,
                      height: `${f.height * 100}%`,
                    };
                    // The sender's chosen size/colour, so what is typed or shown here matches the
                    // final PDF. Unset = the defaults.
                    const textStyle: React.CSSProperties = fieldTextStyle(f, sizeOf(f.page).w, PAGE_WIDTH);
                    const guideRing = activeFieldId === f._id && !isFilled(f) ? " ring-4 ring-yellow-400/80 animate-pulse" : "";

                    if (!isMine) {
                      return (
                        <div
                          key={f._id}
                          className="absolute flex items-center justify-center overflow-hidden rounded border border-dashed border-[#3b3b4a] bg-black/20 text-[10px] text-[#7a7a90]"
                          style={{ ...style, ...(f.value ? textStyle : {}) }}
                        >
                          {isImageFieldType(f.type)
                            ? f.value
                              ? <img src={f.value} alt={f.type} className="h-full w-full object-contain" />
                              : `awaiting ${f.type}`
                            : f.type === "checkbox"
                              ? (f.checked ? "✓" : "")
                              : f.value || ""}
                        </div>
                      );
                    }

                    if (isImageFieldType(f.type)) {
                      const imageType = f.type as "signature" | "initials" | "stamp";
                      const captureKey = captureKeyOf(f);
                      const captured = signatureImages[captureKey];
                      return (
                        <button
                          key={f._id}
                          data-field-id={f._id}
                          onClick={() => {
                            setActiveCapture({ type: imageType, key: captureKey, style: signatureStyleOf(f, sizeOf(f.page)) });
                            setSignatureModalOpen(true);
                          }}
                          className={`absolute flex items-center justify-center gap-1 rounded border-2 border-indigo-400 bg-indigo-500/10 text-[10px] text-indigo-300 hover:bg-indigo-500/20${guideRing}`}
                          style={style}
                        >
                          {captured ? (
                            <img src={captured.imageUrl} alt={f.type} className="h-full w-full object-contain" />
                          ) : (
                            <>
                              <PenLine className="h-3 w-3" />{" "}
                              {imageType === "initials" ? "Click to initial" : imageType === "stamp" ? "Click to stamp" : "Click to sign"}
                            </>
                          )}
                        </button>
                      );
                    }

                    if (f.type === "checkbox") {
                      return (
                        <div
                          key={f._id}
                          data-field-id={f._id}
                          className={`absolute flex items-center justify-center${guideRing}`}
                          style={style}
                        >
                          <Checkbox
                            checked={!!checkedValues[f._id]}
                            onCheckedChange={(v) => setCheckedValues((prev) => ({ ...prev, [f._id]: !!v }))}
                          />
                        </div>
                      );
                    }

                    return (
                      <input
                        key={f._id}
                        data-field-id={f._id}
                        value={textValues[f._id] || ""}
                        onChange={(e) => setTextValues((prev) => ({ ...prev, [f._id]: e.target.value }))}
                        placeholder={FIELD_PLACEHOLDERS[f.type] || "Text"}
                        // Black, not white — matches how the value will actually look once
                        // flattened into the final PDF, even while still being typed.
                        className={`absolute rounded border-2 border-indigo-400 bg-indigo-500/10 px-1 text-[11px] text-black outline-none${guideRing}`}
                        style={{ ...style, ...textStyle }}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        </Document>
      </div>

      <SignatureCaptureModal
        open={signatureModalOpen}
        title={
          activeCapture.type === "initials"
            ? "Add your initials"
            : activeCapture.type === "stamp"
              ? "Add your stamp"
              : "Add your signature"
        }
        style={activeCapture.style}
        onClose={() => setSignatureModalOpen(false)}
        onCaptured={(result) => setSignatureImages((prev) => ({ ...prev, [activeCapture.key]: result }))}
      />

      <DeclineDialog open={declineOpen} onOpenChange={setDeclineOpen} pending={isDeclining} onConfirm={handleDecline} />
    </div>
  );
}
