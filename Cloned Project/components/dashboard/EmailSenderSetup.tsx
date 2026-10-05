"use client";

/**
 * White-label sender domain (Resend).
 *
 * Lets a founder send this office's transactional mail — invites, approvals,
 * notifications — from their OWN domain instead of Garage's.
 *
 * Deliberately distinct from the Mailcow setup on the same page, and the copy
 * says so, because the two look interchangeable and are not:
 *
 *   Mailcow  — mailboxes. Receiving, IMAP, a real account someone logs into.
 *   Resend   — outbound only. No inbox.
 *
 * Both can run on the same domain. That is exactly why the SPF record shown
 * here may differ from the raw value Resend returns: a domain may publish only
 * one SPF record, so the backend merges Resend's include into any existing one
 * (see services/resendDomains.ts). Publishing both separately would break mail
 * for both senders with nothing in any log to explain it.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface SenderDnsRecord {
  record?: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
  merged?: boolean;
}

interface EmailSender {
  domain?: string;
  status?: string;
  fromEmail?: string;
  fromName?: string;
  dnsRecords?: SenderDnsRecord[];
  verifiedAt?: string;
}

export default function EmailSenderSetup({ orgId }: { orgId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sender, setSender] = useState<EmailSender | null>(null);
  const [domain, setDomain] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api<{ configured: boolean; emailSender: EmailSender | null }>(
        `/initial-setup/email-sender?orgId=${encodeURIComponent(orgId)}`
      );
      setSender(res.emailSender);
      if (res.emailSender?.domain) setDomain(res.emailSender.domain);
      if (res.emailSender?.fromEmail) setFromEmail(res.emailSender.fromEmail);
    } catch {
      // Not configured yet, or the org has no access — the empty state covers
      // both without an alarming error.
      setSender(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const addDomain = async () => {
    if (!orgId || !domain.trim()) return;
    setSaving(true);
    try {
      const res = await api<{ emailSender: EmailSender; spfMerged: boolean }>(
        "/initial-setup/email-sender",
        {
          method: "POST",
          body: JSON.stringify({
            orgId,
            domain: domain.trim(),
            fromEmail: fromEmail.trim() || undefined,
          }),
        }
      );
      setSender(res.emailSender);
      toast.success(
        res.spfMerged
          ? "Domain added — your existing SPF record was merged, not replaced"
          : "Domain added — now add the DNS records below"
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not add domain");
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    if (!orgId) return;
    setVerifying(true);
    try {
      const res = await api<{ status: string; emailSender: EmailSender }>(
        "/initial-setup/email-sender/verify",
        { method: "POST", body: JSON.stringify({ orgId }) }
      );
      setSender(res.emailSender);
      if (res.status === "verified") {
        toast.success("Domain verified — mail will now send from your domain");
      } else {
        // DNS propagation is slow and Resend's check is asynchronous, so
        // "not yet" is the normal answer for a while, not a failure.
        toast.message("Not verified yet", {
          description:
            "DNS can take up to an hour to propagate. Try again shortly.",
        });
      }
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const status = sender?.status;
  const isVerified = status === "verified";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#13131a] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-blue-500/10 p-1.5">
          <Mail className="h-4 w-4 text-blue-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Sending domain</h3>
        {isVerified && (
          <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/15">
            Verified
          </Badge>
        )}
        {sender?.domain && !isVerified && (
          <Badge variant="outline" className="text-xs text-amber-400">
            {status === "pending" ? "Pending DNS" : status || "Not started"}
          </Badge>
        )}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-gray-400">
        Send this office&apos;s emails from your own domain. This is outbound
        only — it doesn&apos;t create mailboxes or receive mail, so it sits
        alongside your NetworkMail setup rather than replacing it.
      </p>

      {!sender?.domain ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
              Domain
            </label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="h-9 border-[#2a2a35] bg-[#0e0e12] text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
              From address (optional)
            </label>
            <Input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder={`noreply@${domain.trim() || "example.com"}`}
              className="h-9 border-[#2a2a35] bg-[#0e0e12] text-sm text-white"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Must be on the domain above. Defaults to noreply@ if left blank.
            </p>
          </div>
          <Button
            onClick={addDomain}
            disabled={saving || !domain.trim()}
            className="h-9 w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Add domain
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-[#0e0e12] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-white">
                {sender.domain}
              </p>
              <p className="truncate text-[11px] text-gray-500">
                Sending as {sender.fromEmail}
              </p>
            </div>
            {!isVerified && (
              <Button
                onClick={verify}
                disabled={verifying}
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-[#2a2a35] text-gray-300"
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Check DNS</span>
              </Button>
            )}
          </div>

          {isVerified ? (
            <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              <p className="text-xs text-green-300">
                Verified. This office&apos;s emails now send from{" "}
                <span className="font-mono">{sender.fromEmail}</span>.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-200/90">
                  Add these at your DNS provider, then press Check DNS. Until
                  it verifies, mail keeps sending from the Garage address —
                  nothing breaks in the meantime.
                </p>
              </div>

              <div className="space-y-2">
                {(sender.dnsRecords || []).map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#2a2a35] bg-[#0e0e12] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        Type
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {r.type}
                      </Badge>
                      {r.record && (
                        <span className="text-[11px] text-gray-500">
                          {r.record}
                        </span>
                      )}
                      {/*
                        Flagged because this value is NOT what Resend returned:
                        it carries the domain's existing SPF too. Pasting
                        Resend's raw record instead would break the other
                        sender on this domain.
                      */}
                      {r.merged && (
                        <span className="ml-auto text-[11px] text-blue-300">
                          merged with your existing SPF
                        </span>
                      )}
                    </div>

                    {[
                      { label: "Name / Host", value: r.name },
                      { label: "Value", value: r.value },
                    ].map((f) => (
                      <div key={f.label} className="flex items-start gap-2 py-1">
                        <span className="w-24 shrink-0 pt-0.5 text-[11px] uppercase tracking-wide text-gray-500">
                          {f.label}
                        </span>
                        <code className="min-w-0 flex-1 break-all font-mono text-xs text-gray-200">
                          {f.value}
                        </code>
                        <Button
                          onClick={() => copy(f.value, f.label)}
                          size="sm"
                          variant="ghost"
                          title={`Copy ${f.label}`}
                          className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {r.priority != null && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Priority: {r.priority}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
                      Enter the Name exactly as shown — most providers add{" "}
                      <span className="font-mono">.{sender.domain}</span> for
                      you.
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
