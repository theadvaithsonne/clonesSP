"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getNetworkMailOrgId, getTemplate } from "@/lib/network-mail-api";
import {
  apiCampaignToCampaignData,
  apiStatusToDisplayStatus,
  formatCampaignListDate,
  getCampaign,
  getCampaignReport,
  retryFailedRecipients,
  type EmailCampaign,
  type FailedRecipient,
} from "@/lib/network-mail-campaigns-api";
import { ActionButton } from "./campaign-create/campaign-action-bar";
import { BLANK_TEMPLATE_ID } from "./campaign-create/constants";
import type { CampaignData } from "./campaign-create/types";
import {
  formatDisplayDateTime,
  getScheduleDescription,
} from "./campaign-create/utils";
import { resolveTemplatePreviewHtml } from "./email-html-export";
import { ResponsiveEmailFrame } from "@/components/shared/EmailTemplatePreview";
import type { CampaignStatus } from "./campaign-table";

function DetailsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8">
        <h4 className="text-sm font-medium text-white">{title}</h4>
      </div>
      <div className="px-4 py-3 text-sm text-[#a8a8a8] space-y-1">{children}</div>
    </div>
  );
}

function formatRate(rate: number): string {
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}

const STATUS_BADGE: Record<CampaignStatus, string> = {
  Delivered: "bg-emerald-500/15 text-emerald-400",
  Scheduled: "bg-blue-500/15 text-blue-400",
  Draft: "bg-white/8 text-[#a8a8a8]",
  Sending: "bg-amber-500/15 text-amber-400",
  Failed: "bg-red-500/15 text-red-400",
  Cancelled: "bg-white/8 text-[#7a7a7a]",
};

/** Statuses the backend can still move on its own — worth polling for. */
const PENDING_STATUSES = new Set(["scheduled", "sending"]);

/** How often to re-check a campaign the scheduler has yet to finish. */
const POLL_MS = 15_000;

export function CampaignDetailsView({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [reportStats, setReportStats] = useState<Record<string, number> | null>(
    null,
  );
  const [openRate, setOpenRate] = useState<number | null>(null);
  const [clickRate, setClickRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [htmlBody, setHtmlBody] = useState<string | null>(null);
  const [failedRecipients, setFailedRecipients] = useState<FailedRecipient[]>([]);
  const [retrying, setRetrying] = useState(false);

  const data: Partial<CampaignData> = useMemo(
    () => (campaign ? apiCampaignToCampaignData(campaign) : {}),
    [campaign],
  );

  const displayStatus = campaign
    ? (apiStatusToDisplayStatus(campaign.status) as CampaignStatus)
    : null;

  const net =
    campaign?.netRecipientCount ??
    campaign?.recipients?.netRecipientCount ??
    campaign?.recipientCount ??
    0;

  const fetchCampaign = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) throw new Error("Organization not found");
    const [loaded, report] = await Promise.all([
      getCampaign(orgId, campaignId),
      getCampaignReport(orgId, campaignId).catch(() => null),
    ]);
    return { loaded, report };
  }, [campaignId]);

  const apply = useCallback(
    ({
      loaded,
      report,
    }: Awaited<ReturnType<typeof fetchCampaign>>) => {
      setCampaign(loaded);
      if (report) {
        setReportStats(report.stats ?? null);
        setOpenRate(report.openRate ?? null);
        setClickRate(report.clickRate ?? null);
        setFailedRecipients(report.failedRecipients ?? []);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCampaign()
      .then((res) => {
        if (!cancelled) apply(res);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : "Failed to load campaign",
        );
        onBack();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCampaign, apply, onBack]);

  // The send runs on the server's own schedule, so refresh in place until the
  // campaign reaches a status that can no longer change by itself.
  const isPending = Boolean(campaign && PENDING_STATUSES.has(campaign.status));

  useEffect(() => {
    if (!isPending) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetchCampaign()
        .then((res) => {
          if (!cancelled) apply(res);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isPending, fetchCampaign, apply]);

  const handleRetryFailed = useCallback(async () => {
    const orgId = getNetworkMailOrgId();
    if (!orgId) return;
    setRetrying(true);
    try {
      const res = await retryFailedRecipients(orgId, campaignId);
      toast.success(
        `Retrying ${res.retrying} recipient${res.retrying === 1 ? "" : "s"}`,
      );
      // Picks up status "sending", which switches the poll above back on.
      apply(await fetchCampaign());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to retry recipients",
      );
    } finally {
      setRetrying(false);
    }
  }, [campaignId, fetchCampaign, apply]);

  useEffect(() => {
    const orgId = getNetworkMailOrgId();
    const tid = data.templateId;
    if (!orgId || !tid || tid === BLANK_TEMPLATE_ID) return;
    getTemplate(orgId, tid)
      .then((t) => setHtmlBody(resolveTemplatePreviewHtml(t) || null))
      .catch(() => setHtmlBody(null));
  }, [data.templateId]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-[#a8a8a8]">
        Loading campaign details…
      </div>
    );
  }

  if (!campaign) return null;

  const sentLabel =
    formatCampaignListDate(campaign.sentAt) ??
    formatCampaignListDate(campaign.scheduledFor) ??
    "—";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 border-b border-white/8 pb-4 -mx-6 px-6">
        <button
          type="button"
          onClick={onBack}
          className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center text-[#a8a8a8] hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          aria-label="Back to campaigns"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-normal text-white truncate">
              {campaign.campaignName}
            </h3>
            {displayStatus && (
              <span
                className={`inline-flex h-6 px-2 rounded-full text-xs items-center ${STATUS_BADGE[displayStatus]}`}
              >
                {displayStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-[#7a7a7a]">Campaign details and performance</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-5 pb-8">
        <div className="max-w-4xl mx-auto space-y-5">
          {campaign.senderNotice && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
              {campaign.senderNotice}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-[#7a7a7a]">Delivered</p>
              <p className="text-lg text-white mt-1">
                {campaign.deliveredCount.toLocaleString()}
                <span className="text-sm text-[#7a7a7a]">
                  {" "}
                  / {net.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-[#7a7a7a]">Failed</p>
              <p className="text-lg text-white mt-1">
                {campaign.failedCount.toLocaleString()}
              </p>
            </div>
            {openRate != null && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs text-[#7a7a7a]">Open rate</p>
                <p className="text-lg text-white mt-1">{formatRate(openRate)}</p>
              </div>
            )}
            {clickRate != null && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs text-[#7a7a7a]">Click rate</p>
                <p className="text-lg text-white mt-1">{formatRate(clickRate)}</p>
              </div>
            )}
          </div>

          {failedRecipients.length > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-red-500/20">
                <h4 className="text-sm font-medium text-white">
                  {failedRecipients.length} recipient
                  {failedRecipients.length === 1 ? "" : "s"} could not be reached
                </h4>
                <ActionButton
                  variant="primary"
                  disabled={retrying || isPending}
                  onClick={() => void handleRetryFailed()}
                >
                  {retrying ? "Retrying…" : "Retry failed"}
                </ActionButton>
              </div>
              <ul className="px-4 py-3 space-y-2 text-sm max-h-64 overflow-y-auto">
                {failedRecipients.map((r) => (
                  <li key={r.email} className="flex flex-col gap-0.5">
                    <span className="text-white break-all">{r.email}</span>
                    {r.error && (
                      <span className="text-xs text-red-300/80 break-words">
                        {r.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reportStats && Object.keys(reportStats).length > 0 && (
            <DetailsCard title="📊 Report metrics">
              <ul className="grid grid-cols-2 gap-2">
                {Object.entries(reportStats).map(([key, value]) => (
                  <li key={key}>
                    <span className="text-[#7a7a7a] capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </span>{" "}
                    <span className="text-white">{value.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </DetailsCard>
          )}

          <DetailsCard title="📋 Campaign details">
            <p>
              <span className="text-[#7a7a7a]">Template:</span>{" "}
              <span className="text-white">
                {campaign.templateName ?? campaign.templateId}
              </span>
            </p>
            <p>
              <span className="text-[#7a7a7a]">Sent:</span>{" "}
              <span className="text-white">{sentLabel}</span>
            </p>
            <p>
              <span className="text-[#7a7a7a]">Created:</span>{" "}
              {formatDisplayDateTime(campaign.createdAt)}
            </p>
            <p>
              <span className="text-[#7a7a7a]">Last updated:</span>{" "}
              {formatDisplayDateTime(campaign.updatedAt)}
            </p>
          </DetailsCard>

          <DetailsCard title="👥 Recipients">
            <p>
              Source: <span className="text-white">{data.recipients?.source}</span>
            </p>
            {data.recipients?.source === "leads" && data.recipients.leadFilter && (
              <>
                <p>
                  Funnel:{" "}
                  <span className="text-white">
                    {data.recipients.leadFilter.funnelName ||
                      data.recipients.leadFilter.funnelId}
                  </span>
                </p>
                {data.recipients.leadFilter.stage && (
                  <p>
                    Stage:{" "}
                    <span className="text-white">
                      {data.recipients.leadFilter.stage}
                    </span>
                  </p>
                )}
              </>
            )}
            {data.recipients?.csvFileName && (
              <p>
                CSV:{" "}
                <span className="text-white">{data.recipients.csvFileName}</span>
              </p>
            )}
            <p className="text-white pt-1">
              Net recipients: {net.toLocaleString()}
            </p>
          </DetailsCard>

          <DetailsCard title="📅 Schedule">
            <p className="text-white">{getScheduleDescription(data)}</p>
          </DetailsCard>

          <DetailsCard title="📧 Email content">
            <p>
              <span className="text-[#7a7a7a]">Subject:</span>{" "}
              <span className="text-white">{campaign.subjectLine || "—"}</span>
            </p>
            <p>
              <span className="text-[#7a7a7a]">From:</span>{" "}
              <span className="text-white">
                {campaign.fromName} &lt;{campaign.fromEmail}&gt;
              </span>
            </p>
            {campaign.actualFromEmail &&
              campaign.actualFromEmail.toLowerCase() !==
                campaign.fromEmail.toLowerCase() && (
                <p>
                  <span className="text-[#7a7a7a]">Sent as:</span>{" "}
                  <span className="text-amber-200/90">
                    {campaign.actualFromEmail}
                  </span>
                  <span className="text-[#7a7a7a]">
                    {" "}
                    (preferred domain not verified)
                  </span>
                </p>
              )}
            {campaign.previewText && (
              <p>
                <span className="text-[#7a7a7a]">Preview:</span>{" "}
                <span className="text-white">{campaign.previewText}</span>
              </p>
            )}
          </DetailsCard>

          <DetailsCard title="📧 Email preview">
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
          </DetailsCard>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 px-6 py-3 flex justify-end">
        <ActionButton variant="secondary" onClick={onBack}>
          Back to campaigns
        </ActionButton>
      </div>
    </div>
  );
}
