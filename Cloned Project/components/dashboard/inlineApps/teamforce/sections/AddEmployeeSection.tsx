"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FileText,
  Upload,
  Mail,
  ArrowLeft,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  listDepartments,
  listBranches,
  listEmployees,
  upsertEmployee,
  sendOrgInvites,
} from "../api";
import type { Section, Department, Branch } from "../types";

interface Props {
  onNavigate: (section: Section, userId?: string) => void;
  initialView?: View;
}

type View = "select" | "bulk" | "invite";

export default function AddEmployeeSection({ onNavigate, initialView }: Props) {
  const [view, setView] = useState<View>(initialView ?? "select");

  if (view === "bulk") {
    return <BulkUploadView onBack={() => setView("select")} />;
  }
  if (view === "invite") {
    return (
      <InviteViaEmailView
        onBack={() =>
          initialView === "invite" ? onNavigate("employees") : setView("select")
        }
      />
    );
  }

  return <SelectionView onNavigate={onNavigate} onSelectView={setView} />;
}

/* ─── Selection screen (3 cards) ─────────────────────────────────────── */

function SelectionView({
  onNavigate,
  onSelectView,
}: {
  onNavigate: (section: Section) => void;
  onSelectView: (v: View) => void;
}) {
  const cards = [
    {
      id: "manual" as const,
      icon: FileText,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      title: "Manual Entry",
      desc: "Add employee details manually through a comprehensive form",
    },
    {
      id: "bulk" as const,
      icon: Upload,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      title: "Bulk Upload",
      desc: "Upload multiple employees at once using CSV or Excel file",
    },
    {
      id: "invite" as const,
      icon: Mail,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      title: "Invite via Email",
      desc: "Invite one or many employees by name and email — singly or via file",
    },
  ];

  return (
    <div>
      <button
        onClick={() => onNavigate("employees")}
        className="flex items-center gap-1.5 text-sm text-[#7a7a7a] hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Employees
      </button>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white">Add Employee</h2>
        <p className="text-sm text-[#7a7a7a] mt-1">Select entry method</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() =>
                card.id === "manual"
                  ? onNavigate("add-employee-form")
                  : onSelectView(card.id)
              }
              className="group text-left p-6 rounded-xl bg-[#141414] border border-white/8
                         hover:border-brand/30 hover:bg-brand/[0.04]
                         active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <div
                className={`h-11 w-11 rounded-xl ${card.iconBg} flex items-center justify-center mb-4`}
              >
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-1.5 group-hover:text-brand transition-colors">
                {card.title}
              </h3>
              <p className="text-[13px] text-[#7a7a7a] leading-relaxed">
                {card.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Bulk Upload view ────────────────────────────────────────────────── */

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

const EMP_TYPE_MAP: Record<string, string> = {
  "full time": "full-time", "full-time": "full-time", "fulltime": "full-time",
  "part time": "part-time", "part-time": "part-time", "parttime": "part-time",
  "contract": "contract", "contractor": "contract",
  "intern": "intern", "internship": "intern",
  "freelance": "freelance", "freelancer": "freelance",
};

function parseDDMMYYYY(val: string): string {
  if (!val) return "";
  // Already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Support dd/mm/yyyy or dd-mm-yyyy
  const sep = val.includes("/") ? "/" : val.includes("-") ? "-" : null;
  if (!sep) return "";
  const parts = val.split(sep);
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function BulkUploadView({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<{ idx: number; cols: string[] }>>([]);
  const [uploadErrors, setUploadErrors] = useState<Array<{ row: number; email: string; reason: string }>>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 10;

  useEffect(() => {
    listDepartments().then((r) => setDepartments(r.departments || [])).catch(() => {});
    listBranches().then((r) => setBranches(r.branches || [])).catch(() => {});
  }, []);

  function applyFile(f: File | null) {
    setFile(f);
    setUploadErrors([]);
    setShowErrors(false);
    setPreviewPage(0);
    if (!f) { setPreviewHeaders([]); setPreviewRows([]); return; }
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only CSV files are supported. Please download the sample template.");
      setPreviewHeaders([]); setPreviewRows([]); setFile(null); return;
    }
    f.text().then((text) => {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 1) return;
      setPreviewHeaders(parseCSVLine(lines[0]));
      setPreviewRows(
        lines.slice(1).filter((l) => l.trim()).map((l, i) => ({ idx: i + 2, cols: parseCSVLine(l) }))
      );
    }).catch(() => {});
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  }

  function downloadTemplate() {
    const headers = ["Full Legal Name", "Mobile Number", "Email ID", "Pan", "Date of Joining", "Place of Joining", "Branch", "Department", "Designation", "Employment Type"];
    const sample = ["Jane Doe", "+91-9999999999", "jane@example.com", "ABCDE1234F", "01/01/2025", "Mumbai", "", "", "Software Engineer", "Full Time"];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) { toast.error("CSV has no data rows"); setUploading(false); return; }

      const rawHeaders = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
      const col = (...names: string[]) => { for (const n of names) { const i = rawHeaders.indexOf(n); if (i !== -1) return i; } return -1; };

      const nameIdx    = col("full legal name", "name");
      const emailIdx   = col("email id", "email");
      const mobileIdx  = col("mobile number", "mobile");
      const panIdx     = col("pan");
      const dojIdx     = col("date of joining", "dateofjoining");
      const pojIdx     = col("place of joining");
      const branchIdx  = col("branch");
      const deptIdx    = col("department");
      const desigIdx   = col("designation");
      const empTypeIdx = col("employment type", "employment_type");

      if (emailIdx === -1) { toast.error("CSV must have an 'Email ID' column"); setUploading(false); return; }

      // Fetch existing org members to detect duplicates
      const existingEmails = new Set<string>();
      try {
        const res = await listEmployees();
        for (const emp of (res.employees || [])) {
          if (emp.email) existingEmails.add(emp.email.toLowerCase());
        }
      } catch { /* proceed without duplicate check if fetch fails */ }

      const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d._id]));
      const branchByName = new Map(branches.map((b) => [b.name.toLowerCase(), b._id]));

      const rows = lines.slice(1).filter((l) => l.trim());
      let ok = 0;
      const errors: Array<{ row: number; email: string; reason: string }> = [];
      const seenInCsv = new Set<string>();

      for (const [rowIdx, row] of rows.entries()) {
        const cols = parseCSVLine(row);
        const email = cols[emailIdx]?.trim();
        if (!email) continue;

        const emailLower = email.toLowerCase();

        if (seenInCsv.has(emailLower)) {
          errors.push({ row: rowIdx + 2, email, reason: "Duplicate email in CSV — skipped" });
          continue;
        }
        seenInCsv.add(emailLower);

        if (existingEmails.has(emailLower)) {
          errors.push({ row: rowIdx + 2, email, reason: "Employee already exists in this organization" });
          continue;
        }

        const payload: Record<string, unknown> = { email };
        const name = nameIdx !== -1 ? cols[nameIdx]?.trim() : "";
        if (name) payload.name = name;
        const mobile = mobileIdx !== -1 ? cols[mobileIdx]?.trim() : "";
        if (mobile) payload.mobileNumber = mobile;
        const pan = panIdx !== -1 ? cols[panIdx]?.trim() : "";
        if (pan) payload.pan = pan;
        const doj = parseDDMMYYYY(dojIdx !== -1 ? cols[dojIdx]?.trim() ?? "" : "");
        if (doj) payload.dateOfJoining = doj;
        const poj = pojIdx !== -1 ? cols[pojIdx]?.trim() : "";
        if (poj) payload.placeOfJoining = poj;
        const branchName = branchIdx !== -1 ? cols[branchIdx]?.trim().toLowerCase() : "";
        if (branchName) { const id = branchByName.get(branchName); if (id) payload.branchId = id; }
        const deptName = deptIdx !== -1 ? cols[deptIdx]?.trim().toLowerCase() : "";
        if (deptName) { const id = deptByName.get(deptName); if (id) payload.departmentId = id; }
        const desig = desigIdx !== -1 ? cols[desigIdx]?.trim() : "";
        if (desig) payload.designation = desig;
        const empTypeRaw = empTypeIdx !== -1 ? cols[empTypeIdx]?.trim() : "";
        if (empTypeRaw) payload.employmentType = EMP_TYPE_MAP[empTypeRaw.toLowerCase()] ?? empTypeRaw;

        try {
          await upsertEmployee(payload);
          ok++;
        } catch (e) {
          errors.push({ row: rowIdx + 2, email, reason: e instanceof Error ? e.message : "Failed to import" });
        }
      }

      if (errors.length === 0) {
        toast.success(`${ok} employee${ok !== 1 ? "s" : ""} imported successfully`);
        onBack();
      } else {
        if (ok > 0) toast.success(`${ok} imported successfully`);
        setUploadErrors(errors);
        setShowErrors(true);
      }
    } catch {
      toast.error("Failed to parse file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {/* Error modal */}
      {showErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
              <div>
                <h4 className="text-[15px] font-semibold text-white">Upload Errors</h4>
                <p className="text-[12px] text-[#7a7a7a] mt-0.5">
                  {uploadErrors.length} row{uploadErrors.length !== 1 ? "s" : ""} failed — page not changed
                </p>
              </div>
              <button
                onClick={() => setShowErrors(false)}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-[#a8a8a8]" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {uploadErrors.map((err) => (
                <div key={err.row} className="p-3 rounded-lg bg-red-500/[0.06] border border-red-500/15">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold text-red-400/70 uppercase tracking-wide">Row {err.row}</span>
                    <span className="text-[12px] text-white font-medium truncate">{err.email}</span>
                  </div>
                  <p className="text-[12px] text-[#7a7a7a] leading-snug">{err.reason}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-white/8 flex-shrink-0 flex justify-end gap-3">
              <button
                onClick={() => setShowErrors(false)}
                className="px-4 py-2 bg-white/[0.05] border border-white/10 text-[#a8a8a8] rounded-lg text-sm hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
              >
                Fix &amp; Retry
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-semibold hover:bg-brand/90 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-[#7a7a7a] hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="bg-[#141414] rounded-xl border border-white/8 p-8 max-w-2xl">
          <h3 className="text-[17px] font-semibold text-white mb-6">Bulk Upload</h3>

          <div className="space-y-6">
            {/* Step 1 */}
            <div>
              <label className="block text-[11px] font-semibold text-[#a8a8a8] uppercase tracking-wider mb-2">
                Step 1: Download Template
              </label>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] text-[#a8a8a8] rounded-lg text-sm
                           hover:bg-white/[0.08] hover:text-white border border-white/8 hover:border-white/15
                           transition-all duration-150 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download Sample Template (CSV)
              </button>
            </div>

            {/* Step 2 */}
            <div>
              <label className="block text-[11px] font-semibold text-[#a8a8a8] uppercase tracking-wider mb-2">
                Step 2: Upload File
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-150 ${
                  dragging
                    ? "border-brand/50 bg-brand/[0.04]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-5 w-5 text-brand" />
                    <span className="text-sm text-white font-medium">{file.name}</span>
                    <button
                      onClick={() => applyFile(null)}
                      className="h-5 w-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-[#5a5a5a] mx-auto mb-3" />
                    <p className="text-sm text-[#7a7a7a] mb-3">
                      Drag and drop your CSV file here, or click to browse
                    </p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id="tf-file-upload"
                      onChange={(e) => applyFile(e.target.files?.[0] || null)}
                    />
                    <label
                      htmlFor="tf-file-upload"
                      className="inline-flex px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-semibold cursor-pointer hover:bg-brand/90 transition-colors"
                    >
                      Choose File
                    </label>
                  </>
                )}
              </div>

              {/* Data preview table */}
              {previewRows.length > 0 && (() => {
                const totalPages = Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE);
                const pageRows = previewRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);
                return (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] text-[#5a5a5a]">
                        {previewRows.length} row{previewRows.length !== 1 ? "s" : ""} detected
                      </p>
                      {totalPages > 1 && (
                        <p className="text-[11px] text-[#5a5a5a]">
                          Page {previewPage + 1} of {totalPages}
                        </p>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-white/8">
                      <table className="w-full text-[12px] border-collapse min-w-max">
                        <thead>
                          <tr className="bg-[#0d0d0d]">
                            <th className="px-3 py-2 text-left font-semibold text-[#5a5a5a] border-b border-white/8 whitespace-nowrap">#</th>
                            {previewHeaders.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-semibold text-[#7a7a7a] border-b border-white/8 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((row) => (
                            <tr key={row.idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="px-3 py-2 text-[#5a5a5a]">{row.idx - 1}</td>
                              {previewHeaders.map((_, ci) => (
                                <td key={ci} className="px-3 py-2 text-[#a8a8a8] whitespace-nowrap max-w-[160px] truncate">
                                  {row.cols[ci] || ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                          disabled={previewPage === 0}
                          className="px-3 py-1 text-[12px] rounded-md bg-white/5 border border-white/10 text-[#a8a8a8]
                                     hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={previewPage === totalPages - 1}
                          className="px-3 py-1 text-[12px] rounded-md bg-white/5 border border-white/10 text-[#a8a8a8]
                                     hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={!file || uploading}
                onClick={handleUpload}
                className="px-6 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-semibold
                           hover:bg-brand/90 transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  "Upload"
                )}
              </button>
              <button
                onClick={onBack}
                className="px-6 py-2 bg-transparent border border-white/10 text-[#a8a8a8] rounded-lg text-sm font-medium
                           hover:bg-white/5 hover:text-white hover:border-white/20 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Invite via Email view ───────────────────────────────────────────── */

/** Parses a CSV/XLS/XLSX file into raw string rows (first row = headers). */
async function parseInviteFileRows(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    return text
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map(parseCSVLine);
  }
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

function InviteViaEmailView({ onBack }: { onBack: () => void }) {
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mutually exclusive: uploading a file locks the single-employee fields
  // (and clears any half-typed values), and vice versa — you invite either
  // one person by hand or many via file, never a mix of both at once.
  const hasSingleInput = singleName.trim() !== "" || singleEmail.trim() !== "";
  const hasFile = !!file;

  function applyFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (hasSingleInput) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
      toast.error("Only CSV, XLS, or XLSX files are supported");
      return;
    }
    setSingleName("");
    setSingleEmail("");
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (hasSingleInput) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  }

  function downloadTemplate() {
    const headers = ["Employee Name", "Employee Email"];
    const sample = ["Jane Doe", "jane@company.com"];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_invite_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSend() {
    const entries: Array<{ name: string; email: string }> = [];

    const trimmedEmail = singleEmail.trim().toLowerCase();
    if (trimmedEmail) {
      entries.push({ name: singleName.trim(), email: trimmedEmail });
    }

    if (file) {
      const rows = await parseInviteFileRows(file);
      if (rows.length < 2) {
        toast.error("File has no data rows");
        return;
      }
      const headers = rows[0].map((h) => h.toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      if (emailIdx === -1) {
        toast.error("File must have an 'Employee Email' column");
        return;
      }
      for (const cols of rows.slice(1)) {
        const email = (cols[emailIdx] || "").trim().toLowerCase();
        if (!email) continue;
        entries.push({
          name: nameIdx !== -1 ? (cols[nameIdx] || "").trim() : "",
          email,
        });
      }
    }

    // Dedupe by email (single entry + file rows may overlap)
    const seen = new Set<string>();
    const unique = entries.filter(({ email }) => {
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    if (unique.length === 0) {
      toast.error("Add an employee's email, or upload a file");
      return;
    }

    setSending(true);
    try {
      await sendOrgInvites(unique);
      toast.success(
        `${unique.length} invitation${unique.length !== 1 ? "s" : ""} sent successfully`
      );
      onBack();
    } catch (err) {
      // Surface the backend's actual reason (e.g. "Upgrade to Pro plan to
      // invite team members" when the trial has expired) instead of a
      // generic message that hides why it really failed.
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to send invitations"
      );
    } finally {
      setSending(false);
    }
  }

  const canSend = singleEmail.trim().length > 0 || !!file;

  return (
    <div>
      <div className="bg-[#141414] rounded-xl border border-white/8 p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-semibold text-white">Invite Employee</h3>
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-[#a8a8a8]" />
          </button>
        </div>

        {/* Add Single Employee */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">Add Single Employee</h4>
            {hasFile && (
              <span className="text-[11px] text-[#5a5a5a]">
                Remove the uploaded file to use this instead
              </span>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#a8a8a8] uppercase tracking-wider mb-1.5">
              Employee Name
            </label>
            <input
              type="text"
              placeholder="Jane Doe"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              disabled={hasFile}
              className="w-full h-10 px-3 rounded-lg bg-[#0a0a0a] border border-white/8 text-sm text-white
                         placeholder:text-[#5a5a5a] focus:outline-none focus:border-brand/40
                         focus:ring-1 focus:ring-brand/10 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#a8a8a8] uppercase tracking-wider mb-1.5">
              Employee Email
            </label>
            <input
              type="email"
              placeholder="jane@company.com"
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              disabled={hasFile}
              className="w-full h-10 px-3 rounded-lg bg-[#0a0a0a] border border-white/8 text-sm text-white
                         placeholder:text-[#5a5a5a] focus:outline-none focus:border-brand/40
                         focus:ring-1 focus:ring-brand/10 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-semibold text-[#5a5a5a] uppercase tracking-wider">
            OR
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Add Multiple Employees */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">Add Multiple Employees</h4>
            {hasSingleInput && (
              <span className="text-[11px] text-[#5a5a5a]">
                Clear the fields above to use this instead
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            disabled={hasSingleInput}
            onChange={(e) => applyFile(e.target.files?.[0] || null)}
          />
          <div
            onClick={() => {
              if (hasSingleInput) return;
              inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!hasSingleInput) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-150 ${
              hasSingleInput
                ? "border-white/5 opacity-40 cursor-not-allowed"
                : dragging
                  ? "border-brand/50 bg-brand/[0.04] cursor-pointer"
                  : "border-white/10 hover:border-white/20 cursor-pointer"
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-5 w-5 text-brand" />
                <span className="text-sm text-white font-medium">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    applyFile(null);
                  }}
                  className="h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 text-[#a8a8a8]" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-brand mx-auto mb-2" />
                <p className="text-sm text-white font-medium">
                  Drag &amp; drop file here or Browse
                </p>
                <p className="text-[11px] text-[#5a5a5a] mt-1">
                  Supports CSV, XLS, XLSX
                </p>
              </>
            )}
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-[12px] text-brand hover:text-brand/80 underline underline-offset-2 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download sample template file
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-8">
          <button
            disabled={!canSend || sending}
            onClick={handleSend}
            className="px-6 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-semibold
                       hover:bg-brand/90 transition-colors cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              "Invite Employee"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
