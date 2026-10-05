"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Which surface the section is rendered on. Only changes the copy — the stored
 * shape is identical everywhere (see backend models/founderAlerts.schema.ts).
 */
export type FounderAlertsContext =
  | "community"
  | "course"
  | "product"
  | "workshop"
  | "service"
  | "event";

const COPY: Record<
  FounderAlertsContext,
  { question: string; hint: string }
> = {
  community: {
    question: "Get an email every time someone joins this community?",
    hint: "Sent for every new member — free joins and paid ones.",
  },
  course: {
    question: "Get an email every time someone enrols in this course?",
    hint: "Sent for every new enrolment — free and paid.",
  },
  product: {
    question: "Get an email every time someone buys this product?",
    hint: "Sent for every order, including free claims.",
  },
  workshop: {
    question: "Get an email every time someone registers for this live stream?",
    hint: "Sent for every registration — free and paid.",
  },
  service: {
    question: "Get an email every time someone opts into this service?",
    hint: "Sent for every new client on this service.",
  },
  event: {
    question: "Get an email every time someone registers for this event?",
    hint: "Sent for every registration — free tickets and paid ones.",
  },
};

export interface FounderAlertsValue {
  enabled: boolean;
  /** Extra addresses CC'd alongside you. You are always notified. */
  recipients: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Tell me when someone joins" — the founder's own notification toggle.
 *
 * The seller-side counterpart to `ProductEmailAlertsSection`, which configures
 * the email the BUYER gets. Deliberately has no template picker: this one goes
 * to the founder, not a customer, so the only choices are on/off and who else
 * gets a copy.
 */
export function FounderAlertsSection({
  value,
  onChange,
  context,
}: {
  value: FounderAlertsValue;
  onChange: (next: FounderAlertsValue) => void;
  context: FounderAlertsContext;
}) {
  const { enabled, recipients } = value;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[context];

  const addRecipient = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError("That doesn't look like an email address");
      return;
    }
    if (recipients.includes(email)) {
      setError("Already on the list");
      return;
    }
    onChange({ ...value, recipients: [...recipients, email] });
    setDraft("");
    setError(null);
  };

  const removeRecipient = (email: string) =>
    onChange({
      ...value,
      recipients: recipients.filter((r) => r !== email),
    });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
          Notify Me
        </label>
        <p className="text-sm text-white mb-2">{copy.question}</p>
        <div className="flex rounded-lg border border-[#2a2a35] bg-[#1E1E1E] p-1 w-full max-w-[260px]">
          <button
            type="button"
            onClick={() => onChange({ ...value, enabled: false })}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
              !enabled
                ? "bg-brand text-brand-foreground"
                : "text-[#9fa0b8] hover:text-white",
            )}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...value, enabled: true })}
            className={cn(
              "flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all text-center",
              enabled
                ? "bg-brand text-brand-foreground"
                : "text-[#9fa0b8] hover:text-white",
            )}
          >
            Yes
          </button>
        </div>
        <p className="text-xs text-[#8b8c9d] mt-2">{copy.hint}</p>
      </div>

      {enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="block text-xs font-semibold text-[#8b8c9d] mb-2 uppercase tracking-wide">
              Also notify (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  // Enter must not submit the surrounding form — this input is
                  // adding a chip, not saving the item.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                placeholder="teammate@company.com"
                className="flex-1 h-11 rounded-lg bg-[#1E1E1E] border border-[#2a2a35] px-3 text-sm text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-brand/50"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="h-11 px-4 rounded-lg bg-[#2a2a35] hover:bg-[#3a3a45] text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <p className="text-xs text-[#8b8c9d] mt-2">
              You always get the alert. Add teammates here to copy them in.
            </p>
          </div>

          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1E1E1E] border border-[#2a2a35] pl-3 pr-2 py-1.5 text-xs text-white"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    className="text-[#8b8c9d] hover:text-white transition-colors"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
