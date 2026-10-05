"use client";

import "@/lib/pdfWorkerSetup";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import { LazyPdfPage } from "@/components/dashboard/docusign/shared/LazyPdfPage";
import { fieldTextStyle, signatureStyleKey, signatureStyleOf, usePageSizes, type SignatureStyle } from "@/components/dashboard/docusign/shared/fieldStyle";
import { SignatureCaptureModal } from "@/components/dashboard/docusign/shared/SignatureCaptureModal";
import { DeclineDialog } from "@/components/dashboard/docusign/shared/DeclineDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, PenLine, ShieldCheck, XCircle } from "lucide-react";
import type { DsBundleStepper, DsField, DsVerifyResult } from "@/lib/docusign/types";
import { BundleSteps, isStepOpen, nextOpenStep } from "@/components/dashboard/docusign/shared/BundleSteps";
import {
  EsignApiError,
  PublicEsignDocument,
  blobToDataUrl,
  confirmEsignOtp,
  declineEsignSign,
  requestEsignOtp,
  submitEsignSign,
  verifyEsignDocument,
  viewEsignDocument,
} from "@/lib/docusign/public-api";

/**
 * The public, no-login self-sign page — app/(dashboard)/workspace/sign/[token]. Lives under
 * /workspace so its link matches FRONTEND_URL's existing base (see the backend's
 * utils/frontendUrl.util.js), but it is explicitly excluded from this layout's auth-guard
 * redirect (see the isPublicEsignSignPage check in app/(dashboard)/layout.tsx, the same
 * mechanism BAT246_DOC_PUBLIC_PATH already uses for its own public page) — a visitor here
 * needs no account and is never redirected to /login.
 *
 * This is the external-signer equivalent of components/dashboard/docusign/SigningView.tsx,
 * deliberately kept as an independent component rather than a modified copy: there is no
 * logged-in user/authStore identity here, and every call goes through
 * lib/docusign/public-api.ts's unauthenticated functions instead of lib/docusign/internal-api.ts's.
 * The backend only ever sends this page the caller's OWN fields (never other recipients'),
 * so — unlike SigningView — there is no "other recipients' fields, dimmed" overlay to render.
 */

const PAGE_WIDTH = 720;

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

const FALLBACK_CONSENT_TEXT =
  "I agree to sign this document electronically and consent to conduct this transaction electronically, in accordance with applicable e-signature law (ESIGN/UETA).";

// No network call, no token — reads the captured blob as a base64 data: URL for
// submitEsignSign to carry; the backend uploads it server-side. See lib/docusign/public-api.ts.
const publicUploadFn = async (file: Blob | File) => ({ url: await blobToDataUrl(file) });

export function PublicSigningView({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<PublicEsignDocument | null>(null);
  const [myFields, setMyFields] = useState<DsField[]>([]);
  const [consent, setConsent] = useState<{ version: string; text: string }>({ version: "v1", text: FALLBACK_CONSENT_TEXT });
  const [canSign, setCanSign] = useState(false);
  const [waitingFor, setWaitingFor] = useState<{ name: string | null; position: number; total: number } | null>(null);
  const [numPages, setNumPages] = useState(0);
  // A link can cover several documents sent together (a group): which one is open, and the stepper for all of
  // them. Undefined until the first load — the backend then opens the first one still waiting on this signer.
  const [docId, setDocId] = useState<string | undefined>(undefined);
  const [bundle, setBundle] = useState<DsBundleStepper | null>(null);

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeCapture, setActiveCapture] = useState<{ type: "signature" | "initials" | "stamp"; key: string; style?: SignatureStyle }>({
    type: "signature",
    key: "signature",
  });
  const [signatureImages, setSignatureImages] = useState<Record<string, { type: "draw" | "type" | "upload"; imageUrl: string }>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [checkedValues, setCheckedValues] = useState<Record<string, boolean>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  // Set once this visit's decline succeeded. The decline retires every signing link, so the page
  // can't re-load to find out — it switches to its final "you declined" state from this instead.
  const [declined, setDeclined] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [verifyDetails, setVerifyDetails] = useState<DsVerifyResult | null>(null);

  // Proof of the email check, from confirmEsignOtp — sent with sign and decline, and short-lived.
  // Memory only (never storage): a reload or a new tab verifies again, and so does an expired one
  // (the server answers "verification_required"). A stored emailVerifiedAt from an earlier visit
  // no longer counts, so this token alone is what "verified" means here.
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const emailVerified = !!verificationToken;
  // Shows the verify bar even when this signer can't sign yet (waiting their turn): declining
  // needs a verified email too.
  const [verifyPrompted, setVerifyPrompted] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const { onPageSize, sizeOf } = usePageSizes();
  const captureKeyOf = (f: DsField) => {
    const style = signatureStyleOf(f, sizeOf(f.page));
    return style ? `${f.type}|${signatureStyleKey(style)}` : f.type;
  };
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // `silent` re-reads the document behind the page already on screen (after signing) instead of
  // swapping it for the full-page spinner, and leaves that page up if the re-read fails.
  const load = async (silent = false, targetDocId: string | undefined = docId) => {
    if (!silent) setIsLoading(true);
    setLoadError(null);
    try {
      const res = await viewEsignDocument(token, targetDocId);
      setDoc(res.data.document);
      setDocId(res.data.document._id);
      setBundle(res.data.bundle ?? null);
      setMyFields(res.data.myFields);
      setCanSign(res.data.canSign && res.data.myStatus !== "signed");
      setWaitingFor(res.data.waitingFor ?? null);
      if (res.data.consent) setConsent(res.data.consent);

      const defaults: Record<string, string> = {};
      res.data.myFields.forEach((f) => {
        if (f.type === "date") defaults[f._id] = new Date().toLocaleDateString();
        else if (f.type === "name" && res.data.document.recipient.name) defaults[f._id] = res.data.document.recipient.name;
        else if (f.type === "email") defaults[f._id] = res.data.document.recipient.email;
      });
      setTextValues(defaults);
    } catch (err: any) {
      if (!silent) setLoadError(err.message || "This link is invalid or has expired");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isFilled = (f: DsField) => {
    if (isImageFieldType(f.type)) return !!signatureImages[captureKeyOf(f)];
    if (f.type === "checkbox") return !!checkedValues[f._id];
    return !!textValues[f._id]?.trim();
  };

  const orderedMine = useMemo(() => [...myFields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [myFields]);
  const requiredMine = orderedMine.filter((f) => f.required);
  const remaining = requiredMine.filter((f) => !isFilled(f));
  const allRequiredFilled = consentGiven && emailVerified && remaining.length === 0;

  const blockers = [
    !consentGiven && "agree to sign electronically",
    !emailVerified && "verify your email",
    remaining.length > 0 && `complete ${remaining.length} required field${remaining.length === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

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

  const goToNext = () => {
    if (!remaining.length) return;
    const currentIdx = activeFieldId ? orderedMine.findIndex((f) => f._id === activeFieldId) : -1;
    scrollToField(remaining.find((f) => orderedMine.indexOf(f) > currentIdx) ?? remaining[0]);
  };

  const handleRequestCode = async () => {
    setIsSendingCode(true);
    try {
      await requestEsignOtp(token, docId);
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
      const res = await confirmEsignOtp(token, otpCode.trim(), docId);
      setVerificationToken(res.data.verificationToken);
      setOtpCode("");
      setVerifyPrompted(false);
      toast.success("Email verified");
    } catch (err: any) {
      toast.error(err.message || "Incorrect or expired code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // The server no longer accepts this visit's verification (it expired, or was never there): drop
  // it so the verify bar comes back — with "Send verification code", since the old code is spent —
  // and say why the action didn't go through. Nothing the signer filled in is lost.
  const requireReverification = () => {
    setVerificationToken(null);
    setOtpSent(false);
    setOtpCode("");
    setVerifyPrompted(true);
    toast.error("Your email verification has expired. Verify your email again to continue.");
  };

  const handleSubmit = async () => {
    if (!consentGiven) {
      toast.error("You must consent to sign electronically first");
      return;
    }
    if (!verificationToken) {
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
        value: isImageFieldType(f.type) ? signatureImages[captureKeyOf(f)]?.imageUrl : f.type === "checkbox" ? undefined : textValues[f._id],
        checked: f.type === "checkbox" ? !!checkedValues[f._id] : undefined,
      }));

      const primary = (["signature", "initials", "stamp"] as const)
        .map((t) => myFields.filter((f) => f.type === t).map((f) => signatureImages[captureKeyOf(f)]).find(Boolean))
        .find(Boolean);

      const res = await submitEsignSign(
        token,
        verificationToken,
        {
          fields: fieldsPayload,
          signatureType: primary?.type || "type",
          signatureImageUrl: primary?.imageUrl || "",
          consentGiven: true,
          consentTextVersion: consent.version,
        },
        docId
      );
      // Take the form down at once so it can't be submitted twice, then re-read the document (the
      // link stays valid after signing) to show the signed values and who, if anyone, is still to sign.
      setCanSign(false);
      setSignatureImages({});
      setTextValues({});
      setCheckedValues({});
      setConsentGiven(false);
      setActiveFieldId(null);
      setDoc(res.data);
      await load(true);
      const left = bundle ? bundle.documents.filter((d) => isStepOpen(d) && String(d._id) !== String(docId)).length : 0;
      toast.success(left ? `Signed — ${left} more document${left === 1 ? "" : "s"} to go` : bundle ? "All documents signed — thank you" : "Signed successfully");
    } catch (err: any) {
      if ((err as EsignApiError)?.code === "verification_required") requireReverification();
      else toast.error(err.message || "Failed to sign");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Declining needs a verified email, same as signing. The dialog offers this instead of Decline
  // until then: close it, show the verify bar and send the code (unless one is already on its way).
  const handleVerifyToDecline = () => {
    setDeclineOpen(false);
    setVerifyPrompted(true);
    if (!otpSent) handleRequestCode();
  };

  const handleDecline = async (reason?: string) => {
    if (!verificationToken) {
      handleVerifyToDecline();
      return;
    }
    setIsDeclining(true);
    try {
      await declineEsignSign(token, verificationToken, reason, docId);
      setDeclineOpen(false);
      setCanSign(false);
      // In a group, declining cancels only this document — go on to the next one still waiting, if any (the link
      // still covers them). Otherwise: declining retired this link, so a reload would only 404.
      const next = nextOpenStep(bundle, docId || "");
      if (next) {
        toast.success("Declined — that document is cancelled. Opening the next one.");
        openDocument(String(next._id));
      } else {
        setDeclined(true);
        toast.success("Document declined");
      }
    } catch (err: any) {
      if ((err as EsignApiError)?.code === "verification_required") {
        setDeclineOpen(false);
        requireReverification();
      } else {
        toast.error(err.message || "Failed to decline");
      }
    } finally {
      setIsDeclining(false);
    }
  };

  // Another document of the same group: a fresh form (consent is given per document), but the email verification
  // from this visit still counts — the link, and so the verification, covers every document of the group.
  const openDocument = (id: string) => {
    setSignatureImages({});
    setCheckedValues({});
    setConsentGiven(false);
    setActiveFieldId(null);
    setVerifyResult(null);
    setVerifyDetails(null);
    setNumPages(0);
    setDocId(id);
    load(false, id);
  };

  // Lets the signer verify their own copy's integrity — same capability an internal (logged-in) recipient
  // already has via the org-side app, just reached through the token instead of a login.
  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyEsignDocument(token, docId);
      setVerifyResult(res.data.valid);
      setVerifyDetails(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to verify document");
    } finally {
      setIsVerifying(false);
    }
  };

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0e]">
        <Loader2 className="h-6 w-6 animate-spin text-[#7a7a90]" />
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0e] px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-400" />
        <h1 className="text-lg font-semibold text-white/90">Can&apos;t open this link</h1>
        <p className="max-w-sm text-sm text-[#a0a0c0]">{loadError || "This link is invalid or has expired."}</p>
      </div>
    );
  }

  // Final state after declining on this visit — nothing left to sign, and the link is now retired.
  if (declined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0e] px-6 text-center">
        <XCircle className="h-8 w-8 text-red-400" />
        <h1 className="text-lg font-semibold text-white/90">You declined this document</h1>
        <p className="max-w-sm text-sm text-[#a0a0c0]">
          &ldquo;{doc.title}&rdquo; has been cancelled for all signers. You can close this page.
        </p>
      </div>
    );
  }

  const recipient = doc.recipient;
  const hasActed = recipient.status === "signed" || recipient.status === "declined";
  const isTerminal = doc.status === "completed" || doc.status === "voided";
  // The next document of the group still waiting on this signer, if any.
  const nextStep = nextOpenStep(bundle, doc._id);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0e]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e1e2e] px-4 py-3">
        <div className="flex items-center gap-2">
          {doc.orgLogoUrl && <img src={doc.orgLogoUrl} alt="" className="h-6 w-6 rounded" />}
          <div>
            <h2 className="text-sm font-semibold text-white/90">{doc.title}</h2>
            {doc.orgName && <p className="text-xs text-[#7a7a90]">from {doc.orgName}</p>}
          </div>
        </div>
        {!isTerminal && (
          <div className="flex gap-2">
            {!hasActed && (
              <Button variant="outline" size="sm" onClick={() => setDeclineOpen(true)} disabled={isDeclining || isSubmitting}>
                {isDeclining ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                Decline
              </Button>
            )}
            {recipient.status === "signed" ? (
              <>
                <span className="self-center text-xs text-emerald-400">You have signed this document</span>
                {nextStep && (
                  <Button size="sm" onClick={() => openDocument(String(nextStep._id))}>
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
                {waitingFor ? `Waiting for ${waitingFor.name || "another recipient"} (${waitingFor.position} of ${waitingFor.total}) to sign first` : "Waiting for other recipients to sign first"}
              </span>
            )}
          </div>
        )}
      </div>

      {bundle && bundle.size > 1 && (
        <>
          <BundleSteps bundle={bundle} currentId={doc._id} onSelect={openDocument} disabled={isSubmitting || isDeclining} />
          {!bundle.documents.some(isStepOpen) && (
            <div className="flex items-center gap-2 border-b border-[#1e1e2e] bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              You&apos;re done — nothing left to sign in this group. You can close this page.
            </div>
          )}
        </>
      )}

      {isTerminal && (
        <div className="border-b border-[#1e1e2e] bg-[#111118] px-4 py-3 text-sm">
          {doc.status === "completed" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300">This document is complete — everyone has signed.</span>
                {doc.flattenedFileUrl && (
                  <a href={doc.flattenedFileUrl} target="_blank" rel="noreferrer" className="ml-2 text-indigo-300 underline">
                    Download signed document
                  </a>
                )}
                {doc.certificateFileUrl && (
                  <a href={doc.certificateFileUrl} target="_blank" rel="noreferrer" className="text-indigo-300 underline">
                    Download certificate
                  </a>
                )}
                <Button variant="outline" size="sm" className="ml-auto h-7" onClick={handleVerify} disabled={isVerifying}>
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify integrity"}
                </Button>
              </div>
              {verifyResult !== null && (
                <div className="mt-2 space-y-1 border-t border-[#1e1e2e] pt-2 text-xs">
                  <p className={verifyResult ? "text-emerald-400" : "text-red-400"}>
                    {verifyResult ? "Hash matches — this file has not been altered since completion." : "Hash mismatch — this file may have been altered since completion."}
                  </p>
                  {verifyDetails?.auditTrail?.checked && (
                    <p className={verifyDetails.auditTrail.intact ? "text-emerald-400" : "text-red-400"}>
                      {verifyDetails.auditTrail.intact
                        ? `Audit trail unchanged since completion (${verifyDetails.auditTrail.events} events).`
                        : "Audit trail differs from completion — an event was changed or removed."}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-300">This document has been voided and can no longer be signed.</span>
            </div>
          )}
        </div>
      )}

      {recipient.status === "declined" && !isTerminal && (
        <div className="flex items-center gap-2 border-b border-[#1e1e2e] bg-[#111118] px-4 py-3 text-sm text-red-300">
          <XCircle className="h-4 w-4" /> You declined this document.
        </div>
      )}

      {!isTerminal && canSign && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#1e1e2e] bg-[#111118] px-4 py-2 text-xs text-[#c7c7da]">
          {requiredMine.length > 0 ? (
            <>
              <span>{remaining.length === 0 ? "All required fields are done" : `${remaining.length} of ${requiredMine.length} required field${requiredMine.length === 1 ? "" : "s"} left`}</span>
              {remaining.length > 0 && (
                <Button size="sm" className="h-7 bg-yellow-400 px-3 font-semibold text-black hover:bg-yellow-300" onClick={goToNext}>
                  {activeFieldId || remaining.length < requiredMine.length ? "Next" : "Start"}
                </Button>
              )}
            </>
          ) : (
            <span>You have no required fields.</span>
          )}
          {blockers.length > 0 ? <span className="ml-auto text-[#7a7a90]">To finish: {blockers.join(", ")}</span> : <span className="ml-auto text-emerald-400">Ready: press Sign &amp; Submit</span>}
        </div>
      )}

      {!isTerminal && !hasActed && !emailVerified && (canSign || verifyPrompted) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1e1e2e] bg-[#15151b] px-4 py-3 text-xs text-[#a0a0c0]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
          {!otpSent ? (
            <>
              <span>{canSign ? "Verify your email before signing." : "Verify your email before declining."}</span>
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

      {!isTerminal && canSign && (
        <label className="flex items-start gap-2 border-b border-[#1e1e2e] bg-[#15151b] px-4 py-3 text-xs text-[#a0a0c0]">
          <Checkbox checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} className="mt-0.5" />
          {consent.text}
        </label>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-auto bg-[#e4e4e7] p-6">
        <Document
          file={doc.flattenedFileUrl || doc.originalFileUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7a7a90]" />}
        >
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
                {!doc.flattenedFileUrl &&
                  myFields
                    .filter((f) => f.page === page)
                    .map((f) => {
                      const active = canSign && !isTerminal;
                      const style = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` };
                      const textStyle: React.CSSProperties = fieldTextStyle(f, sizeOf(f.page).w, PAGE_WIDTH);
                      const guideRing = activeFieldId === f._id && !isFilled(f) ? " ring-4 ring-yellow-400/80 animate-pulse" : "";

                      if (!active) {
                        return (
                          <div
                            key={f._id}
                            className="absolute flex items-center justify-center overflow-hidden rounded border border-dashed border-[#3b3b4a] bg-black/20 text-[10px] text-[#7a7a90]"
                            style={{ ...style, ...(f.value ? textStyle : {}) }}
                          >
                            {isImageFieldType(f.type) ? (
                              f.value ? (
                                <img src={f.value} alt={f.type} className="h-full w-full object-contain" />
                              ) : (
                                `awaiting ${f.type}`
                              )
                            ) : f.type === "checkbox" ? (
                              f.checked ? "✓" : ""
                            ) : (
                              f.value || ""
                            )}
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
                                <PenLine className="h-3 w-3" /> {imageType === "initials" ? "Click to initial" : imageType === "stamp" ? "Click to stamp" : "Click to sign"}
                              </>
                            )}
                          </button>
                        );
                      }

                      if (f.type === "checkbox") {
                        return (
                          <div key={f._id} data-field-id={f._id} className={`absolute flex items-center justify-center${guideRing}`} style={style}>
                            <Checkbox checked={!!checkedValues[f._id]} onCheckedChange={(v) => setCheckedValues((prev) => ({ ...prev, [f._id]: !!v }))} />
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
        title={activeCapture.type === "initials" ? "Add your initials" : activeCapture.type === "stamp" ? "Add your stamp" : "Add your signature"}
        style={activeCapture.style}
        onClose={() => setSignatureModalOpen(false)}
        onCaptured={(result) => setSignatureImages((prev) => ({ ...prev, [activeCapture.key]: result }))}
        uploadFn={publicUploadFn}
      />

      <DeclineDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        pending={isDeclining}
        onConfirm={handleDecline}
        needsVerification={!emailVerified}
        onVerify={handleVerifyToDecline}
      />
    </div>
  );
}
