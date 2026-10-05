"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/DataTable";
import { Avatar } from "@/components/ui/data-table/cells";
import type { ColumnDef } from "@/components/ui/data-table/types";
import { StatusBadge } from "@/components/dashboard/docusign/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { DsDocument, listAllInOrg } from "@/lib/docusign/internal-api";
import { DsExternalDocument, listMyExternalDocuments } from "@/lib/docusign/external-api";

const PAGE_SIZE = 10;
type Tab = "internal" | "external";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ExportRow {
  title: string;
  owner: string;
  email: string;
  status: string;
  recipients: string;
  delivery: string;
  sent: string;
}

function downloadCsv(rows: ExportRow[], filenamePrefix: string) {
  const header = ["Title", "Owner", "Email", "Status", "Recipients", "Delivery", "Sent"];
  const lines = rows.map((r) =>
    [r.title, r.owner, r.email, r.status, r.recipients, r.delivery, r.sent].map((v) => `"${v.replace(/"/g, '""')}"`).join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-brand text-[#141414]" : "text-[#8a8a9b] hover:text-white/80"
      )}
    >
      {children}
    </button>
  );
}

function SearchExportBar({ search, onSearch, onExport, exportDisabled }: { search: string; onSearch: (v: string) => void; onExport: () => void; exportDisabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a7a90]" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search documents..."
          className="h-8 w-48 rounded-lg border border-[#2a2a35] bg-[#0c0c10] pl-8 pr-2.5 text-xs text-white/85 placeholder:text-[#5a5a72] focus:border-[#3b3b4a] focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#0c0c10] px-2.5 text-xs text-white/70 transition-colors hover:text-white/90 disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
    </div>
  );
}

function TitleCell({ title }: { title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <FileText className="h-4 w-4 shrink-0 text-[#7a7a90]" />
      <span className="truncate text-[13px] text-white/90">{title}</span>
    </div>
  );
}

function InternalTable({ onOpen }: { onOpen: (doc: DsDocument) => void }) {
  const [rows, setRows] = useState<DsDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAllInOrg(undefined, page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data || []);
        setTotal(res.pagination?.total ?? (res.data || []).length);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (doc) =>
        (doc.title || "").toLowerCase().includes(q) ||
        (doc.ownerName || "").toLowerCase().includes(q) ||
        (doc.ownerEmail || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: ColumnDef<DsDocument>[] = [
    { id: "title", header: "Document", minWidth: 220, cell: (doc) => <TitleCell title={doc.title} /> },
    {
      id: "owner",
      header: "Owner",
      minWidth: 200,
      vAlign: "top",
      cell: (doc) => (
        <div className="flex min-w-0 items-start gap-2.5">
          <Avatar src={doc.ownerImage} name={doc.ownerName || doc.ownerEmail} size={28} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium text-white/90">{doc.ownerName || "—"}</p>
            {doc.ownerEmail ? <p className="truncate text-[11px] text-white/45">{doc.ownerEmail}</p> : null}
          </div>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (doc) => <StatusBadge status={doc.status} /> },
    {
      id: "recipients",
      header: "Recipients",
      align: "right",
      cell: (doc) => <span className="tabular-nums text-[13px] text-white/70">{doc.recipients?.length ?? "—"}</span>,
    },
    {
      id: "delivery",
      header: "Delivery",
      cell: (doc) => <span className="text-[13px] text-white/70">{doc.deliveryMode === "separate" ? "Separate" : "Shared"}</span>,
    },
    { id: "sent", header: "Sent", cell: (doc) => <span className="text-[13px] text-white/70">{formatDate(doc.sentAt || doc.createdAt)}</span> },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportRows: ExportRow[] = filtered.map((doc) => ({
    title: doc.title,
    owner: doc.ownerName || "",
    email: doc.ownerEmail || "",
    status: doc.status,
    recipients: String(doc.recipients?.length ?? ""),
    delivery: doc.deliveryMode === "separate" ? "Separate" : "Shared",
    sent: formatDate(doc.sentAt || doc.createdAt),
  }));

  return (
    <DataTable<DsDocument>
      tableId="docusign-analytics-recent-internal"
      columns={columns}
      rows={filtered}
      getRowId={(doc) => doc._id}
      loading={loading}
      emptyLabel="No documents yet"
      onRowClick={(doc) => onOpen(doc)}
      topBar={<SearchExportBar search={search} onSearch={setSearch} onExport={() => downloadCsv(exportRows, "internal-documents")} exportDisabled={!exportRows.length} />}
      pagination={{
        page,
        totalPages,
        rangeLabel: total ? `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, total)} of ${total}` : "0 of 0",
        onPrev: () => setPage((p) => Math.max(1, p - 1)),
        onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      }}
    />
  );
}

function ExternalTable({ onOpen }: { onOpen: (doc: DsExternalDocument) => void }) {
  const [rows, setRows] = useState<DsExternalDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMyExternalDocuments(page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data || []);
        setTotal(res.pagination?.total ?? (res.data || []).length);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((doc) => (doc.title || "").toLowerCase().includes(q));
  }, [rows, search]);

  // The external (esign) flow has no owner name/email/image on its list rows today — recipients
  // there are outside emails, not org members, and this list has never carried a sender join the
  // way the internal one does (see withOwnerInfo on the internal side). Recipients count is shown
  // where available; a per-document "Sent to" summary isn't in the payload here, so it's omitted
  // rather than guessed.
  const columns: ColumnDef<DsExternalDocument>[] = [
    { id: "title", header: "Document", minWidth: 260, cell: (doc) => <TitleCell title={doc.title} /> },
    { id: "status", header: "Status", cell: (doc) => <StatusBadge status={doc.status} /> },
    {
      id: "recipients",
      header: "Recipients",
      align: "right",
      cell: (doc) => <span className="tabular-nums text-[13px] text-white/70">{doc.recipients?.length ?? "—"}</span>,
    },
    {
      id: "delivery",
      header: "Delivery",
      cell: (doc) => <span className="text-[13px] text-white/70">{doc.deliveryMode === "separate" ? "Separate" : "Shared"}</span>,
    },
    { id: "sent", header: "Sent", cell: (doc) => <span className="text-[13px] text-white/70">{formatDate(doc.sentAt || doc.createdAt)}</span> },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportRows: ExportRow[] = filtered.map((doc) => ({
    title: doc.title,
    owner: "",
    email: "",
    status: doc.status,
    recipients: String(doc.recipients?.length ?? ""),
    delivery: doc.deliveryMode === "separate" ? "Separate" : "Shared",
    sent: formatDate(doc.sentAt || doc.createdAt),
  }));

  return (
    <DataTable<DsExternalDocument>
      tableId="docusign-analytics-recent-external"
      columns={columns}
      rows={filtered}
      getRowId={(doc) => doc._id}
      loading={loading}
      emptyLabel="No external documents yet"
      onRowClick={(doc) => onOpen(doc)}
      topBar={<SearchExportBar search={search} onSearch={setSearch} onExport={() => downloadCsv(exportRows, "external-documents")} exportDisabled={!exportRows.length} />}
      pagination={{
        page,
        totalPages,
        rangeLabel: total ? `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, total)} of ${total}` : "0 of 0",
        onPrev: () => setPage((p) => Math.max(1, p - 1)),
        onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
      }}
    />
  );
}

// Hands the caller the whole row so it can seed the field editor (see documentSeed.ts).
export function RecentDocumentsTable({ onOpen }: { onOpen: (doc: DsDocument | DsExternalDocument, kind: Tab) => void }) {
  const [tab, setTab] = useState<Tab>("internal");

  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#111116] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/90">Recent Documents</h3>
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] bg-[#0c0c10] p-1">
          <TabButton active={tab === "internal"} onClick={() => setTab("internal")}>
            Internal
          </TabButton>
          <TabButton active={tab === "external"} onClick={() => setTab("external")}>
            External
          </TabButton>
        </div>
      </div>
      {tab === "internal" ? <InternalTable onOpen={(doc) => onOpen(doc, "internal")} /> : <ExternalTable onOpen={(doc) => onOpen(doc, "external")} />}
    </div>
  );
}
