"use client";

// Step 1 of the whitelabel setup wizard: point a custom domain at Garage.
//
// Rendered by WhitelabelPage once the add-on is active. Three sub-states,
// driven entirely by what GET /initial-setup/app-domains already knows:
//
//   input        → no domain registered yet, founder types one
//   dns_pending  → domain registered with Vercel, DNS not resolving yet
//   dns_verified → records detected, workspace is live on the domain
//
// The backend endpoints are the same ones DomainManagementPage uses, so a
// domain added here shows up there (and vice versa) with no migration.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DnsRecordRow,
  WizardCard,
  formatRecordsForClipboard,
} from "./WhitelabelWizardShell";

export type DnsRecord = {
  type: string;
  name: string;
  value: string;
  priority?: number;
  verified: boolean;
};

export type AppDomain = {
  domain: string;
  verified: boolean;
  verifiedAt?: string;
  sslProvisioned?: boolean;
  isPrimary?: boolean;
  createdAt?: string;
  dnsRecords: DnsRecord[];
};

type WizardStep = "input" | "dns_pending" | "dns_verified";

// Deliberately stricter than the BE's check: every label must be a valid
// hostname label and there must be at least one dot, so "not-a-domain"
// is rejected in the browser instead of coming back as a Vercel 400.
const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

const DOMAIN_ERROR = "That doesn't look like a domain. Try app.yourcompany.com.";

// Re-checks DNS on its own while the founder is off editing records at
// their registrar, so a propagated domain flips to verified without them
// having to click anything.
const POLL_MS = 30_000;

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

/**
 * Vercel only returns the TXT challenge while a domain is unverified, and
 * the A/CNAME rows come from org config. When the API gives us nothing to
 * show, fall back to the target IP/CNAME so the founder still has records
 * to copy instead of an empty card.
 */
function buildRecords(
  records: DnsRecord[] | undefined,
  targetIp: string,
  targetCname: string,
): DnsRecord[] {
  if (records?.length) return records;
  const fallback: DnsRecord[] = [];
  if (targetIp) {
    fallback.push({ type: "A", name: "@", value: targetIp, verified: false });
  }
  if (targetCname) {
    fallback.push({
      type: "CNAME",
      name: "www",
      value: targetCname,
      verified: false,
    });
  }
  return fallback;
}

export default function WhitelabelDomainWizard({
  setActivePopover,
  onNext,
  onSkip,
}: {
  setActivePopover?: (popover: string | null) => void;
  /** Advances the parent wizard to step 2 (branding). */
  onNext?: () => void;
  /** "Skip for now" — leaves the wizard entirely. */
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("input");
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");
  const [currentDomain, setCurrentDomain] = useState<AppDomain | null>(null);
  const [targetIp, setTargetIp] = useState("");
  const [targetCname, setTargetCname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Guards the background poll against setting state after unmount and
  // against overlapping with a manual "Verify records" click.
  const busyRef = useRef(false);

  const applyDomain = useCallback(
    (domain: AppDomain | null) => {
      setCurrentDomain(domain);
      setStep(!domain ? "input" : domain.verified ? "dns_verified" : "dns_pending");
    },
    [],
  );

  const load = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{
        domains: AppDomain[];
        targetCname?: string;
        targetIp?: string;
      }>(`/initial-setup/app-domains?orgId=${orgId}`);
      setTargetIp(res.targetIp || "");
      setTargetCname(res.targetCname || "");
      // The primary domain is the one the workspace actually answers on;
      // fall back to the first registered domain when none is flagged.
      const primary =
        res.domains?.find((d) => d.isPrimary) || res.domains?.[0] || null;
      applyDomain(primary);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load domain setup");
    } finally {
      setLoading(false);
    }
  }, [applyDomain]);

  useEffect(() => {
    load();
  }, [load]);

  // ─────────────────────────── actions ───────────────────────────

  const submitDomain = async () => {
    const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain) {
      setDomainError(DOMAIN_ERROR);
      return;
    }
    if (!DOMAIN_RE.test(domain)) {
      setDomainError(DOMAIN_ERROR);
      return;
    }
    const orgId = getOrgId();
    if (!orgId) {
      toast.error("No office selected");
      return;
    }
    setDomainError("");
    setSubmitting(true);
    try {
      const res = await api<{
        success: boolean;
        domain: string;
        dnsRecords: DnsRecord[];
      }>("/initial-setup/add-app-domain", {
        method: "POST",
        body: JSON.stringify({ orgId, domain }),
      });
      applyDomain({
        domain: res.domain || domain,
        verified: false,
        dnsRecords: res.dnsRecords || [],
      });
      setDomainInput("");
      toast.success("Domain registered. Add the DNS records below.");
    } catch (err: any) {
      const msg = err?.message || "Failed to add domain";
      setDomainError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const verify = useCallback(
    async (opts?: { silent?: boolean }) => {
      const domain = currentDomain?.domain;
      const orgId = getOrgId();
      if (!domain || !orgId || busyRef.current) return;
      busyRef.current = true;
      if (!opts?.silent) setVerifying(true);
      try {
        const res = await api<{
          success: boolean;
          verified: boolean;
          dnsRecords: DnsRecord[];
        }>("/initial-setup/verify-app-domain", {
          method: "POST",
          body: JSON.stringify({ orgId, domain }),
        });
        setCurrentDomain((prev) =>
          prev
            ? {
                ...prev,
                verified: res.verified,
                dnsRecords: res.dnsRecords?.length
                  ? res.dnsRecords
                  : prev.dnsRecords,
              }
            : prev,
        );
        if (res.verified) {
          setStep("dns_verified");
          if (!opts?.silent) toast.success(`${domain} is verified and live.`);
        } else if (!opts?.silent) {
          toast.message(
            "DNS records not yet detected. Please allow propagation time.",
          );
        }
      } catch (err: any) {
        if (!opts?.silent) toast.error(err?.message || "Failed to verify domain");
      } finally {
        busyRef.current = false;
        if (!opts?.silent) setVerifying(false);
      }
    },
    [currentDomain?.domain],
  );

  // Quiet re-check while the founder is waiting on propagation.
  useEffect(() => {
    if (step !== "dns_pending" || !currentDomain?.domain) return;
    const id = setInterval(() => verify({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [step, currentDomain?.domain, verify]);

  const changeDomain = async () => {
    const domain = currentDomain?.domain;
    const orgId = getOrgId();
    if (!domain || !orgId) return;
    setSubmitting(true);
    try {
      await api("/initial-setup/app-domain", {
        method: "DELETE",
        body: JSON.stringify({ orgId, domain }),
      });
      setDomainInput(domain);
      applyDomain(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove domain");
    } finally {
      setSubmitting(false);
    }
  };

  const records = currentDomain
    ? buildRecords(currentDomain.dnsRecords, targetIp, targetCname)
    : [];

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  const copyAll = () => {
    if (!records.length) return;
    navigator.clipboard.writeText(formatRecordsForClipboard(records));
    toast.success("All DNS records copied to clipboard");
  };

  // Step 2 lives in the same wizard when there's a parent to advance;
  // standalone (no onNext) it falls back to the Branding settings page.
  const goToBranding = () =>
    onNext ? onNext() : setActivePopover?.("Office Settings:branding");

  // ─────────────────────────── render ───────────────────────────

  const card = (children: React.ReactNode) => (
    <WizardCard
      step={1}
      title="Point your domain at Garage"
      subtitle="Your team and customers will reach the workspace here instead of garage.app."
    >
      {children}
    </WizardCard>
  );

  if (loading) {
    return card(
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>,
    );
  }

  // ── 1A: domain entry ──
  if (step === "input") {
    return card(
      <>
        <div className="mt-6">
          <label
            htmlFor="wl-domain"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#8b8ba3]"
          >
            Your domain
          </label>
          <Input
            id="wl-domain"
            value={domainInput}
            onChange={(e) => {
              setDomainInput(e.target.value);
              if (domainError) setDomainError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) submitDomain();
            }}
            placeholder="app.yourcompany.com"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!domainError}
            className={cn(
              "rounded-xl border-[#2a2a35] bg-[#15151b] font-mono text-[13px] text-white placeholder:text-[#4a4a58] dark:bg-[#15151b]",
              domainError
                ? "border-red-500/50 focus-visible:border-red-500"
                : "focus-visible:border-brand/40",
            )}
          />
          {domainError ? (
            <p className="mt-1.5 text-xs text-red-400">{domainError}</p>
          ) : (
            <p className="mt-1.5 text-xs text-[#6a6a7a]">
              Use a subdomain like app. or hq. — a bare root domain works too.
            </p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (onSkip ? onSkip() : setActivePopover?.(null))}
            className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={submitDomain}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Continue
          </button>
        </div>
      </>,
    );
  }

  // ── 1B / 1C: DNS records ──
  const verified = step === "dns_verified";

  return card(
    <>
      {/* Domain + status */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full bg-[#F97316]" />
          <span className="truncate text-sm font-semibold text-white">
            {currentDomain?.domain}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium",
              verified
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border border-amber-500/20 bg-amber-500/10 text-amber-400",
            )}
          >
            {verified ? "Verified" : "Pending"}
          </span>
          {!verified && (
            <button
              type="button"
              onClick={changeDomain}
              disabled={submitting}
              className="text-[13px] text-[#8b8ba3] transition-colors hover:text-white disabled:opacity-60"
            >
              Change
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 mt-4 text-xs leading-relaxed text-[#8b8ba3]">
        Add these three records at your DNS provider. Each field maps to a box
        on their form.
      </p>

      <div className="space-y-2.5">
        {records.length ? (
          records.map((r, i) => (
            <DnsRecordRow
              key={`${r.type}-${r.name}-${i}`}
              record={r}
              onCopy={copy}
            />
          ))
        ) : (
          <p className="rounded-xl border border-[#2a2a35] bg-[#15151b] p-3 text-xs text-[#8b8ba3]">
            No DNS records returned yet. Hit “Verify records” to fetch them
            again.
          </p>
        )}
      </div>

      {!verified && records.length > 0 && (
        <button
          type="button"
          onClick={copyAll}
          className="mt-4 w-full rounded-xl border border-[#2a2a35] bg-[#1a1a22] py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#22222c]"
        >
          Copy all records
        </button>
      )}

      {verified ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">
            Your workspace is live at {currentDomain?.domain}
          </span>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#2a2a35] bg-[#15151b]/80 p-3 text-xs leading-relaxed text-[#8b8ba3]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#4a4a58]" />
          <span>
            Propagation usually takes minutes, but can run up to 48 hours. You
            can leave this and come back.
          </span>
        </div>
      )}

      {verified ? (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={goToBranding}
            className="rounded-xl bg-[#F97316] px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg transition-colors hover:bg-[#ea580c]"
          >
            Next: branding
          </button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goToBranding}
            className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
          >
            Continue setup while I wait
          </button>
          <button
            type="button"
            onClick={() => verify()}
            disabled={verifying}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {verifying ? "Verifying…" : "Verify records"}
          </button>
        </div>
      )}
    </>,
  );
}
