"use client";

import { DsAuditLogEntry } from "@/lib/docusign/types";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTION_LABELS: Record<string, string> = {
  created: "Document created",
  sent: "Document sent for signing",
  resent: "Reminder resent",
  viewed: "Viewed the document",
  field_signed: "Filled in a field",
  consent_given: "Consented to sign electronically",
  email_verification_sent: "Verification code emailed",
  email_verified: "Verified their email address",
  email_verification_failed: "Email verification failed (too many incorrect codes)",
  signed: "Signed the document",
  declined: "Declined to sign",
  voided: "Document voided",
  completed: "All parties signed — document completed",
  downloaded: "Downloaded a document file",
  integrity_verified: "Ran the integrity check",
  original_integrity_checked: "Original document did not match the uploaded file",
  evidence_exported: "Downloaded the evidence package",
};

interface AuditTrailViewProps {
  entries: DsAuditLogEntry[];
  // Newest-first list, so "load earlier" only ever appends further down — nothing shifts position under the
  // reader, unlike prepending older rows above the ones already on screen.
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function AuditTrailView({ entries, hasMore, isLoadingMore, onLoadMore }: AuditTrailViewProps) {
  if (!entries.length) {
    return <p className="text-xs text-[#8a8a9b]">No activity recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry._id} className="flex items-start gap-3 rounded-2xl border border-[#2a2a35] bg-[#111116] p-3">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-[#7a7a90]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/90">{ACTION_LABELS[entry.action] || entry.action}</p>
            <p className="text-xs text-[#7a7a90]">
              {entry.actorName || entry.actorEmail || entry.actorUserId} · {new Date(entry.createdAt).toLocaleString()}
              {entry.ip ? ` · ${entry.ip}` : ""}
            </p>
            {entry.userAgent && <p className="truncate text-[10px] text-white/45">{entry.userAgent}</p>}
          </div>
        </div>
      ))}
      {hasMore && (
        <Button variant="outline" size="sm" className="w-full" disabled={isLoadingMore} onClick={onLoadMore}>
          {isLoadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load earlier activity"}
        </Button>
      )}
    </div>
  );
}
