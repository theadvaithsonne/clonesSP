"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getEmployee, listEmployees } from "../api";
import type { EmployeeListItem, Section } from "../types";

interface Props {
  userId?: string | null;
  onNavigate: (section: Section) => void;
  /** Show the Edit button (founder/admin viewing anyone, or self-view). */
  canEdit?: boolean;
  onEdit?: () => void;
  /** Button label — e.g. "Update Profile" for self-view. Defaults to "Edit". */
  editLabel?: string;
}

function getId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && "_id" in (val as object)) return (val as { _id: string })._id;
  return "";
}

function getName(val: unknown): string {
  if (val && typeof val === "object" && "name" in (val as object))
    return (val as { name: string }).name || "—";
  return "—";
}

/** Populated refs come back as objects at runtime even though the shared
 *  profile type declares them as plain id strings — read safely. */
function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === "object" ? (val as Record<string, unknown>) : null;
}

function formatDate(raw?: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const EMP_TYPE: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  intern: "Intern",
  freelance: "Freelance",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function Avatar({ name, src, size }: { name: string; src?: string | null; size: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{ height: size, width: size }}
        className="rounded-full object-cover shrink-0 ring-1 ring-white/10"
      />
    );
  }
  return (
    <div
      style={{ height: size, width: size, fontSize: size * 0.34 }}
      className="rounded-full bg-[#5b5bd6] text-white flex items-center justify-center font-semibold shrink-0"
    >
      {initials(name)}
    </div>
  );
}

interface ChartNode {
  userId: string;
  name: string;
  designation: string;
  profilePicture: string | null;
}

/** Read-only employee details page. Sensitive side panels (salary, tax,
 *  attendance) only render when the backend actually returned that data —
 *  it strips those fields for non-admin callers viewing themselves. */
export default function EmployeeDetailsSection({ userId, onNavigate, canEdit = false, onEdit, editLabel = "Edit" }: Props) {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeListItem | null>(null);
  const [all, setAll] = useState<EmployeeListItem[]>([]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([getEmployee(userId), listEmployees()])
      .then(([emp, list]) => {
        setEmployee(emp);
        setAll(list.employees || []);
      })
      .catch(() => toast.error("Failed to load employee details"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-[#a8a8a8]">Employee not found</p>
        <button onClick={() => onNavigate("employees")} className="text-[13px] text-brand cursor-pointer">
          Back to Employees
        </button>
      </div>
    );
  }

  const p = employee.profile;
  const deptName = getName(p?.departmentId);
  const branchName = getName(p?.branchId);
  const empType = p?.employmentType ? EMP_TYPE[p.employmentType] || p.employmentType : "—";
  const managerName = getName(p?.reportingManagerId);

  // ── Side panel data (present only when backend didn't strip it) ──
  const basic = p?.basicSalary || 0;
  const hra = p?.hra || 0;
  const transport = p?.transportAllowance || 0;
  const monthlyCtc = p?.monthlyCtc || 0;
  const structureName = getName(p?.salaryStructureId);
  const showSalary = monthlyCtc > 0 || basic > 0 || hra > 0 || transport > 0 || structureName !== "—";
  const estTds = p?.estimatedAnnualTds || 0;
  const showTax = !!p?.tdsRegime || estTds > 0;
  const shift = asObj(p?.shiftId);
  const pattern = asObj(p?.weeklyOffPatternId);
  const shiftLabel = shift
    ? `${(shift.name as string) || "—"}${shift.startTime && shift.endTime ? ` (${shift.startTime} - ${shift.endTime})` : ""}`
    : "—";
  const offDays = Array.isArray(pattern?.offDays) ? (pattern!.offDays as number[]) : [];
  const patternLabel = pattern
    ? offDays.length
      ? offDays.map((d) => DAY_NAMES[d] || "").filter(Boolean).join(" - ")
      : (pattern.name as string) || "—"
    : "—";
  const showAttendance = !!shift || !!pattern;
  const hasSidePanels = showSalary || showTax || showAttendance;

  // ── Org structure: manager chain up from this employee + peers ──
  const byId = new Map(all.filter((e) => !e.isPending).map((e) => [e.userId, e]));
  const node = (e: EmployeeListItem): ChartNode => ({
    userId: e.userId,
    name: e.name,
    designation: e.profile?.designation || "—",
    profilePicture: e.profilePicture || null,
  });
  const managerOf = (id: string) => getId(byId.get(id)?.profile?.reportingManagerId);

  const chain: ChartNode[] = []; // top ancestor → direct manager
  const seen = new Set<string>([employee.userId]);
  let cur = getId(p?.reportingManagerId);
  while (cur && byId.has(cur) && !seen.has(cur) && chain.length < 6) {
    seen.add(cur);
    chain.unshift(node(byId.get(cur)!));
    cur = managerOf(cur);
  }
  const directManagerId = chain.length ? chain[chain.length - 1].userId : "";
  const bottomRow: ChartNode[] = directManagerId
    ? all
        .filter((e) => !e.isPending && managerOf(e.userId) === directManagerId)
        .map(node)
    : [node(employee)];
  if (!bottomRow.some((n) => n.userId === employee.userId)) bottomRow.unshift(node(employee));
  bottomRow.sort((a, b) => (a.userId === employee.userId ? -1 : b.userId === employee.userId ? 1 : 0));

  return (
    <div className={`${hasSidePanels ? "max-w-6xl" : "max-w-4xl"} animate-[fadeIn_0.3s_ease-out]`}>
      {/* Back */}
      <button
        onClick={() => onNavigate("employees")}
        className="h-9 w-9 rounded-xl bg-[#050505] hover:bg-white/8 flex items-center justify-center cursor-pointer mb-5"
      >
        <ArrowLeft className="h-4 w-4 text-[#a8a8a8]" />
      </button>

      <div className={`grid grid-cols-1 gap-6 ${hasSidePanels ? "lg:grid-cols-[1fr_290px]" : ""}`}>
        {/* ── Main card ── */}
        <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden self-start">
          {/* Header */}
          <div className="px-6 py-6 flex items-start gap-4">
            <Avatar name={employee.name} src={employee.profilePicture} size={48} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold text-white tracking-tight truncate">{employee.name}</h2>
              <p className="text-[12px] text-[#a8a8a8] mt-0.5">{p?.designation || "—"}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2.5 text-[11px] text-[#7a7a7a]">
                <span>{deptName}</span>
                <span>{branchName}</span>
                <span>{empType}</span>
              </div>
            </div>
            {canEdit && onEdit && (
              <button
                onClick={onEdit}
                className="shrink-0 h-9 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.97] transition-all duration-150 cursor-pointer"
              >
                {editLabel}
              </button>
            )}
          </div>

          {/* Contact Information */}
          <SectionBlock title="Contact Information">
            <div className="space-y-4">
              <DetailField label="Email ID" value={employee.email} />
              <DetailField label="Mobile Number" value={p?.mobileNumber} />
            </div>
          </SectionBlock>

          {/* Organization Details */}
          <SectionBlock title="Organization Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <DetailField label="Reporting Manager" value={managerName} />
              <DetailField label="Date of Joining" value={formatDate(p?.dateOfJoining)} />
              <DetailField label="Department" value={deptName} />
              <DetailField label="Branch" value={branchName} />
              <DetailField label="Designation" value={p?.designation} />
              <DetailField label="Employment Type" value={empType} />
            </div>
          </SectionBlock>

          {/* Personal & Address */}
          <SectionBlock title="Personal & Address">
            <div className="space-y-4">
              <DetailField label="Permanent Address" value={p?.permanentAddress} />
              <DetailField
                label="Current Address"
                value={p?.sameAsPermanent ? p?.permanentAddress : p?.currentAddress}
              />
            </div>
          </SectionBlock>

          {/* Organization Structure */}
          <SectionBlock title="Organization Structure">
            <div className="flex flex-col items-center overflow-x-auto py-2">
              {chain.map((n) => (
                <div key={n.userId} className="flex flex-col items-center">
                  <ChartCard node={n} />
                  <div className="w-px h-6 bg-white/15" />
                </div>
              ))}
              {chain.length > 0 && bottomRow.length > 1 && (
                <div
                  className="h-px bg-white/15"
                  style={{ width: `${(bottomRow.length - 1) * 148}px` }}
                />
              )}
              <div className="flex items-start gap-3 pt-0">
                {bottomRow.map((n) => (
                  <div key={n.userId} className="flex flex-col items-center">
                    {chain.length > 0 && <div className="w-px h-4 bg-white/15" />}
                    <ChartCard node={n} highlight={n.userId === employee.userId} />
                  </div>
                ))}
              </div>
            </div>
          </SectionBlock>
        </div>

        {/* ── Side panels — admin/founder only (backend strips this data
               for non-admin callers, so they simply don't render) ── */}
        {hasSidePanels && (
          <div className="space-y-6 self-start">
            {showSalary && (
              <SidePanel title="Salary Summary">
                <div className="space-y-3">
                  {structureName !== "—" && <PanelRow label="Structure" value={structureName} />}
                  {basic > 0 && <PanelRow label="Basic Salary" value={inr(basic)} />}
                  {hra > 0 && <PanelRow label="HRA" value={inr(hra)} />}
                  {transport > 0 && <PanelRow label="Transport" value={inr(transport)} />}
                  {monthlyCtc > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-white/8">
                      <span className="text-[12px] font-semibold text-white">Total</span>
                      <span className="text-[13px] font-bold text-brand">{inr(monthlyCtc)}</span>
                    </div>
                  )}
                </div>
              </SidePanel>
            )}
            {showTax && (
              <SidePanel title="Tax Configuration">
                <div className="space-y-4">
                  <DetailField
                    label="TDS Regime"
                    value={p?.tdsRegime === "new" ? "New Regime" : p?.tdsRegime === "old" ? "Old Regime" : "—"}
                  />
                  <DetailField
                    label="Estimated TDS"
                    value={estTds > 0 ? `${inr(estTds)} / year` : "—"}
                  />
                </div>
              </SidePanel>
            )}
            {showAttendance && (
              <SidePanel title="Attendance & Policy">
                <div className="space-y-4">
                  <DetailField label="Shift Type" value={shiftLabel} />
                  <DetailField label="Weekly Off" value={patternLabel} />
                </div>
              </SidePanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="px-6 py-3.5 border-t border-b border-white/8">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/8">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-[#a8a8a8]">{label}</span>
      <span className="text-[13px] text-white text-right">{value}</span>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#7a7a7a] mb-1 uppercase tracking-wider">{label}</p>
      <p className="text-[13px] text-white break-words">{value || "—"}</p>
    </div>
  );
}

function ChartCard({ node, highlight }: { node: ChartNode; highlight?: boolean }) {
  return (
    <div
      className={`w-[136px] rounded-xl border px-3 py-3.5 flex flex-col items-center text-center bg-[#0a0a0a] ${
        highlight ? "border-[#5b5bd6] ring-1 ring-[#5b5bd6]/40" : "border-white/10"
      }`}
    >
      <Avatar name={node.name} src={node.profilePicture} size={32} />
      <p className="text-[11.5px] font-semibold text-white mt-2 truncate w-full">{node.name}</p>
      <p className="text-[10px] text-[#7a7a7a] mt-0.5 truncate w-full">{node.designation}</p>
    </div>
  );
}
