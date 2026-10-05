"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { OrgMemberLite } from "@/store/docusign/docusignStore";
import { RecipientPicker } from "@/components/dashboard/docusign/internal/RecipientPicker";
import { MAX_SEPARATE_COPIES, RECIPIENT_COLORS } from "@/components/dashboard/docusign/shared/recipientConstants";
import { MAX_BUNDLE_RECIPIENTS, type DsDeliveryMode } from "@/lib/docusign/types";

export interface RecipientDraft {
  userId: string;
  email: string;
  name?: string;
  order: number;
}

interface RecipientsPanelProps {
  orgMembers: OrgMemberLite[];
  // Fetches the organisation's members; called only when the "Add a recipient" list is first opened.
  onLoadMembers: () => Promise<boolean>;
  recipients: RecipientDraft[];
  onChange: (recipients: RecipientDraft[]) => void;
  signingOrder: "sequential" | "parallel";
  onSigningOrderChange: (order: "sequential" | "parallel") => void;
  deliveryMode: DsDeliveryMode;
  onDeliveryModeChange: (mode: DsDeliveryMode) => void;
  disabled?: boolean;
  // Documents sent together as a group: the same people on every document, everyone signs at once, at most
  // MAX_BUNDLE_RECIPIENTS people — so delivery mode and signing order aren't choices here.
  grouped?: boolean;
}

export function RecipientsPanel({
  orgMembers,
  onLoadMembers,
  recipients,
  onChange,
  signingOrder,
  onSigningOrderChange,
  deliveryMode,
  onDeliveryModeChange,
  disabled,
  grouped,
}: RecipientsPanelProps) {
  const addedIds = useMemo(() => recipients.map((r) => r.userId), [recipients]);
  const separate = !grouped && deliveryMode === "separate";
  // A separate-copies document has one signer per copy, so "who signs first" doesn't exist — nor does it in a
  // group, where everyone signs at once.
  const ordered = signingOrder === "sequential" && !separate && !grouped;
  const atCopyLimit = separate && recipients.length >= MAX_SEPARATE_COPIES;
  const atGroupLimit = !!grouped && recipients.length >= MAX_BUNDLE_RECIPIENTS;

  const addRecipient = (member: OrgMemberLite) => {
    if (recipients.some((r) => r.userId === member._id)) return;
    if (atCopyLimit || atGroupLimit) return;
    onChange([...recipients, { userId: member._id, email: member.email, name: member.name, order: recipients.length + 1 }]);
  };

  const removeRecipient = (userId: string) => {
    onChange(
      recipients
        .filter((r) => r.userId !== userId)
        .map((r, idx) => ({ ...r, order: idx + 1 }))
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...recipients];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((r, idx) => ({ ...r, order: idx + 1 })));
  };

  return (
    <div className="space-y-4">
      {grouped && (
        <div className="rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
          <p className="text-sm font-semibold text-white/90">Same people on every document</p>
          <p className="mt-0.5 text-xs text-[#7a7a90]">
            Everyone here gets all the documents in one email and signs at any time. Up to {MAX_BUNDLE_RECIPIENTS} people.
          </p>
        </div>
      )}

      {!grouped && (
      <div className="space-y-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
        <Label className="text-sm font-semibold text-white/90">Delivery</Label>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Delivery">
          {(
            [
              { mode: "shared", label: "One shared document" },
              { mode: "separate", label: "Separate copy each" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={deliveryMode === mode}
              disabled={disabled}
              onClick={() => deliveryMode !== mode && onDeliveryModeChange(mode)}
              className={`rounded-md border px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                deliveryMode === mode ? "border-brand bg-brand text-[#141414]" : "border-[#2a2a35] text-[#8a8a9b] hover:border-[#3b3b4a]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#7a7a90]">
          {separate
            ? `Everyone gets their own copy with the same fields, signed and completed on its own. If one person declines, the others aren't affected. Up to ${MAX_SEPARATE_COPIES} people.`
            : "Everyone signs the same document. It completes once all of them have signed."}
        </p>
      </div>
      )}

      {!separate && !grouped && (
        <div className="flex items-center justify-between rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
          <div>
            <Label className="text-sm font-semibold text-white/90">Sequential signing</Label>
            <p className="text-xs text-[#7a7a90]">
              {signingOrder === "sequential" ? "Recipients sign one after another, in order." : "All recipients can sign at any time."}
            </p>
          </div>
          <Switch
            checked={signingOrder === "sequential"}
            onCheckedChange={(checked) => onSigningOrderChange(checked ? "sequential" : "parallel")}
            disabled={disabled}
          />
        </div>
      )}

      <div className="space-y-2">
        {recipients.map((r, idx) => (
          <div key={r.userId} className="flex items-center gap-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2">
            {ordered && (
              <div className="flex flex-col text-[#7a7a90]">
                <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} disabled={disabled || idx === 0} className="disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(idx, 1)}
                  disabled={disabled || idx === recipients.length - 1}
                  className="disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}
            />
            {ordered && (
              <Badge variant="outline" className="shrink-0">
                {idx + 1}
              </Badge>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white/90">{r.name || r.email}</p>
              <p className="truncate text-xs text-[#7a7a90]">{r.email}</p>
            </div>
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecipient(r.userId)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!disabled && !atCopyLimit && !atGroupLimit && (
        <RecipientPicker members={orgMembers} excludeIds={addedIds} onLoadMembers={onLoadMembers} onPick={addRecipient} />
      )}
      {atCopyLimit && <p className="text-xs text-amber-400">Limit reached: separate copies support up to {MAX_SEPARATE_COPIES} people.</p>}
      {atGroupLimit && <p className="text-xs text-amber-400">Limit reached: documents sent together can go to up to {MAX_BUNDLE_RECIPIENTS} people.</p>}
    </div>
  );
}
