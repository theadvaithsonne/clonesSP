"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  GOLD,
  Select,
  TextArea,
  TextInput,
  useConfirm,
} from "../ui";
import { getOrgId } from "@/lib/auth";
import { createCampaign } from "@/lib/network-mail-campaigns-api";
import { getCampaignAudience, getCampaignRecipients } from "../api";
import type { EventMetrics, EventProgram } from "../types";

const AUDIENCES = [
  { value: "all", label: "Everyone registered" },
  { value: "approved", label: "Approved attendees" },
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "paid", label: "Paid ticket holders" },
];

/**
 * Starting points for the subject and a first draft of the body. Not email
 * templates — those live in NetworkMail, which is where the campaign is
 * finished and sent. Scheduling is NetworkMail's too, so nothing here queues
 * anything.
 */
const TEMPLATES: Array<{
  key: string;
  label: string;
  subject: (e: EventProgram) => string;
  body: (e: EventProgram) => string;
}> = [
  {
    key: "announce",
    label: "Announcement",
    subject: (e) => `${e.name} — you're on the list`,
    body: (e) =>
      `We're getting everything ready for ${e.name}.\n\nHere's what to expect and how to plan your day.`,
  },
  {
    key: "week",
    label: "One week to go",
    subject: (e) => `One week until ${e.name}`,
    body: (e) =>
      `${e.name} is a week away.\n\nDouble-check your travel and bring your ticket QR code — you'll need it at the door.`,
  },
  {
    key: "day",
    label: "Day-before reminder",
    subject: (e) => `See you tomorrow at ${e.name}`,
    body: (e) =>
      `Doors open tomorrow.\n\nHave your QR ticket ready on your phone, and arrive 20 minutes early to clear check-in.`,
  },
  {
    key: "thanks",
    label: "Thank you / follow-up",
    subject: (e) => `Thanks for coming to ${e.name}`,
    body: () =>
      `Thanks for joining us.\n\nWe'd love your feedback — reply to this email and tell us what worked and what didn't.`,
  },
];

export default function CampaignsSection({
  event,
  metrics,
  onOpenNetworkMail,
}: {
  event: EventProgram;
  metrics: EventMetrics | null;
  /** Hands the founder to NetworkMail once the draft campaign exists. */
  onOpenNetworkMail?: (campaignId: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [audience, setAudience] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    getCampaignAudience(event._id)
      .then((res) => setCounts(res.counts as unknown as Record<string, number>))
      .catch(() => setCounts({}));
  }, [event._id]);

  const recipientCount = counts[audience] ?? 0;

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and a message");
      return;
    }
    const ok = await confirm({
      title: `Send to ${recipientCount} ${
        recipientCount === 1 ? "person" : "people"
      }?`,
      message:
        "The draft opens in NetworkMail with these recipients already loaded. You pick the template and send from there — nothing goes out yet.",
      confirmLabel: "Open in NetworkMail",
      destructive: false,
    });
    if (!ok) return;

    const orgId = getOrgId();
    if (!orgId) {
      toast.error("No organization selected");
      return;
    }

    setSending(true);
    try {
      // Events know WHO; NetworkMail knows HOW. The list is resolved here and
      // handed over as manual recipients, so the send goes through the same
      // templates, scheduling, unsubscribe and reporting as every other
      // campaign in the org.
      const { recipients } = await getCampaignRecipients(event._id, audience);
      if (recipients.length === 0) {
        toast.error("Nobody matches that audience yet");
        return;
      }

      const label =
        AUDIENCES.find((a) => a.value === audience)?.label || "Registrants";
      const campaign = await createCampaign(orgId, {
        campaignName: `${event.name} — ${label}`,
        subjectLine: subject.trim(),
        previewText: body.trim().split("\n")[0]?.slice(0, 140) || undefined,
        recipients: {
          source: "manual",
          manualEmails: recipients.map((r) => r.email),
          recipientCount: recipients.length,
          netRecipientCount: recipients.length,
          exclusions: {
            excludeUnsubscribed: true,
            excludeBounced: true,
          },
        },
        schedule: { type: "now" },
      });

      toast.success(`Draft created in NetworkMail for ${recipients.length} recipients`);
      onOpenNetworkMail?.(campaign.id);
      setSubject("");
      setBody("");
    } catch (err: any) {
      toast.error(err?.message || "Could not create the campaign");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="space-y-4">
            <Select
              label="Audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              options={AUDIENCES.map((a) => ({
                value: a.value,
                label: `${a.label} (${counts[a.value] ?? 0})`,
              }))}
            />
            <TextInput
              label="Subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="One week until the summit"
            />
            <TextArea
              label="Message"
              required
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Sketch the message here — you'll finish it in NetworkMail's editor, where the templates and merge tags live."
              hint="Optional. The first line becomes the preview text."
            />

            <div className="flex items-center justify-between border-t border-[#1c1c24] pt-4">
              <span className="flex items-center gap-2 text-xs text-[#7c7d94]">
                <Users className="h-3.5 w-3.5" />
                {recipientCount} {recipientCount === 1 ? "recipient" : "recipients"}
              </span>
              <Button
                loading={sending}
                disabled={!subject.trim() || recipientCount === 0}
                onClick={send}
              >
                <Send className="h-4 w-4" />
                Open in NetworkMail
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Mail className="h-4 w-4" style={{ color: GOLD }} />
              Start from a draft
            </h2>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setSubject(t.subject(event));
                    setBody(t.body(event));
                  }}
                  className="w-full rounded-lg border border-[#26262f] bg-[#101014] px-4 py-3 text-left text-sm text-[#c7c7da] transition-colors hover:border-[#3a3a48] hover:text-white"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#61627a]">
              These fill the composer. Scheduling, throttling and unsubscribe
              handling all happen in NetworkMail once the draft is there.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-white">Reach so far</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Registered</dt>
                <dd className="text-[#c7c7da]">{metrics?.registrations ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Approved</dt>
                <dd className="text-[#c7c7da]">{metrics?.approved ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7c7d94]">Awaiting review</dt>
                <dd className="text-[#c7c7da]">{metrics?.pendingApproval ?? 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
