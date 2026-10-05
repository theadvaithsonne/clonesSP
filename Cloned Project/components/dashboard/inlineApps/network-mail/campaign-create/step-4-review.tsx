"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Smartphone,
  XCircle,
} from "lucide-react";
import { getNetworkMailOrgId, getTemplate, syncTemplateHtmlBody } from "@/lib/network-mail-api";
import {
  getNetworkMailSettings,
  sendCampaignTestEmail,
} from "@/lib/network-mail-campaigns-api";
import { toast } from "sonner";
import { CampaignStepper } from "./campaign-stepper";
import { CampaignStepHeader } from "./campaign-create-dialog";
import { CampaignActionBar, ActionButton } from "./campaign-action-bar";
import { BLANK_TEMPLATE_ID } from "./constants";
import {
  formatDisplayDateTime,
  getReviewFieldErrors,
  getScheduleDescription,
  validateCampaign,
  estimateSendMinutes,
} from "./utils";
import type { CampaignData } from "./types";
import { resolveTemplatePreviewHtml } from "../email-html-export";
import { ResponsiveEmailFrame } from "@/components/shared/EmailTemplatePreview";

function ChecklistIcon({ status }: { status: "complete" | "warning" | "error" }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "warning")
    return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}

function ReviewCard({
  title,
  onEdit,
  hasError,
  children,
}: {
  title: string;
  onEdit: () => void;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border bg-white/[0.02] overflow-hidden ${
        hasError ? "border-red-500/50 ring-1 ring-red-500/25" : "border-white/8"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          hasError ? "border-red-500/30" : "border-white/8"
        }`}
      >
        <h4 className={`text-sm font-medium ${hasError ? "text-red-300" : "text-white"}`}>
          {title}
        </h4>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_87%,black)] cursor-pointer"
        >
          Edit
        </button>
      </div>
      <div className="px-4 py-3 text-sm text-[#a8a8a8] space-y-1">{children}</div>
    </div>
  );
}

function ReviewFormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className={`block text-xs mb-1 ${
          error ? "text-red-400 font-medium" : "text-[#a8a8a8]"
        }`}
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function ReviewFieldHint({ message }: { message: string }) {
  return <p className="text-xs text-red-400 mt-1">{message}</p>;
}

export function CampaignStep4Review({
  campaignData,
  campaignId,
  isLaunching,
  onBack,
  onEditStep,
  onLaunch,
  onSaveDraft,
  onCampaignDataChange,
  returnToReview,
  onReturnToReview,
}: {
  campaignData: Partial<CampaignData>;
  campaignId: string | null;
  isLaunching?: boolean;
  onBack: () => void;
  onEditStep: (step: number) => void;
  onLaunch: () => void | Promise<void>;
  onSaveDraft: () => void | Promise<void>;
  onCampaignDataChange?: (patch: Partial<CampaignData>) => void;
  returnToReview?: boolean;
  onReturnToReview?: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [htmlBody, setHtmlBody] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testExpanded, setTestExpanded] = useState(false);
  const [testSentMsg, setTestSentMsg] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [defaultFromEmail, setDefaultFromEmail] = useState("noreply@mail.garagemail.in");
  const [senderFallbackNote, setSenderFallbackNote] = useState(
    "If the From email domain is not verified with our email provider, messages are sent from the default verified address instead, with replies to your From address.",
  );
  const [templateStatus, setTemplateStatus] = useState<
    "draft" | "published" | "archived" | null
  >(null);
  const [templateStatusLoaded, setTemplateStatusLoaded] = useState(false);

  useEffect(() => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    getNetworkMailSettings(orgId)
      .then((settings) => {
        const fallback =
          settings.senderFallbackPolicy?.defaultFromEmail ||
          settings.senderIdentity.defaultFromEmail;
        if (fallback) setDefaultFromEmail(fallback);
        if (settings.senderFallbackPolicy?.note) {
          setSenderFallbackNote(settings.senderFallbackPolicy.note);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const data: Partial<CampaignData> = useMemo(
    () => ({
      createdAt: new Date().toISOString(),
      ...campaignData,
    }),
    [campaignData]
  );

  const reviewOpts = useMemo(
    () => ({ templateStatus, templateStatusLoaded }),
    [templateStatus, templateStatusLoaded]
  );
  const checklist = useMemo(
    () => validateCampaign(data, reviewOpts),
    [data, reviewOpts]
  );
  const fieldErrors = useMemo(
    () => getReviewFieldErrors(data, reviewOpts),
    [data, reviewOpts]
  );
  const templateComplianceErrors = useMemo(
    () =>
      checklist.filter(
        (c) =>
          c.status === "error" && (c.id === "unsubscribe" || c.id === "address")
      ),
    [checklist]
  );
  const canLaunch = checklist.every((c) => !c.blocking || c.status === "complete");

  const inputClass = (hasError?: boolean) =>
    `w-full h-9 px-3 rounded-lg border bg-white/[0.03] text-sm text-white placeholder:text-white/40 outline-none transition-colors ${
      hasError ? "border-red-500/60" : "border-white/10"
    }`;

  const net =
    data.recipients?.netRecipientCount ?? data.recipients?.recipientCount ?? 0;

  useEffect(() => {
    const orgId = getNetworkMailOrgId();
    const tid = data.templateId;
    if (!orgId || !tid || tid === BLANK_TEMPLATE_ID) {
      setTemplateStatus(null);
      setTemplateStatusLoaded(true);
      setHtmlBody(null);
      return;
    }
    setTemplateStatus(null);
    setTemplateStatusLoaded(false);
    let cancelled = false;
    getTemplate(orgId, tid)
      .then((t) => {
        if (cancelled) return;
        setTemplateStatus(t.status);
        setTemplateStatusLoaded(true);
        setHtmlBody(resolveTemplatePreviewHtml(t) || null);
      })
      .catch(() => {
        if (cancelled) return;
        setTemplateStatus(null);
        setTemplateStatusLoaded(true);
        setHtmlBody(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data.templateId]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <CampaignStepper
        currentStep={4}
        returnToReview={returnToReview}
        onReturnToReview={onReturnToReview}
      />

      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        <div className="space-y-4">
          <CampaignStepHeader
            step={4}
            title="Review & Launch"
            description="Confirm everything before sending."
          />

          <ReviewCard
            title="Campaign Details"
            onEdit={() => onEditStep(1)}
            hasError={!!(fieldErrors.campaignName || fieldErrors.templateId)}
          >
            <p>
              <span className="text-[#7a7a7a]">Campaign Name:</span>{" "}
              <span className={fieldErrors.campaignName ? "text-red-400" : "text-white"}>
                {data.campaignName?.trim() || "—"}
              </span>
            </p>
            {fieldErrors.campaignName && (
              <ReviewFieldHint message={fieldErrors.campaignName} />
            )}
            <p>
              <span className="text-[#7a7a7a]">Template:</span>{" "}
              <span className={fieldErrors.templateId ? "text-red-400" : "text-white"}>
                {data.templateName ?? data.templateId ?? "—"}
              </span>
            </p>
            {fieldErrors.templateId && <ReviewFieldHint message={fieldErrors.templateId} />}
            <p>
              <span className="text-[#7a7a7a]">Created:</span>{" "}
              {formatDisplayDateTime(data.createdAt)}
            </p>
          </ReviewCard>

          <ReviewCard
            title="Recipients"
            onEdit={() => onEditStep(2)}
            hasError={!!fieldErrors.recipients}
          >
            <p>Source: {data.recipients?.source}</p>
            {data.recipients?.source === "leads" && data.recipients.leadFilter && (
              <>
                <p>
                  Funnel:{" "}
                  <span className="text-white">
                    {data.recipients.leadFilter.funnelName ||
                      data.recipients.leadFilter.funnelId}
                  </span>
                </p>
                <p>
                  Stage:{" "}
                  <span className="text-white">{data.recipients.leadFilter.stage}</span>
                </p>
                {data.recipients.leadFilter.tag && (
                  <p>
                    Tag: <span className="text-white">{data.recipients.leadFilter.tag}</span>
                  </p>
                )}
                {data.recipients.leadFilter.leadStatus && (
                  <p>
                    Lead status:{" "}
                    <span className="text-white">{data.recipients.leadFilter.leadStatus}</span>
                  </p>
                )}
                {data.recipients.leadFilter.source && (
                  <p>
                    Source:{" "}
                    <span className="text-white">{data.recipients.leadFilter.source}</span>
                  </p>
                )}
                {data.recipients.leadStats && (
                  <p>
                    {(data.recipients.leadStats.total ?? 0).toLocaleString()} leads in stage,{" "}
                    {(data.recipients.leadStats.withEmail ?? 0).toLocaleString()} with email
                  </p>
                )}
              </>
            )}
            {data.recipients?.senderEmail && (
              <p>
                Sender email:{" "}
                <span className="text-white">{data.recipients.senderEmail}</span>
              </p>
            )}
            <p className={`pt-2 ${fieldErrors.recipients ? "text-red-400" : "text-white"}`}>
              Net Recipients: {net.toLocaleString()}
            </p>
            {fieldErrors.recipients && <ReviewFieldHint message={fieldErrors.recipients} />}
          </ReviewCard>

          <ReviewCard
            title="Schedule"
            onEdit={() => onEditStep(3)}
            hasError={!!fieldErrors.schedule}
          >
            <p>
              Type:{" "}
              <span className={fieldErrors.schedule ? "text-red-400" : "text-white"}>
                {getScheduleDescription(data)}
              </span>
            </p>
            {fieldErrors.schedule && <ReviewFieldHint message={fieldErrors.schedule} />}
            <p>
              Estimated completion: ~{estimateSendMinutes(net)} minutes after start
            </p>
          </ReviewCard>

          <ReviewCard
            title="Email content"
            onEdit={() => onEditStep(1)}
            hasError={!!(fieldErrors.subjectLine || fieldErrors.fromEmail)}
          >
            <div className="space-y-3">
              <ReviewFormField
                label="Subject line"
                required
                error={fieldErrors.subjectLine}
              >
                <input
                  type="text"
                  value={data.subjectLine ?? ""}
                  onChange={(e) =>
                    onCampaignDataChange?.({ subjectLine: e.target.value })
                  }
                  placeholder="e.g. Your Q2 update is here"
                  className={inputClass(!!fieldErrors.subjectLine)}
                />
              </ReviewFormField>
              <ReviewFormField label="From name">
                <input
                  type="text"
                  value={data.fromName ?? ""}
                  onChange={(e) => onCampaignDataChange?.({ fromName: e.target.value })}
                  className={inputClass()}
                />
              </ReviewFormField>
              <ReviewFormField
                label="From email"
                required
                error={fieldErrors.fromEmail}
              >
                <input
                  type="email"
                  value={data.fromEmail ?? ""}
                  onChange={(e) => onCampaignDataChange?.({ fromEmail: e.target.value })}
                  placeholder="you@company.com"
                  className={inputClass(!!fieldErrors.fromEmail)}
                />
                <p className="text-xs text-[#7a7a7a] mt-1.5 leading-relaxed">
                  {senderFallbackNote} Default sender:{" "}
                  <span className="text-[#a8a8a8]">{defaultFromEmail}</span>
                </p>
              </ReviewFormField>
            </div>
          </ReviewCard>

          <ReviewCard
            title="Email Preview"
            onEdit={() => onEditStep(1)}
            hasError={templateComplianceErrors.length > 0}
          >
            {templateComplianceErrors.length > 0 && (
              <div className="mb-3 space-y-1">
                {templateComplianceErrors.map((item) => (
                  <ReviewFieldHint
                    key={item.id}
                    message={`${item.label} — edit your template to fix`}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-1 mb-3">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`h-7 px-2 rounded text-xs flex items-center gap-1 cursor-pointer ${
                  device === "desktop" ? "bg-white/10 text-white" : "text-[#7a7a7a]"
                }`}
              >
                <Monitor className="h-3 w-3" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`h-7 px-2 rounded text-xs flex items-center gap-1 cursor-pointer ${
                  device === "mobile" ? "bg-white/10 text-white" : "text-[#7a7a7a]"
                }`}
              >
                <Smartphone className="h-3 w-3" /> Mobile
              </button>
            </div>
            <div
              className={`bg-white rounded overflow-hidden mx-auto w-full min-w-0 ${
                device === "mobile" ? "max-w-[280px]" : "max-w-[600px]"
              }`}
            >
              {htmlBody ? (
                <ResponsiveEmailFrame html={htmlBody} />
              ) : (
                <div className="h-40 flex items-center justify-center text-[#999] text-xs">
                  Preview unavailable
                </div>
              )}
            </div>
          </ReviewCard>

          <div className="rounded-xl border border-white/8 p-4 space-y-2">
            <h4 className="text-sm font-medium text-white">Pre-launch checklist</h4>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <ChecklistIcon status={item.status} />
                  <div>
                    <span
                      className={
                        item.status === "error"
                          ? "text-red-400"
                          : item.status === "warning"
                            ? "text-amber-400"
                            : "text-[#a8a8a8]"
                      }
                    >
                      {item.label}
                    </span>
                    {item.status === "error" && !item.message && (
                      <p className="text-xs text-red-400/90">Required before launch</p>
                    )}
                    {item.message && (
                      <p
                        className={`text-xs ${
                          item.status === "error" ? "text-red-400/90" : "text-[#7a7a7a]"
                        }`}
                      >
                        {item.message}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setTestExpanded((e) => !e)}
            className="text-sm text-brand cursor-pointer"
          >
            {testExpanded ? "▼" : "▶"} Send test email before launching
          </button>
          {testExpanded && (
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 h-9 px-3 rounded-lg border border-white/10 bg-transparent text-sm text-white outline-none"
              />
              <ActionButton
                variant="secondary"
                disabled={sendingTest || !testEmail.trim()}
                onClick={async () => {
                  const orgId = getNetworkMailOrgId();
                  const to = testEmail.trim();
                  if (!orgId || !to) return;
                  if (!campaignId) {
                    toast.error("Save the campaign first (complete step 1)");
                    return;
                  }
                  setSendingTest(true);
                  try {
                    let htmlBody: string | null = null;
                    const tid = data.templateId;
                    if (orgId && tid && tid !== BLANK_TEMPLATE_ID) {
                      htmlBody = await syncTemplateHtmlBody(orgId, tid);
                    }
                    await sendCampaignTestEmail(orgId, campaignId, {
                      to,
                      ...(htmlBody ? { htmlBody } : {}),
                    }).then((res) => {
                      if (res.senderNotice) {
                        toast.message(res.senderNotice);
                        setTestSentMsg(
                          `✓ Test sent to ${to} via ${res.actualFromEmail || defaultFromEmail}`,
                        );
                      } else {
                        setTestSentMsg(`✓ Test sent to ${to}`);
                      }
                    });
                    onCampaignDataChange?.({ testSent: true, testSentTo: [to] });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to send test email"
                    );
                  } finally {
                    setSendingTest(false);
                  }
                }}
              >
                {sendingTest ? "Sending…" : "Send test"}
              </ActionButton>
            </div>
          )}
          {testSentMsg && <p className="text-xs text-emerald-400">{testSentMsg}</p>}

        </div>
      </div>

      <CampaignActionBar
        left={<ActionButton variant="secondary" onClick={onBack}>Back</ActionButton>}
        right={
          <>
            <ActionButton variant="secondary" onClick={onSaveDraft}>
              Save as Draft
            </ActionButton>
            <ActionButton
              variant="primary"
              disabled={!canLaunch || isLaunching}
              onClick={() => setShowLaunchModal(true)}
            >
              {isLaunching ? "Launching…" : "Launch Campaign"}
            </ActionButton>
          </>
        }
      />

      {showLaunchModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" />
          <div
            className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">🚀 Launch Campaign?</h3>
            <p className="text-sm text-[#7a7a7a] mt-3">
              You&apos;re about to send this campaign to:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white">
              <li>👥 {net.toLocaleString()} recipients</li>
              <li>📅 {getScheduleDescription(data)}</li>
            </ul>
            <p className="text-xs text-amber-400/90 mt-4">
              ⚠ This action cannot be undone for scheduled sends. You can only cancel before
              the send time.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <ActionButton variant="secondary" onClick={() => setShowLaunchModal(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                disabled={isLaunching}
                onClick={() => {
                  setShowLaunchModal(false);
                  void onLaunch();
                }}
              >
                {isLaunching ? "Launching…" : "Launch Campaign"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
