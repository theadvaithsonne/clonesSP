"use client";

// Step 4 of the whitelabel setup wizard: the receipt.
//
// Reads the three things the earlier steps wrote — app domain, branding
// colours, email domain — straight back from the API rather than from
// wizard state, so a founder who skipped a step (or finished it in Office
// Settings a week ago) sees what's actually true, not what this session
// happened to do.

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WizardProgress } from "./WhitelabelWizardShell";

// Kept in step with WhitelabelBrandingStep's defaults.
const GARAGE_PRIMARY = "#FBD10D";
const GARAGE_SECONDARY = "#6366F1";

type SummaryStatus = "verified" | "applied" | "pending" | "default" | "skipped";

type Summary = {
  workspaceUrl: string;
  workspaceStatus: SummaryStatus;
  brand: string;
  brandStatus: SummaryStatus;
  email: string;
  emailStatus: SummaryStatus;
};

const STATUS_STYLES: Record<SummaryStatus, string> = {
  verified: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  applied: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  default: "border-white/10 bg-white/5 text-[#8b8ba3]",
  skipped: "border-white/10 bg-white/5 text-[#8b8ba3]",
};

const STATUS_LABELS: Record<SummaryStatus, string> = {
  verified: "Verified",
  applied: "Applied",
  pending: "Pending",
  default: "Garage default",
  skipped: "Skipped",
};

function SummaryRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: SummaryStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#1e1e26] px-4 py-3 last:border-b-0">
      <span className="shrink-0 text-[12.5px] text-[#8b8ba3]">{label}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[12.5px] font-semibold text-white">
          {value}
        </span>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-0.5 text-[10.5px] font-medium",
            STATUS_STYLES[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
    </div>
  );
}

export default function WhitelabelCompleteStep({
  onBackToSettings,
}: {
  onBackToSettings?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;
      if (!orgId) {
        setLoading(false);
        return;
      }
      const [domainsRes, brandingRes, emailRes] = await Promise.allSettled([
        api<{ domains?: Array<{ domain: string; verified: boolean; isPrimary?: boolean }> }>(
          `/initial-setup/app-domains?orgId=${orgId}`,
        ),
        api<{ branding?: { primaryColor?: string; secondaryColor?: string } }>(
          `/org/${orgId}/branding`,
        ),
        api<{
          domainConfig?: {
            type: "default" | "custom";
            customDomain?: string;
            verified: boolean;
            dnsRecords?: Array<{ verified: boolean }>;
          };
        }>(`/initial-setup/domain-config?orgId=${orgId}`),
      ]);
      if (cancelled) return;

      const domains =
        domainsRes.status === "fulfilled" ? domainsRes.value.domains || [] : [];
      const primary = domains.find((d) => d.isPrimary) || domains[0];

      const branding =
        brandingRes.status === "fulfilled"
          ? brandingRes.value.branding
          : undefined;
      // GET /branding answers with the Garage default when the org has
      // never saved one, so count only colours that were actually changed —
      // otherwise a skipped step 2 would report itself as "Applied".
      const primaryColor = branding?.primaryColor?.toUpperCase();
      const secondaryColor = branding?.secondaryColor?.toUpperCase();
      const colourCount = [
        primaryColor && primaryColor !== GARAGE_PRIMARY ? primaryColor : null,
        secondaryColor && secondaryColor !== GARAGE_SECONDARY
          ? secondaryColor
          : null,
      ].filter(Boolean).length;

      const emailCfg =
        emailRes.status === "fulfilled" ? emailRes.value.domainConfig : undefined;
      // Same rule step 3 uses: all five records detected, not just the MX
      // one the BE stores in `verified`.
      const emailRecords = emailCfg?.dnsRecords ?? [];
      const emailVerified =
        emailRecords.length > 0 && emailRecords.every((r) => r.verified);

      setSummary({
        workspaceUrl: primary?.domain || "garage.app",
        workspaceStatus: !primary
          ? "skipped"
          : primary.verified
            ? "verified"
            : "pending",
        brand: colourCount
          ? `${colourCount} custom colour${colourCount > 1 ? "s" : ""}`
          : "Garage defaults",
        brandStatus: colourCount ? "applied" : "default",
        email:
          emailCfg?.type === "custom" && emailCfg.customDomain
            ? `hello@${emailCfg.customDomain}`
            : "networkmail.com",
        emailStatus:
          emailCfg?.type === "custom"
            ? emailVerified
              ? "verified"
              : "pending"
            : "default",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openWorkspace = () => {
    const url = summary?.workspaceUrl;
    if (!url || url === "garage.app" || summary?.workspaceStatus !== "verified") {
      // Nothing custom (or not live yet) — the current workspace is still
      // the right destination.
      window.location.href = "/workspace";
      return;
    }
    window.open(`https://${url}`, "_blank", "noopener,noreferrer");
  };

  // Unlike the other steps this screen is centred — the progress rail sits
  // above a badge, a headline and the summary table — so it builds its own
  // card instead of reusing WizardCard's left-aligned header.
  return (
    <div className="flex min-h-full w-full items-start justify-center bg-[#0a0a0d] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-7 shadow-2xl">
        <div className="flex justify-center">
          <WizardProgress step={4} complete />
        </div>

        {loading || !summary ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            <div className="mt-6 flex justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                <Check className="h-5 w-5 text-emerald-400" strokeWidth={3} />
              </span>
            </div>

            <h1 className="mt-4 text-center text-[24px] font-bold leading-tight tracking-tight text-white">
              Garage is now yours
            </h1>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#2a2a35] bg-[#15151b]">
              <SummaryRow
                label="Workspace URL"
                value={summary.workspaceUrl}
                status={summary.workspaceStatus}
              />
              <SummaryRow
                label="Brand"
                value={summary.brand}
                status={summary.brandStatus}
              />
              <SummaryRow
                label="Email"
                value={summary.email}
                status={summary.emailStatus}
              />
            </div>

            <button
              type="button"
              onClick={openWorkspace}
              className="mt-5 w-full rounded-xl bg-[#F97316] py-3 text-[13.5px] font-semibold text-white shadow-lg transition-colors hover:bg-[#ea580c]"
            >
              Open my workspace
            </button>

            <button
              type="button"
              onClick={onBackToSettings}
              className="mt-3 w-full text-center text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
            >
              Back to settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
