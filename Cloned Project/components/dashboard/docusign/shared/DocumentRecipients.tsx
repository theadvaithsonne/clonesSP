"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Who a document was sent to, for the Dashboard's "Recent documents", Agreements and External Signatures lists.
// Each row gets a small toggle that expands the full list of recipients (name, email, status); a switch in the
// list's header shows or hides them for every row at once, and remembers the choice.

export interface RecipientSummary {
  name?: string;
  email: string;
  status: string;
  // Signing position; only shown when the document is sequential.
  order?: number;
}

const STORAGE_KEY = "docusign:show-recipients";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-[#5a5a72]",
  viewed: "bg-blue-400",
  signed: "bg-emerald-400",
  declined: "bg-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
};

// Header switch state (remembered across visits) plus a per-row override, so a row can be opened or closed on
// its own after the switch has set them all. Flipping the switch resets every override.
export function useRecipientToggles() {
  const [showAll, setShowAllState] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setShowAllState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable (private window, blocked): just start collapsed */
    }
  }, []);

  const setShowAll = useCallback((value: boolean) => {
    setShowAllState(value);
    setOverrides({});
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* not remembered, still works for this visit */
    }
  }, []);

  const isExpanded = (id: string) => overrides[id] ?? showAll;
  const toggle = (id: string) => setOverrides((prev) => ({ ...prev, [id]: !(prev[id] ?? showAll) }));

  return { showAll, setShowAll, isExpanded, toggle };
}

export function ShowRecipientsSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#8a8a9b]" onClick={(e) => e.stopPropagation()}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label="Show recipients" />
      Show recipients
    </label>
  );
}

// The per-row button: "3 recipients · alice@x.com +2" collapsed, and a list of everyone when opened. It sits inside
// a clickable row, so it must not open the document.
export function RecipientsToggle({
  recipients,
  expanded,
  onToggle,
}: {
  recipients: RecipientSummary[] | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  // undefined = the server did not send them (an older backend): show nothing rather than a wrong "none".
  if (!recipients) return null;
  if (!recipients.length) return <span className="text-[11px] text-[#8a8a9b]">No recipients yet</span>;

  const n = recipients.length;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? "Hide recipients" : "Show recipients"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="-ml-1 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-[11px] text-[#8a8a9b] transition-colors hover:bg-white/[0.06] hover:text-white/90"
    >
      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
      <span className="shrink-0">
        {n} recipient{n === 1 ? "" : "s"}
      </span>
      {!expanded && (
        <span className="truncate text-white/45">
          · {recipients[0].email}
          {n > 1 ? ` +${n - 1}` : ""}
        </span>
      )}
    </button>
  );
}

// Everyone the document was sent to, one line each: signing position (sequential only), status dot, name and
// email, and the status in words.
export function RecipientsList({ recipients, showOrder }: { recipients: RecipientSummary[]; showOrder?: boolean }) {
  return (
    <ul data-testid="recipients-list" className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {recipients.map((r, i) => (
        <li key={`${r.email}-${i}`} className="flex items-center gap-2 text-[11px]" title={r.email}>
          {showOrder && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2a2a35] text-[10px] text-[#8a8a9b]">
              {r.order ?? i + 1}
            </span>
          )}
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[r.status] || "bg-[#5a5a72]")} />
          <span className="min-w-0 truncate text-[#c4c4d4]">
            {r.name && r.name !== r.email ? (
              <>
                {r.name} <span className="text-white/45">{r.email}</span>
              </>
            ) : (
              r.email
            )}
          </span>
          <span className="ml-auto shrink-0 text-white/45">{STATUS_LABEL[r.status] ?? r.status}</span>
        </li>
      ))}
    </ul>
  );
}
