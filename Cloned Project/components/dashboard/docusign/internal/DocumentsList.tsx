"use client";

import { DsPagination } from "@/lib/docusign/types";
import { DsDocument } from "@/lib/docusign/internal-api";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { SimplePagination, paginationRangeLabel } from "@/components/dashboard/docusign/shared/SimplePagination";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentsListProps {
  documents: DsDocument[];
  emptyLabel: string;
  onOpen: (id: string) => void;
  // Optional — omitted entirely for views that don't paginate (none currently do,
  // but keeps this component reusable without forcing pagination on every caller).
  pagination?: DsPagination;
  onPageChange?: (page: number) => void;
}

const RECIPIENT_STATUS_DOT: Record<string, string> = {
  pending: "bg-[#5a5a72]",
  viewed: "bg-blue-400",
  signed: "bg-emerald-400",
  declined: "bg-red-400",
};

function RecipientChips({ recipients }: { recipients: NonNullable<DsDocument["recipients"]> }) {
  if (!recipients.length) return <p className="text-[11px] text-[#8a8a9b]">No recipients added yet</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-[#8a8a9b]">Sent to:</span>
      {recipients.map((r) => (
        <span
          key={r.email}
          className="flex items-center gap-1 rounded-full border border-[#2a2a35] bg-[#0c0c10] px-2 py-0.5 text-[11px] text-[#c4c4d4]"
          title={`${r.name || r.email} — ${r.status}`}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", RECIPIENT_STATUS_DOT[r.status] || "bg-[#5a5a72]")} />
          {r.name || r.email}
        </span>
      ))}
    </div>
  );
}

export function DocumentsList({ documents, emptyLabel, onOpen, pagination, onPageChange }: DocumentsListProps) {
  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#8a8a9b]">
        <FileText className="h-8 w-8" />
        <p className="text-xs">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc._id}
          onClick={() => onOpen(doc._id)}
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#2a2a35] bg-[#111116] px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
        >
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#7a7a90]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate text-[13px] text-white/90">{doc.title}</p>
            <p className="text-[11px] text-white/45">
              {new Date(doc.updatedAt).toLocaleString()}
              {doc.envelopeId ? ` · Envelope ID: ${doc.envelopeId}` : ""}
            </p>
            {doc.recipients && <RecipientChips recipients={doc.recipients} />}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={doc.myRecipientStatus || doc.status} />
            {doc.status === "completed" && doc.flattenedFileUrl && (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild onClick={(e) => e.stopPropagation()}>
                <a href={doc.flattenedFileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
      </div>
      {pagination && onPageChange && (
        <SimplePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          rangeLabel={paginationRangeLabel(pagination)}
          onPrev={() => onPageChange(pagination.page - 1)}
          onNext={() => onPageChange(pagination.page + 1)}
        />
      )}
    </div>
  );
}
