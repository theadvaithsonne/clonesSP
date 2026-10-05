"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, UserPlus } from "lucide-react";
import { RECIPIENT_COLORS, MAX_SEPARATE_COPIES } from "@/components/dashboard/docusign/shared/recipientConstants";
import { MAX_BUNDLE_RECIPIENTS, type DsDeliveryMode } from "@/lib/docusign/types";

export interface ExternalRecipientDraft {
  email: string;
  name?: string;
  order: number;
}

interface ExternalRecipientsPanelProps {
  recipients: ExternalRecipientDraft[];
  onChange: (recipients: ExternalRecipientDraft[]) => void;
  disabled?: boolean;
  // Only meaningful for the send-for-signature path (fillOnBehalf has no concept of separate copies) — so
  // this stays optional and the radio group is simply omitted wherever it isn't passed.
  deliveryMode?: DsDeliveryMode;
  onDeliveryModeChange?: (mode: DsDeliveryMode) => void;
  // Documents sent together as a group: the same people on every document, at most MAX_BUNDLE_RECIPIENTS of them.
  grouped?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Free-text email entry — no orgMembers dropdown, since this flow exists specifically
// for people who are NOT in the org's member list at all.
export function ExternalRecipientsPanel({ recipients, onChange, disabled, deliveryMode, onDeliveryModeChange, grouped }: ExternalRecipientsPanelProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const separate = deliveryMode === "separate";
  const atCopyLimit = separate && recipients.length >= MAX_SEPARATE_COPIES;
  const atGroupLimit = !!grouped && recipients.length >= MAX_BUNDLE_RECIPIENTS;

  const addRecipient = () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) return;
    if (recipients.some((r) => r.email.toLowerCase() === trimmed.toLowerCase())) return;
    if (atCopyLimit || atGroupLimit) return;
    onChange([...recipients, { email: trimmed, name: name.trim() || undefined, order: recipients.length + 1 }]);
    setEmail("");
    setName("");
  };

  const removeRecipient = (recipientEmail: string) => {
    onChange(recipients.filter((r) => r.email !== recipientEmail).map((r, idx) => ({ ...r, order: idx + 1 })));
  };

  return (
    <div className="space-y-4">
      {grouped && (
        <div className="rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
          <p className="text-sm font-semibold text-white/90">Same people on every document</p>
          <p className="mt-0.5 text-xs text-[#7a7a90]">
            Each person gets one email with a single link to sign all the documents. Up to {MAX_BUNDLE_RECIPIENTS} people.
          </p>
        </div>
      )}
      {!grouped && deliveryMode && onDeliveryModeChange && (
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

      <div className="space-y-2">
        {recipients.map((r, idx) => (
          <div key={r.email} className="flex items-center gap-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white/90">{r.name || r.email}</p>
              <p className="truncate text-xs text-[#7a7a90]">{r.email}</p>
            </div>
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecipient(r.email)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <div className="space-y-2 rounded-md border border-[#2a2a35] bg-[#0c0c10] p-3">
          <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
          />
          <Button variant="outline" size="sm" className="w-full" onClick={addRecipient} disabled={!EMAIL_RE.test(email.trim()) || atCopyLimit || atGroupLimit}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add recipient
          </Button>
          {atCopyLimit && <p className="text-xs text-amber-400">Limit of {MAX_SEPARATE_COPIES} recipients reached for separate copies.</p>}
          {atGroupLimit && <p className="text-xs text-amber-400">Limit of {MAX_BUNDLE_RECIPIENTS} recipients reached for documents sent together.</p>}
        </div>
      )}
    </div>
  );
}
