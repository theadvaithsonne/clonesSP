"use client";

// Step 3 of the whitelabel setup wizard: where outbound mail comes from.
//
// Two branches, both persisted through POST /initial-setup/domain-config:
//
//   default → Garage sends as networkmail.com, nothing to configure, and
//             the step is done the moment it's saved.
//   custom  → the BE mints five records (MX, SPF, DMARC, autodiscover,
//             autoconfig) that the founder adds at their registrar, then
//             POST /initial-setup/verify-dns confirms propagation.
//
// Verification is deliberately allowed to fail partially: DNS lands one
// record at a time, so a 2-of-5 result is normal ten minutes in and gets
// its own "try again" screen rather than a generic error.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DnsRecordRow,
  WizardCard,
  formatRecordsForClipboard,
  type WizardDnsRecord,
} from "./WhitelabelWizardShell";

export type EmailDomainConfig = {
  type: "default" | "custom";
  customDomain?: string;
  verified: boolean;
  dnsRecords: WizardDnsRecord[];
};

/** 3A picks an option; the rest of the screens are the custom branch. */
type EmailScreen = "options" | "records";

const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

const DOMAIN_ERROR = "That doesn't look like a domain. Try yourcompany.com.";

// Re-checks DNS on its own while the founder is off adding records at
// their registrar, matching step 1's behaviour.
const POLL_MS = 30_000;

const NO_RECORDS: WizardDnsRecord[] = [];

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

/**
 * The BE stores domainConfig.verified from the MX record alone — mail
 * flows as soon as MX resolves — but this screen promises five records,
 * so it reports "verified" only when every record is detected. Derived
 * from the records themselves rather than the flag so a reload and a
 * fresh verify never disagree.
 */
function allRecordsDetected(config: EmailDomainConfig | null): boolean {
  if (!config) return false;
  if (config.type === "default") return true;
  const records = config.dnsRecords ?? [];
  return records.length > 0 && records.every((r) => r.verified);
}

function OptionCard({
  title,
  subtitle,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex-1 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-[#F97316] bg-[#F97316]/[0.07]"
          : "border-[#2a2a35] bg-[#15151b] hover:bg-[#1a1a22]",
      )}
    >
      <span
        className={cn(
          "block h-3.5 w-3.5 rounded-full",
          selected ? "bg-[#F97316]" : "bg-[#3a3a48]",
        )}
      />
      <span className="mt-3 block text-[13px] font-semibold text-white">
        {title}
      </span>
      <span
        className={cn(
          "mt-1 block text-[11.5px] leading-snug",
          selected ? "text-[#F97316]/80" : "text-[#8b8ba3]",
        )}
      >
        {subtitle}
      </span>
    </button>
  );
}

export default function WhitelabelEmailStep({
  onNext,
  onSkip,
  /** Root domain from step 1, used to prefill the custom email domain. */
  appDomain,
}: {
  onNext?: () => void;
  onSkip?: () => void;
  appDomain?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<EmailScreen>("options");
  const [choice, setChoice] = useState<"default" | "custom">("default");
  const [config, setConfig] = useState<EmailDomainConfig | null>(null);
  const [emailDomain, setEmailDomain] = useState("");
  const [domainError, setDomainError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Only show the "we can't see N of 5" box after a verify has actually run —
  // an untouched screen isn't a failure.
  const [attempted, setAttempted] = useState(false);
  // Guards the background poll against overlapping with a manual click.
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ domainConfig: EmailDomainConfig }>(
        `/initial-setup/domain-config?orgId=${orgId}`,
      );
      const cfg = res.domainConfig;
      if (cfg) {
        setConfig(cfg);
        setChoice(cfg.type);
        if (cfg.type === "custom" && cfg.customDomain) {
          setEmailDomain(cfg.customDomain);
          setScreen("records");
        }
      }
    } catch {
      // No config yet is the normal first-run case — start on the options
      // screen rather than surfacing an error the founder can't act on.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Prefill from the app domain the founder just verified in step 1.
    if (!emailDomain && appDomain) {
      setEmailDomain(appDomain.replace(/^(app|hq|www)\./i, ""));
    }
  }, [appDomain, emailDomain]);

  // Stable identity when there's no config yet — `verify` and the poll
  // effect depend on this and must not re-create every render.
  const records = config?.dnsRecords ?? NO_RECORDS;
  const detected = records.filter((r) => r.verified).length;
  const missing = records.length - detected;
  const verified = allRecordsDetected(config);
  const fromAddress = `hello@${config?.customDomain || emailDomain || "yourcompany.com"}`;

  // ─────────────────────────── actions ───────────────────────────

  const saveChoice = async () => {
    if (choice === "custom") {
      const domain = emailDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^.*@/, "")
        .replace(/\/.*$/, "");
      if (!DOMAIN_RE.test(domain)) {
        setDomainError(DOMAIN_ERROR);
        return;
      }
      setEmailDomain(domain);
      setDomainError("");
    }

    const orgId = getOrgId();
    if (!orgId) {
      toast.error("No office selected");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ domainConfig?: EmailDomainConfig }>(
        "/initial-setup/domain-config",
        {
          method: "POST",
          body: JSON.stringify(
            choice === "default"
              ? { orgId, type: "default" }
              : { orgId, type: "custom", customDomain: emailDomain.trim() },
          ),
        },
      );
      if (res.domainConfig) setConfig(res.domainConfig);

      if (choice === "default") {
        toast.success("Email will send from networkmail.com.");
        onNext?.();
        return;
      }
      setAttempted(false);
      setScreen("records");
    } catch (err: any) {
      const msg = err?.message || "Failed to save email settings";
      toast.error(msg);
      if (choice === "custom") setDomainError(msg);
    } finally {
      setSaving(false);
    }
  };

  const verify = useCallback(
    async (opts?: { silent?: boolean }) => {
      const orgId = getOrgId();
      if (!orgId || busyRef.current) return;
      busyRef.current = true;
      if (!opts?.silent) setVerifying(true);
      try {
        // POST /initial-setup/verify-dns re-resolves every stored record
        // and answers with the updated set. `mxVerified` is what the BE
        // persists as domainConfig.verified; `allVerified` covers all five.
        // A full domainConfig is accepted too — the route has answered in
        // that shape before.
        const res = await api<{
          success: boolean;
          allVerified?: boolean;
          mxVerified?: boolean;
          dnsRecords?: WizardDnsRecord[];
          domainConfig?: EmailDomainConfig;
        }>("/initial-setup/verify-dns", {
          method: "POST",
          body: JSON.stringify({ orgId }),
        });

        const returned = res.domainConfig?.dnsRecords ?? res.dnsRecords ?? [];
        // An empty answer means "nothing new to report" — keep what's on
        // screen rather than blanking the records the founder is copying.
        const nextRecords = returned.length ? returned : records;

        setConfig((prev) =>
          prev
            ? {
                ...prev,
                // Mirror what the BE saved so a later reload agrees with
                // this screen; the green state is derived from the records.
                verified:
                  res.domainConfig?.verified ?? res.mxVerified ?? prev.verified,
                dnsRecords: nextRecords,
              }
            : prev,
        );
        setAttempted(true);

        const stillMissing =
          nextRecords.length - nextRecords.filter((r) => r.verified).length;
        const allDetected = nextRecords.length > 0 && stillMissing === 0;

        if (opts?.silent) return;
        if (allDetected) {
          toast.success(`Email verified for ${fromAddress}.`);
        } else {
          toast.message(
            `${stillMissing} of ${nextRecords.length} records not detected yet. Allow a few minutes for propagation.`,
          );
        }
      } catch (err: any) {
        if (!opts?.silent) {
          toast.error(err?.message || "Failed to verify DNS records");
        }
      } finally {
        busyRef.current = false;
        if (!opts?.silent) setVerifying(false);
      }
    },
    [fromAddress, records],
  );

  // Quiet re-check while the founder waits on propagation, same cadence
  // as the app-domain step.
  useEffect(() => {
    if (screen !== "records" || verified || config?.type !== "custom") return;
    const id = setInterval(() => verify({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [screen, verified, config?.type, verify]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  const copyAll = () => {
    if (!records.length) return;
    navigator.clipboard.writeText(formatRecordsForClipboard(records));
    toast.success("All DNS records copied to clipboard");
  };

  const changeChoice = () => {
    setScreen("options");
    setAttempted(false);
  };

  // ─────────────────────────── render ───────────────────────────

  const card = (children: React.ReactNode) => (
    <WizardCard
      step={3}
      title="Send email from your domain"
      subtitle="Invites, receipts and campaigns go out as you@yourcompany.com instead of a Garage address."
      badge="Option"
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

  // ── 3A: pick a sending domain ──
  if (screen === "options") {
    return card(
      <>
        <div className="mt-6 flex gap-3">
          <OptionCard
            title="Use Garage's domain"
            subtitle="Sends from networkmail.com. Nothing to configure."
            selected={choice === "default"}
            onSelect={() => setChoice("default")}
          />
          <OptionCard
            title="Use my domain"
            subtitle="Better deliverability and recognition."
            selected={choice === "custom"}
            onSelect={() => setChoice("custom")}
          />
        </div>

        {choice === "custom" && (
          <div className="mt-4">
            <label
              htmlFor="wl-email-domain"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#8b8ba3]"
            >
              Sending domain
            </label>
            <input
              id="wl-email-domain"
              value={emailDomain}
              onChange={(e) => {
                setEmailDomain(e.target.value);
                if (domainError) setDomainError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) saveChoice();
              }}
              placeholder="yourcompany.com"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!domainError}
              className={cn(
                "h-11 w-full rounded-xl border bg-[#15151b] px-3 font-mono text-[13px] text-white outline-none transition-colors placeholder:text-[#4a4a58]",
                domainError
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-[#2a2a35] focus:border-brand/40",
              )}
            />
            {domainError ? (
              <p className="mt-1.5 text-xs text-red-400">{domainError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-[#6a6a7a]">
                Mail sends as hello@{emailDomain || "yourcompany.com"}.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
          >
            Skip this step
          </button>
          <button
            type="button"
            onClick={saveChoice}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Continue
          </button>
        </div>
      </>,
    );
  }

  // ── 3B / 3C / 3D: the five records ──
  const showFailure = attempted && !verified && records.length > 0;

  return card(
    <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full bg-[#F97316]" />
          <span className="truncate text-sm font-semibold text-white">
            {fromAddress}
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
              onClick={changeChoice}
              className="text-[13px] text-[#8b8ba3] transition-colors hover:text-white"
            >
              Change
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 mt-4 text-xs leading-relaxed text-[#8b8ba3]">
        Add these five records. Same place you added the app domain records.
      </p>

      <div className="space-y-2.5">
        {records.length ? (
          records.map((r, i) => (
            <DnsRecordRow
              key={`${r.type}-${r.name}-${i}`}
              record={r}
              onCopy={copy}
              wrap
            />
          ))
        ) : (
          <p className="rounded-xl border border-[#2a2a35] bg-[#15151b] p-3 text-xs text-[#8b8ba3]">
            No DNS records returned yet. Go back and re-save the domain to
            generate them.
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

      {verified && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">
            Email will send from {fromAddress}.
          </span>
        </div>
      )}

      {showFailure && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3.5 text-xs leading-relaxed text-red-300">
          We can&apos;t see {missing} of {records.length} records yet. If you
          just added them, wait a few minutes and try again.
        </div>
      )}

      {verified ? (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-[#F97316] px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg transition-colors hover:bg-[#ea580c]"
          >
            Finish setup
          </button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-between">
          {showFailure ? (
            <a
              href="mailto:support@garage.app?subject=Email%20DNS%20verification"
              className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
            >
              Get help
            </a>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="text-xs font-medium text-[#8b8ba3] transition-colors hover:text-white"
            >
              Finish and verify later
            </button>
          )}
          <button
            type="button"
            onClick={() => verify()}
            disabled={verifying}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-6 py-2.5 text-[13px] font-semibold text-white shadow-lg transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {verifying
              ? "Verifying…"
              : showFailure
                ? "Try again"
                : "Verify records"}
          </button>
        </div>
      )}
    </>,
  );
}
