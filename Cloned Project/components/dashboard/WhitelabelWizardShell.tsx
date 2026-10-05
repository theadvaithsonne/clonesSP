"use client";

// Shared chrome for the whitelabel setup wizard: the 4-segment progress
// rail, the step counter, the title block and the DNS record row used by
// both the app-domain and the email steps. Every step renders inside this
// so the header never shifts between screens — only the body swaps.

import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export const WIZARD_TOTAL_STEPS = 4;

export function WizardProgress({
  step,
  complete = false,
}: {
  step: number;
  /** Final screen: every segment filled, counter replaced by a label. */
  complete?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, i) => {
          const index = i + 1;
          const isCurrent = !complete && index === step;
          const isDone = complete || index < step;
          return (
            <span
              key={index}
              className={cn(
                "h-[3px] rounded-full transition-all",
                complete ? "w-7" : isCurrent ? "w-7" : "w-3.5",
                isCurrent || isDone ? "bg-[#F97316]" : "bg-[#2a2a35]",
              )}
            />
          );
        })}
      </div>
      <span className="text-[11px] font-medium text-[#6a6a7a]">
        {complete ? "Setup complete" : `Step ${step} of ${WIZARD_TOTAL_STEPS}`}
      </span>
    </div>
  );
}

export function WizardCard({
  step,
  title,
  subtitle,
  badge,
  wide = false,
  complete = false,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  /** Small tag beside the title — "OPTION" on the email step. */
  badge?: string;
  /** Steps with a side-by-side preview need a roomier card. */
  wide?: boolean;
  complete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full w-full items-start justify-center bg-[#0a0a0d] px-4 py-10">
      <div
        className={cn(
          "w-full rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-7 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <WizardProgress step={step} complete={complete} />
        <div className="mt-4 flex items-start justify-between gap-3">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white">
            {title}
          </h1>
          {badge && (
            <span className="mt-1.5 shrink-0 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b8ba3]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8b8ba3]">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}

export type WizardDnsRecord = {
  type: string;
  name: string;
  value: string;
  priority?: number;
  verified: boolean;
};

export function DnsRecordRow({
  record,
  onCopy,
  /** Email records are long (SPF, DMARC) — let them wrap instead of truncating. */
  wrap = false,
}: {
  record: WizardDnsRecord;
  onCopy: (value: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#2a2a35] bg-[#15151b] p-3 text-xs">
      <span className="shrink-0 rounded-md border border-[#2a2a35] bg-[#0e0e12] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#8b8ba3]">
        {record.type}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-[11.5px] font-semibold text-white",
          wrap ? "max-w-[30%] break-all" : "max-w-[42%] truncate",
        )}
      >
        {record.name}
      </span>
      <span className="shrink-0 text-[#4a4a58]">→</span>
      <span
        className={cn(
          "min-w-0 flex-1 font-mono text-[11.5px] text-[#8b8ba3]",
          wrap ? "break-all" : "truncate",
        )}
      >
        {record.value}
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
          record.verified
            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "border border-red-500/20 bg-red-500/10 text-red-400",
        )}
      >
        {record.verified ? "Detected" : "Not detected"}
      </span>
      <button
        type="button"
        onClick={() => onCopy(record.value)}
        aria-label={`Copy ${record.type} record value`}
        title="Copy value"
        className="shrink-0 rounded-md p-1 text-[#6a6a7a] transition-colors hover:bg-white/5 hover:text-white"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Tab-separated, the format DNS providers' bulk import accepts. */
export function formatRecordsForClipboard(records: WizardDnsRecord[]): string {
  return records
    .map((r) => `${r.type}\t${r.name}\t${r.priority ? `${r.priority} ` : ""}${r.value}`)
    .join("\n");
}
