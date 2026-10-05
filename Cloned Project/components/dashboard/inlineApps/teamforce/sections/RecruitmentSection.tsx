"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Plus,
  Loader2,
  Eye,
  Pencil,
  Send,
  CircleX,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Settings as SettingsIcon,
  Share2,
  Building2,
  MapPin,
  Briefcase,
  Clock,
  Upload,
  Sparkles,
  Download,
  User,
  Mail,
  Phone,
  FileText,
  DollarSign,
  Trash2,
  Save,
  Rocket,
  Hash,
  Type as TypeIcon,
  Copy,
  X as XIcon,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  listRecruitmentRequests,
  createRecruitmentRequest,
  updateRecruitmentRequest,
  listBranches,
  listDepartments,
  listEmployees,
  submitCandidateApplication,
  listCandidates,
  getCandidateResumeUrl,
  getCandidateCustomFileUrl,
  updateCandidateStage,
  getRecruitmentForm,
  saveRecruitmentFormDraft,
  publishRecruitmentForm,
} from "../api";
import type { CustomFieldSubmission } from "../api";
import type {
  RecruitmentRequest,
  RecruitmentStatus,
  RecruitmentRequestPayload,
  Branch,
  Department,
  EmployeeListItem,
  EmploymentType,
  ExperienceRange,
  Candidate,
  CandidateStage,
  CustomFieldDef,
  CustomFieldType,
  CustomFieldValue,
} from "../types";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; request: RecruitmentRequest }
  | { kind: "view"; request: RecruitmentRequest }
  | { kind: "preview"; request: RecruitmentRequest }
  | { kind: "apply"; request: RecruitmentRequest }
  | { kind: "pipeline"; request: RecruitmentRequest }
  | { kind: "candidate"; request: RecruitmentRequest; candidate: Candidate }
  | { kind: "configure"; request: RecruitmentRequest };

const EMPTY_FORM: RecruitmentRequestPayload = {
  positionName: "",
  department: "",
  branch: "",
  reportingManager: "",
  employmentType: "Full-Time",
  numberOfOpenings: 1,
  experienceRequired: "0-2",
  jobLocation: "",
  expectedJoiningDate: "",
  roleSummary: "",
  keyResponsibilities: "",
  requiredSkills: "",
  preferredSkills: "",
  approver: "",
  approvers: [],
};

const STATUS_STYLES: Record<RecruitmentStatus, { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "text-[#a8a8a8] bg-white/5 ring-1 ring-white/10",
  },
  approval_pending: {
    label: "Approval Pending",
    cls: "text-yellow-300 bg-yellow-500/10 ring-1 ring-yellow-500/20",
  },
  approved: {
    label: "Approved",
    cls: "text-green-400 bg-green-500/10 ring-1 ring-green-500/20",
  },
  floated: {
    label: "Floated",
    cls: "text-blue-300 bg-blue-500/10 ring-1 ring-blue-500/20",
  },
  closed: {
    label: "Closed",
    cls: "text-[#7a7a7a] bg-white/5 ring-1 ring-white/8",
  },
};

const EMPLOYMENT_OPTIONS: EmploymentType[] = [
  "Full-Time",
  "Part-Time",
  "Contract",
  "Intern",
];

const EXPERIENCE_OPTIONS: ExperienceRange[] = ["0-2", "2-5", "5-8", "8+"];

export default function RecruitmentSection() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRecruitmentRequests({ pageSize: 100 });
      setRequests(res.requests || []);
    } catch {
      toast.error("Failed to load recruitment requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dock "Create Request" action (the on-page button moved into the dock)
  useEffect(() => {
    const handler = () => setView({ kind: "create" });
    window.addEventListener("teamforce:create-recruitment", handler);
    return () =>
      window.removeEventListener("teamforce:create-recruitment", handler);
  }, []);

  // "create" renders as a popup over the list (see the modal in the final
  // return below) instead of a full-page view.

  if (view.kind === "edit") {
    return (
      <RecruitmentForm
        mode="edit"
        initial={view.request}
        onCancel={() => setView({ kind: "list" })}
        onSaved={() => {
          setView({ kind: "list" });
          load();
        }}
      />
    );
  }

  // Sharing implies publishing: the public /jobs/:id page only serves
  // "floated" requests, so the first share action floats the job — same
  // behavior as the list view's share button.
  async function floatFromView(r: RecruitmentRequest) {
    if (r.status === "floated") return;
    try {
      await updateRecruitmentRequest(r._id, { status: "floated" });
      toast.success("Job floated — public link is now live");
      setView({ kind: "view", request: { ...r, status: "floated" } });
      load();
    } catch {
      toast.error("Failed to float job — the shared link won't work until it's floated");
    }
  }

  if (view.kind === "view") {
    return (
      <RecruitmentView
        request={view.request}
        onBack={() => setView({ kind: "list" })}
        onPreview={(r) => setView({ kind: "preview", request: r })}
        onPipeline={(r) => setView({ kind: "pipeline", request: r })}
        onConfigure={(r) => setView({ kind: "configure", request: r })}
        onShared={() => floatFromView(view.request)}
      />
    );
  }

  if (view.kind === "configure") {
    return (
      <ApplicationFormBuilder
        request={view.request}
        onBack={() => setView({ kind: "view", request: view.request })}
      />
    );
  }

  if (view.kind === "pipeline") {
    return (
      <CandidatePipelineView
        request={view.request}
        onBack={() => setView({ kind: "view", request: view.request })}
        onViewCandidate={(c) =>
          setView({ kind: "candidate", request: view.request, candidate: c })
        }
      />
    );
  }

  if (view.kind === "candidate") {
    return (
      <CandidateApplicationView
        request={view.request}
        candidate={view.candidate}
        onBack={() =>
          setView({ kind: "pipeline", request: view.request })
        }
      />
    );
  }

  if (view.kind === "preview") {
    return (
      <JobLandingPreview
        request={view.request}
        onBack={() => setView({ kind: "view", request: view.request })}
        onApply={(r) => setView({ kind: "apply", request: r })}
      />
    );
  }

  if (view.kind === "apply") {
    return (
      <JobApplicationForm
        request={view.request}
        onBack={() => setView({ kind: "preview", request: view.request })}
        onSubmitted={() => setView({ kind: "view", request: view.request })}
      />
    );
  }

  return (
    <>
      <RecruitmentList
        requests={requests}
        loading={loading}
        onCreate={() => setView({ kind: "create" })}
        onEdit={(r) => setView({ kind: "edit", request: r })}
        onView={(r) => setView({ kind: "view", request: r })}
        onAfterAction={load}
      />
      {/* Add Recruitment Request — popup over the list (per design) */}
      {view.kind === "create" && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm"
          onClick={() => setView({ kind: "list" })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] max-h-[90vh] flex flex-col bg-[#1c1c1e] rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden animate-[scaleIn_0.15s_ease-out]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
              <h2 className="text-[15px] font-semibold text-white">
                Add Recruitment Request
              </h2>
              <button
                type="button"
                onClick={() => setView({ kind: "list" })}
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
              >
                <XIcon className="h-4 w-4 text-[#a8a8a8]" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <RecruitmentForm
                mode="create"
                inModal
                onCancel={() => setView({ kind: "list" })}
                onSaved={() => {
                  setView({ kind: "list" });
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List view (grid + pagination)
// ─────────────────────────────────────────────────────────────────────────────

function RecruitmentList({
  requests,
  loading,
  onCreate,
  onEdit,
  onView,
  onAfterAction,
}: {
  requests: RecruitmentRequest[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (r: RecruitmentRequest) => void;
  onView: (r: RecruitmentRequest) => void;
  onAfterAction: () => void;
}) {
  const pg = usePagination(requests);
  const [shareRequest, setShareRequest] = useState<RecruitmentRequest | null>(
    null
  );

  async function handleApprove(id: string) {
    if (!window.confirm("Approve this recruitment request?")) return;
    try {
      await updateRecruitmentRequest(id, { status: "approved" });
      toast.success("Request approved");
      onAfterAction();
    } catch (err: any) {
      // Surface the backend error so a non-designated approver sees why
      // the request was blocked (e.g. approver list restricts who can act).
      let msg = "Failed to approve request";
      const raw = err?.message || "";
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error) msg = parsed.error;
      } catch {
        if (raw) msg = raw;
      }
      toast.error(msg);
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm("Reject this request? It will be sent back to draft.")) return;
    try {
      await updateRecruitmentRequest(id, { status: "draft" });
      toast.success("Request rejected");
      onAfterAction();
    } catch {
      toast.error("Failed to reject request");
    }
  }

  async function floatAfterShare(r: RecruitmentRequest) {
    if (r.status === "floated") return;
    try {
      await updateRecruitmentRequest(r._id, { status: "floated" });
      toast.success("Job floated");
      onAfterAction();
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleClose(id: string) {
    try {
      await updateRecruitmentRequest(id, { status: "closed" });
      toast.success("Request closed");
      onAfterAction();
    } catch {
      toast.error("Failed to close request");
    }
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Recruitment Requests
          </h2>
          <p className="text-[12px] text-[#7a7a7a] mt-1">
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Create Request moved into the bottom dock */}
      </div>

      {/* Grid / Table */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {[
                  "Position Name",
                  "Department",
                  "Experience Required",
                  "Employment Type",
                  "No. of Openings",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || pg.transitioning ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">
                      No recruitment requests yet
                    </p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Click “Create Request” to draft a new one
                    </p>
                  </td>
                </tr>
              ) : (
                pg.pageItems.map((r) => {
                  const statusMeta = STATUS_STYLES[r.status];
                  return (
                    <tr
                      key={r._id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onView(r)}
                          className="text-xs font-medium text-brand hover:underline cursor-pointer"
                        >
                          {r.positionName}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {r.department}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {r.experienceRequired}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {r.employmentType}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#a8a8a8]">
                        {r.numberOfOpenings}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <IconBtn
                            title="View Request"
                            onClick={() => onView(r)}
                          >
                            <Eye className="h-3.5 w-3.5 text-[#a8a8a8]" />
                          </IconBtn>
                          {r.status !== "closed" && (
                            <IconBtn
                              title={
                                r.status === "draft"
                                  ? "Edit Request"
                                  : "Edit Request (will reset status to Approval Pending)"
                              }
                              onClick={() => onEdit(r)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-brand" />
                            </IconBtn>
                          )}
                          {r.status === "approval_pending" && (
                            <>
                              <IconBtn
                                title="Approve"
                                onClick={() => handleApprove(r._id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                              </IconBtn>
                              <IconBtn
                                title="Reject"
                                onClick={() => handleReject(r._id)}
                              >
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              </IconBtn>
                            </>
                          )}
                          {r.status === "approved" && (
                            <IconBtn
                              title="Float Job"
                              onClick={() => setShareRequest(r)}
                            >
                              <Send className="h-3.5 w-3.5 text-green-400" />
                            </IconBtn>
                          )}
                          {r.status === "floated" && (
                            <IconBtn
                              title="Close Request"
                              onClick={() => handleClose(r._id)}
                            >
                              <CircleX className="h-3.5 w-3.5 text-red-400" />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pg.page}
          totalPages={pg.totalPages}
          total={pg.total}
          start={pg.start}
          end={pg.end}
          loading={pg.transitioning}
          onPrev={pg.goPrev}
          onNext={pg.goNext}
        />
      </div>

      {shareRequest && (
        <ShareJobModal
          open
          onClose={() => setShareRequest(null)}
          request={shareRequest}
          onShared={() => floatAfterShare(shareRequest)}
        />
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 hover:bg-white/8 rounded transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form view (create / edit)
// ─────────────────────────────────────────────────────────────────────────────

function RecruitmentForm({
  mode,
  initial,
  onCancel,
  onSaved,
  inModal = false,
}: {
  mode: "create" | "edit";
  initial?: RecruitmentRequest;
  onCancel: () => void;
  onSaved: () => void;
  /** Rendered inside the Add Recruitment Request popup — the modal shell
   *  provides the header/close, so the page header and card chrome are
   *  skipped and the form sits directly on the grey panel. */
  inModal?: boolean;
}) {
  const [form, setForm] = useState<RecruitmentRequestPayload>(() =>
    initial
      ? {
          positionName: initial.positionName,
          department: initial.department,
          branch: initial.branch,
          reportingManager: initial.reportingManager,
          employmentType: initial.employmentType,
          numberOfOpenings: initial.numberOfOpenings,
          experienceRequired: initial.experienceRequired,
          jobLocation: initial.jobLocation,
          expectedJoiningDate: initial.expectedJoiningDate
            ? initial.expectedJoiningDate.slice(0, 10)
            : "",
          roleSummary: initial.roleSummary || "",
          keyResponsibilities: initial.keyResponsibilities || "",
          requiredSkills: initial.requiredSkills || "",
          preferredSkills: initial.preferredSkills || "",
          approver: initial.approver || "",
          // Backfill `approvers` from the legacy single `approver` string
          // when editing a record saved before this field existed.
          approvers:
            initial.approvers && initial.approvers.length > 0
              ? initial.approvers
              : initial.approver
              ? [initial.approver]
              : [],
        }
      : { ...EMPTY_FORM }
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  useEffect(() => {
    listBranches()
      .then((r) => setBranches(r.branches || []))
      .catch(() => {});
    listDepartments()
      .then((r) => setDepartments(r.departments || []))
      .catch(() => {});
    listEmployees()
      .then((r) => setEmployees(r.employees || []))
      .catch(() => {});
  }, []);

  // Approver list — founders + Teamforce admins + people-managers.
  const approverOptions = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.role === "founder" ||
          e.teamforceRole === "admin" ||
          !!e.profile?.managesTeam
      ),
    [employees]
  );

  function set<K extends keyof RecruitmentRequestPayload>(
    key: K,
    value: RecruitmentRequestPayload[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.positionName.trim()) return "Position name is required";
    if (!/[a-zA-Z]/.test(form.positionName)) return "Position name must contain letters";
    if (!form.department.trim()) return "Department is required";
    if (!form.branch.trim()) return "Branch is required";
    if (!form.reportingManager.trim()) return "Reporting manager is required";
    if (!form.jobLocation.trim()) return "Job location is required";
    if (!form.expectedJoiningDate) return "Expected joining date is required";
    if (form.expectedJoiningDate < new Date().toISOString().slice(0, 10))
      return "Expected joining date cannot be in the past";
    if (!form.approvers || form.approvers.length === 0)
      return "At least one approver is required";
    if (form.numberOfOpenings < 1) return "At least 1 opening is required";
    return null;
  }

  async function handleSubmit(action: "draft" | "submit") {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(action);
    try {
      // `approvers` is canonical now; blank the legacy `approver` string
      // so View doesn't show a stale value when the user clears approvers.
      const payload = { ...form, approver: "", action };
      if (mode === "edit" && initial) {
        await updateRecruitmentRequest(initial._id, payload);
        toast.success(
          action === "submit" ? "Submitted for approval" : "Draft saved"
        );
      } else {
        await createRecruitmentRequest(payload);
        toast.success(
          action === "submit" ? "Submitted for approval" : "Draft saved"
        );
      }
      onSaved();
    } catch {
      toast.error("Failed to save recruitment request");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Header — skipped in the popup (modal shell has its own) */}
      {!inModal && (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="h-8 w-8 rounded-lg hover:bg-white/8 flex items-center justify-center cursor-pointer transition-colors"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4 text-[#a8a8a8]" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {mode === "edit"
                ? "Edit Recruitment Request"
                : "Create Recruitment Request"}
            </h2>
            <p className="text-[12px] text-[#7a7a7a] mt-0.5">
              Fill in position and job details
            </p>
          </div>
        </div>
      </div>
      )}

      <div className={inModal ? "" : "bg-[#050505] rounded-xl border border-white/8 p-6"}>
        {/* Position Details */}
        <div className="mb-8">
          <h3 className="text-[15px] font-semibold text-white mb-4">
            Position Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Position Name" required>
              <TextInput
                value={form.positionName}
                onChange={(v) =>
                  set(
                    "positionName",
                    v.replace(/[^a-zA-Z\s\-\.&()]/g, "").slice(0, 100)
                  )
                }
                placeholder="e.g., Senior Frontend Developer"
              />
            </Field>
            <Field label="Department" required>
              <SelectInput
                value={form.department}
                onChange={(v) => set("department", v)}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Branch" required>
              <SelectInput
                value={form.branch}
                onChange={(v) => set("branch", v)}
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Reporting Manager" required>
              <SelectInput
                value={form.reportingManager}
                onChange={(v) => set("reportingManager", v)}
              >
                <option value="">Select Reporting Manager</option>
                {/* Preserve the stored value if it doesn't match a current
                    employee (e.g. they left the org since this request was
                    saved) so the user can still see what's selected. */}
                {form.reportingManager &&
                  !employees.some((e) => e.name === form.reportingManager) && (
                    <option value={form.reportingManager}>
                      {form.reportingManager} (no longer in org)
                    </option>
                  )}
                {employees.map((e) => (
                  <option key={e.userId} value={e.name}>
                    {e.name}
                    {e.email ? ` — ${e.email}` : ""}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Employment Type" required>
              <SelectInput
                value={form.employmentType}
                onChange={(v) =>
                  set("employmentType", v as EmploymentType)
                }
              >
                {EMPLOYMENT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="No. of Openings" required>
              <NumberInput
                value={form.numberOfOpenings}
                onChange={(v) => set("numberOfOpenings", v)}
                min={1}
              />
            </Field>
            <Field label="Experience Required" required>
              <SelectInput
                value={form.experienceRequired}
                onChange={(v) =>
                  set("experienceRequired", v as ExperienceRange)
                }
              >
                {EXPERIENCE_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {e} years
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Job Location" required>
              <TextInput
                value={form.jobLocation}
                onChange={(v) => set("jobLocation", v)}
                placeholder="e.g., San Francisco, CA"
              />
            </Field>
            <Field label="Expected Joining Date" required>
              <DateInput
                value={form.expectedJoiningDate}
                onChange={(v) => set("expectedJoiningDate", v)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          </div>
        </div>

        {/* Job Description */}
        <div className="mb-8">
          <h3 className="text-[15px] font-semibold text-white mb-4">
            Job Description
          </h3>
          <div className="space-y-5">
            <Field label="Role Summary">
              <TextArea
                rows={3}
                value={form.roleSummary || ""}
                onChange={(v) => set("roleSummary", v)}
                placeholder="Brief overview of the role..."
              />
            </Field>
            <Field label="Key Responsibilities">
              <TextArea
                rows={4}
                value={form.keyResponsibilities || ""}
                onChange={(v) => set("keyResponsibilities", v)}
                placeholder="List key responsibilities..."
              />
            </Field>
            <Field label="Required Skills">
              <TextArea
                rows={3}
                value={form.requiredSkills || ""}
                onChange={(v) => set("requiredSkills", v)}
                placeholder="List required skills and qualifications..."
              />
            </Field>
            <Field label="Preferred Skills">
              <TextArea
                rows={3}
                value={form.preferredSkills || ""}
                onChange={(v) => set("preferredSkills", v)}
                placeholder="List nice-to-have skills..."
              />
            </Field>
          </div>
        </div>

        {/* Approval */}
        <div className="mb-6">
          <h3 className="text-[15px] font-semibold text-white mb-4">
            Approval
          </h3>
          <Field label="Approver" required>
            <MultiSelect
              options={approverOptions.map((e) => ({
                value: e.name,
                label: e.email ? `${e.name} — ${e.email}` : e.name,
              }))}
              value={form.approvers || []}
              onChange={(v) => set("approvers", v)}
              placeholder="Select one or more approvers (founder/admin/manager)"
            />
          </Field>
        </div>

        {/* Footer — when editing a non-draft request (approval_pending or
            approved), saving must re-submit for approval, so hide the
            "Save as Draft" path. The submit button label clarifies this. */}
        <div className="flex justify-end gap-2 pt-5 border-t border-white/8">
          <button
            onClick={onCancel}
            disabled={!!saving}
            className="px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          {(mode === "create" || initial?.status === "draft") && (
            <button
              onClick={() => handleSubmit("draft")}
              disabled={!!saving}
              className="px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-2"
            >
              {saving === "draft" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save as Draft
            </button>
          )}
          <button
            onClick={() => handleSubmit("submit")}
            disabled={!!saving}
            className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-brand rounded-lg hover:bg-brand/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand/10"
          >
            {saving === "submit" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {mode === "edit" &&
            initial?.status &&
            initial.status !== "draft" &&
            initial.status !== "approval_pending"
              ? "Save & Resubmit for Approval"
              : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View (details)
// ─────────────────────────────────────────────────────────────────────────────

function RecruitmentView({
  request,
  onBack,
  onPreview,
  onPipeline,
  onConfigure,
  onShared,
}: {
  request: RecruitmentRequest;
  onBack: () => void;
  onPreview: (r: RecruitmentRequest) => void;
  onPipeline: (r: RecruitmentRequest) => void;
  onConfigure: (r: RecruitmentRequest) => void;
  /** Fires on the first share action — parent floats the job so the
   *  public landing link actually resolves. */
  onShared?: () => void;
}) {
  const statusMeta = STATUS_STYLES[request.status];
  const [shareOpen, setShareOpen] = useState(false);

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : "—";

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Recruitment Request Details
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">{statusMeta.label}</p>
      </div>

      {/* Action card: back + right-side actions + title/status row */}
      <div className="bg-[#050505] rounded-xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Recruitment Requests
          </button>
          <div className="flex items-center gap-2">
            <ViewActionBtn onClick={() => onConfigure(request)} icon={<SettingsIcon className="h-4 w-4" />}>
              Configure Form
            </ViewActionBtn>
            <ViewActionBtn onClick={() => onPreview(request)} icon={<Eye className="h-4 w-4" />}>
              View Job Page
            </ViewActionBtn>
            <button
              onClick={() => onPipeline(request)}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#7c3aed] rounded-lg hover:bg-[#6d28d9] transition-colors cursor-pointer"
            >
              View Candidate Pipeline
            </button>
            <ViewActionBtn onClick={() => setShareOpen(true)} icon={<Share2 className="h-4 w-4" />}>
              Share Job
            </ViewActionBtn>
          </div>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-semibold text-white tracking-tight">
              {request.positionName}
            </h2>
            <p className="text-sm text-[#a8a8a8] mt-1">{request.department}</p>
          </div>
          <span
            className={`inline-flex px-3 py-1 rounded-md text-sm font-medium ${statusMeta.cls}`}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Position Details */}
      <DetailCard title="Position Details">
        <DetailGrid
          items={[
            ["Position Name", request.positionName],
            ["Department", request.department],
            ["Branch", request.branch],
            ["Reporting Manager", request.reportingManager],
            ["Employment Type", request.employmentType],
            ["No. of Openings", String(request.numberOfOpenings)],
            ["Experience Required", `${request.experienceRequired} years`],
            ["Job Location", request.jobLocation],
            ["Expected Joining Date", fmtDate(request.expectedJoiningDate)],
          ]}
        />
      </DetailCard>

      {/* Job Description */}
      <DetailCard title="Job Description">
        <div className="space-y-4">
          <DetailBlock label="Role Summary" value={request.roleSummary} />
          <DetailBlock
            label="Key Responsibilities"
            value={request.keyResponsibilities}
          />
          <DetailBlock label="Required Skills" value={request.requiredSkills} />
          <DetailBlock
            label="Preferred Skills"
            value={request.preferredSkills}
          />
        </div>
      </DetailCard>

      {/* Request Information */}
      <DetailCard title="Request Information">
        <DetailGrid
          items={[
            [
              "Approver",
              request.approvers && request.approvers.length > 0
                ? request.approvers.join(", ")
                : request.approver || "—",
            ],
            ["Created By", request.createdBy || "—"],
            ["Created Date", fmtDate(request.createdAt)],
            ["Status", statusMeta.label],
          ]}
        />
      </DetailCard>

      <ShareJobModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        request={request}
        onShared={onShared}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Job modal
// ─────────────────────────────────────────────────────────────────────────────

function buildShareUrl(requestId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/jobs/${requestId}`;
}

function ShareJobModal({
  open,
  onClose,
  request,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  request: RecruitmentRequest;
  /** Fires once on the first successful share action (copy link or social). */
  onShared?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharedFired = useRef(false);

  const shareUrl = useMemo(() => buildShareUrl(request._id), [request._id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  function fireShared() {
    if (sharedFired.current) return;
    sharedFired.current = true;
    onShared?.();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
      fireShared();
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function openShare(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    fireShared();
  }

  function openExternal(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(
    `${request.positionName} — Apply now`
  );

  const shareLinks = [
    {
      name: "LinkedIn",
      bg: "bg-[#0077b5]",
      label: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "Twitter",
      bg: "bg-[#1DA1F2]",
      label: "𝕏",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: "Email",
      bg: "bg-[#404040]",
      label: "✉",
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
    {
      name: "WhatsApp",
      bg: "bg-[#25D366]",
      label: "⚡",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-[#050505] border border-white/8 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              Share Job Posting
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/8 rounded transition-colors cursor-pointer"
            title="Close"
          >
            <XIcon className="h-5 w-5 text-[#a8a8a8]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-base font-medium text-white mb-1">
              {request.positionName}
            </h3>
            <p className="text-sm text-[#a8a8a8]">
              Share this link with candidates to view the job description and
              apply
            </p>
          </div>

          {/* Link + copy */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#c8c8c8] mb-2">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 text-sm bg-[#0a0a0a] border border-white/8 rounded-lg text-white font-mono truncate">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Preview card */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ExternalLink className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-blue-300 mb-1">
                  Preview Landing Page
                </h4>
                <p className="text-xs text-blue-300/80 mb-3">
                  Candidates will see the job description and can apply directly
                  through this page
                </p>
                <button
                  onClick={() => openExternal(shareUrl)}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  Open in new tab
                </button>
              </div>
            </div>
          </div>

          {/* Share via */}
          <div className="mt-6 pt-6 border-t border-white/8">
            <h4 className="text-sm font-medium text-[#c8c8c8] mb-3">
              Share via
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {shareLinks.map((s) => (
                <button
                  key={s.name}
                  onClick={() => openShare(s.href)}
                  className="flex flex-col items-center gap-2 p-3 border border-white/8 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div
                    className={`w-8 h-8 ${s.bg} rounded flex items-center justify-center text-white text-sm font-semibold`}
                  >
                    {s.label}
                  </div>
                  <span className="text-xs text-[#a8a8a8]">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Landing Page Preview (public-style preview)
// ─────────────────────────────────────────────────────────────────────────────

function JobLandingPreview({
  request,
  onBack,
  onApply,
}: {
  request: RecruitmentRequest;
  onBack: () => void;
  onApply: (r: RecruitmentRequest) => void;
}) {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Job Landing Page Preview
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">
          Public job posting preview
        </p>
      </div>

      {/* Preview stage (gradient backdrop) */}
      <div className="rounded-xl border border-white/8 overflow-hidden bg-gradient-to-br from-[#0a1128] via-[#0e0e18] to-[#1a0f26]">
        {/* Inner top bar */}
        <div className="bg-[#050505]/60 border-b border-white/8 px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Request
          </button>
        </div>

        <div className="w-full px-6 py-6 space-y-5">
          {/* Hero card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-7">
            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="min-w-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-600/20">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <p className="text-xs font-medium text-[#7a7a7a] mb-1">
                  Garage – Teamforce HR
                </p>
                <h2 className="text-[26px] font-bold text-white mb-2 tracking-tight">
                  {request.positionName}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#a8a8a8]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {request.jobLocation}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    {request.employmentType}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {request.experienceRequired} years
                  </span>
                </div>
              </div>
              <button
                onClick={() => onApply(request)}
                className="shrink-0 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
              >
                Apply Now
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-5 border-t border-white/8">
              <div>
                <p className="text-[11px] font-medium text-[#7a7a7a] mb-1">
                  Department
                </p>
                <p className="text-sm font-medium text-white">
                  {request.department}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#7a7a7a] mb-1">
                  Location
                </p>
                <p className="text-sm font-medium text-white">
                  {request.branch}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#7a7a7a] mb-1">
                  No. of Openings
                </p>
                <p className="text-sm font-medium text-white">
                  {request.numberOfOpenings}
                </p>
              </div>
            </div>
          </div>

          {/* Content card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-7 space-y-6">
            <PreviewBlock
              title="About the Role"
              value={request.roleSummary}
            />
            <PreviewBlock
              title="Key Responsibilities"
              value={request.keyResponsibilities}
            />
            <PreviewBlock
              title="Required Skills & Qualifications"
              value={request.requiredSkills}
            />
            <PreviewBlock
              title="Preferred Skills"
              value={request.preferredSkills}
            />
          </div>

          {/* CTA card */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-8 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Ready to join our team?
            </h3>
            <p className="text-sm text-[#a8a8a8] mb-6">
              Apply now and become part of our growing organization
            </p>
            <button
              onClick={() => onApply(request)}
              className="px-7 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
            >
              Apply for this Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Application Form (submits a candidate — resume + details)
// ─────────────────────────────────────────────────────────────────────────────

function JobApplicationForm({
  request,
  onBack,
  onSubmitted,
  previewFields,
}: {
  request: RecruitmentRequest;
  onBack: () => void;
  onSubmitted: () => void;
  /** When provided (preview mode), skips the network fetch and uses these
   *  fields as the "published" set. Used by the form builder's Preview. */
  previewFields?: CustomFieldDef[];
}) {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<string>("");
  const [experienceDetails, setExperienceDetails] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(
    previewFields || request.customFieldsPublished || []
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customFiles, setCustomFiles] = useState<Record<string, File | null>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // In preview mode the draft is passed in directly.
    if (previewFields) return;
    // Always fetch fresh published fields. The request prop is cached from
    // the list view and may not reflect a just-published form.
    getRecruitmentForm(request._id)
      .then((res) => {
        if (!mounted.current) return;
        setCustomFields(res.customFieldsPublished || []);
      })
      .catch(() => {});
  }, [request._id, previewFields]);

  function setCustomValue(id: string, value: string) {
    setCustomValues((m) => ({ ...m, [id]: value }));
  }
  function setCustomFile(id: string, file: File | null) {
    setCustomFiles((m) => ({ ...m, [id]: file }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Full name is required");
    if (!/[a-zA-Z]/.test(fullName)) return toast.error("Full name must contain valid letters");
    if (!mobileNumber.trim()) return toast.error("Mobile number is required");
    if ((mobileNumber.match(/[0-9]/g) || []).length < 7)
      return toast.error("Enter a valid mobile number (min 7 digits)");
    if (!email.trim()) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      return toast.error("Enter a valid email address");
    const yoe = Number(yearsOfExperience);
    if (!yearsOfExperience.trim() || Number.isNaN(yoe) || yoe < 0 || yoe > 60)
      return toast.error("Years of experience must be between 0 and 60");
    if (!resume) return toast.error("Please upload your resume");
    if (!experienceDetails.trim())
      return toast.error("Experience details are required");
    if (!currentCtc.trim()) return toast.error("Current CTC is required");
    if (!/[0-9]/.test(currentCtc)) return toast.error("Enter a valid Current CTC");
    if (!expectedCtc.trim()) return toast.error("Expected CTC is required");
    if (!/[0-9]/.test(expectedCtc)) return toast.error("Enter a valid Expected CTC");
    if (!noticePeriod.trim()) return toast.error("Notice period is required");
    if (!/[a-zA-Z0-9]/.test(noticePeriod)) return toast.error("Enter a valid notice period");

    if (previewFields) {
      toast.info("Preview mode — submission disabled");
      return;
    }

    const customSubmissions: CustomFieldSubmission[] = customFields.map((f) => ({
      id: f.id,
      type: f.type,
      value: f.type === "upload" ? "" : (customValues[f.id] || "").trim(),
      file: f.type === "upload" ? customFiles[f.id] || null : null,
    }));

    setSubmitting(true);
    try {
      await submitCandidateApplication(
        request._id,
        {
          fullName: fullName.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email.trim(),
          yearsOfExperience: yoe,
          experienceDetails: experienceDetails.trim(),
          currentCtc: currentCtc.trim(),
          expectedCtc: expectedCtc.trim(),
          noticePeriod: noticePeriod.trim(),
        },
        resume,
        customSubmissions
      );
      if (!mounted.current) return;
      toast.success("Application submitted");
      onSubmitted();
    } catch {
      if (mounted.current) toast.error("Failed to submit application");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Job Application Form
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">Apply for the job</p>
      </div>

      {/* Back bar */}
      <div className="bg-[#050505] rounded-xl border border-white/8 px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Job Details
        </button>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#050505] rounded-xl border border-white/8 p-7"
      >
        <div className="mb-7">
          <h2 className="text-[22px] font-bold text-white mb-2 tracking-tight">
            Apply for {request.positionName}
          </h2>
          <p className="text-sm text-[#a8a8a8]">
            {request.department} • {request.jobLocation}
          </p>
        </div>

        <div className="space-y-5">
          <ApplyField label="Full Name" required>
            <ApplyInput
              value={fullName}
              onChange={(v) => setFullName(v.replace(/[^a-zA-Z\s'\-\.]/g, "").slice(0, 100))}
              placeholder="John Doe"
            />
          </ApplyField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ApplyField label="Mobile Number" required>
              <ApplyInput
                value={mobileNumber}
                onChange={(v) => setMobileNumber(v.replace(/[^0-9+\s\-()]/g, "").slice(0, 20))}
                placeholder="+1 (555) 123-4567"
                type="tel"
              />
            </ApplyField>
            <ApplyField label="Email ID" required>
              <ApplyInput
                value={email}
                onChange={setEmail}
                placeholder="john@example.com"
                type="email"
              />
            </ApplyField>
          </div>

          <ApplyField label="Years of Experience" required>
            <input
              type="text"
              inputMode="decimal"
              value={yearsOfExperience}
              placeholder="e.g. 1.2 (1yr 2mo)"
              onChange={(e) => {
                let v = e.target.value.replace(/[^0-9.]/g, "");
                const dot = v.indexOf(".");
                if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 1);
                setYearsOfExperience(v.slice(0, 4));
              }}
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </ApplyField>

          <ApplyField label="Resume Upload" required>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setResume(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-[#a8a8a8] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              {resume
                ? `${resume.name} (${(resume.size / 1024).toFixed(0)} KB)`
                : "Choose file (PDF, DOC, DOCX)"}
            </button>
          </ApplyField>

          <ApplyField label="Experience Details" required>
            <textarea
              value={experienceDetails}
              rows={4}
              onChange={(e) => setExperienceDetails(e.target.value)}
              placeholder="Describe your relevant work experience..."
              className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </ApplyField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ApplyField label="Current CTC" required>
              <ApplyInput
                value={currentCtc}
                onChange={(v) => setCurrentCtc(v.replace(/[^0-9,.$€£₹]/g, "").slice(0, 20))}
                placeholder="$120,000"
              />
            </ApplyField>
            <ApplyField label="Expected CTC" required>
              <ApplyInput
                value={expectedCtc}
                onChange={(v) => setExpectedCtc(v.replace(/[^0-9,.$€£₹]/g, "").slice(0, 20))}
                placeholder="$140,000"
              />
            </ApplyField>
            <ApplyField label="Notice Period" required>
              <ApplyInput
                value={noticePeriod}
                onChange={(v) => setNoticePeriod(v.replace(/[^a-zA-Z0-9\s\-]/g, "").slice(0, 30))}
                placeholder="30 days"
              />
            </ApplyField>
          </div>
        </div>

        {customFields.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/8 space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold text-white">
                Additional Information
              </h3>
              <p className="text-[12px] text-[#7a7a7a] mt-1">
                Extra details requested for this role
              </p>
            </div>
            {customFields.map((f) => (
              <ApplyField key={f.id} label={f.label}>
                {f.type === "text" ? (
                  <ApplyInput
                    value={customValues[f.id] || ""}
                    onChange={(v) => setCustomValue(f.id, v)}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                  />
                ) : f.type === "number" ? (
                  <input
                    type="number"
                    value={customValues[f.id] || ""}
                    onChange={(e) => setCustomValue(f.id, e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                ) : (
                  <CustomUploadInput
                    file={customFiles[f.id] || null}
                    onChange={(file) => setCustomFile(f.id, file)}
                  />
                )}
              </ApplyField>
            ))}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/8">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-600/20"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Application
          </button>
        </div>
      </form>
    </div>
  );
}

function CustomUploadInput({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center justify-center gap-2 w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-[#a8a8a8] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
      >
        <Upload className="h-4 w-4" />
        {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : "Choose file"}
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Form Builder (Configure Form)
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_FIELDS: Array<{ label: string; type: string }> = [
  { label: "Full Name", type: "Text" },
  { label: "Mobile Number", type: "Number" },
  { label: "Email ID", type: "Text" },
  { label: "Years of Experience", type: "Number" },
  { label: "Resume Upload", type: "Upload" },
  { label: "Experience Details", type: "Text Area" },
  { label: "Current CTC", type: "Number" },
  { label: "Expected CTC", type: "Number" },
  { label: "Notice Period", type: "Text" },
];

const TYPE_ICON: Record<CustomFieldType, ReactNode> = {
  text: <TypeIcon className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  upload: <Upload className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  upload: "Upload",
};

function sameFields(a: CustomFieldDef[], b: CustomFieldDef[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].label !== b[i].label ||
      a[i].type !== b[i].type
    )
      return false;
  }
  return true;
}

function ApplicationFormBuilder({
  request,
  onBack,
}: {
  request: RecruitmentRequest;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<CustomFieldDef[]>([]);
  const [published, setPublished] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("text");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecruitmentForm(request._id)
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setDraft(res.customFieldsDraft || []);
        setPublished(res.customFieldsPublished || []);
      })
      .catch(() => {
        if (!cancelled && mounted.current)
          toast.error("Failed to load form configuration");
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request._id]);

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Field label is required");
      return;
    }
    const id = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setDraft((list) => [...list, { id, label, type: newType }]);
    setNewLabel("");
    setNewType("text");
  }

  function handleRemove(id: string) {
    setDraft((list) => list.filter((f) => f.id !== id));
  }

  async function handleSave() {
    if (saving || publishing) return;
    setSaving(true);
    try {
      const res = await saveRecruitmentFormDraft(request._id, draft);
      if (!mounted.current) return;
      setDraft(res.customFieldsDraft || []);
      setPublished(res.customFieldsPublished || []);
      toast.success("Draft saved");
    } catch {
      if (mounted.current) toast.error("Failed to save draft");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function handlePublish() {
    if (saving || publishing) return;
    // Always persist the latest draft first so publish reflects on-screen state.
    setPublishing(true);
    try {
      const saved = await saveRecruitmentFormDraft(request._id, draft);
      if (!mounted.current) return;
      setDraft(saved.customFieldsDraft || []);
      const res = await publishRecruitmentForm(request._id);
      if (!mounted.current) return;
      setDraft(res.customFieldsDraft || []);
      setPublished(res.customFieldsPublished || []);
      toast.success("Form published");
    } catch {
      if (mounted.current) toast.error("Failed to publish form");
    } finally {
      if (mounted.current) setPublishing(false);
    }
  }

  const isDirty = !sameFields(draft, published);

  if (previewing) {
    return (
      <JobApplicationForm
        request={request}
        previewFields={draft}
        onBack={() => setPreviewing(false)}
        onSubmitted={() => setPreviewing(false)}
      />
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Application Form Builder
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">
          Build custom application forms
        </p>
      </div>

      {/* Header card: back + title */}
      <div className="bg-[#050505] rounded-xl border border-white/8 p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Request
        </button>
        <h2 className="text-[22px] font-semibold text-white tracking-tight">
          Application Form Builder
        </h2>
        <p className="text-sm text-[#a8a8a8] mt-1">
          Customize the application form for{" "}
          <span className="text-white">{request.positionName}</span>
        </p>
      </div>

      {loading ? (
        <div className="bg-[#050505] rounded-xl border border-white/8 p-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : (
        <>
          {/* Fixed fields */}
          <DetailCard title="Fixed Fields (Mandatory)">
            <p className="text-[12px] text-[#7a7a7a] mb-4">
              These fields are required and cannot be removed
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FIXED_FIELDS.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0a0a0a] rounded-lg border border-white/5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {f.label}
                    </p>
                    <p className="text-[11px] text-[#7a7a7a] mt-0.5">
                      {f.type}
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex px-2 py-0.5 rounded text-[11px] font-medium text-[#a8a8a8] bg-white/5 ring-1 ring-white/10">
                    Required
                  </span>
                </div>
              ))}
            </div>
          </DetailCard>

          {/* Add custom field */}
          <DetailCard title="Add Custom Field">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <Field label="Label">
                <TextInput
                  value={newLabel}
                  onChange={setNewLabel}
                  placeholder="e.g., LinkedIn Profile"
                />
              </Field>
              <Field label="Type">
                <SelectInput
                  value={newType}
                  onChange={(v) => setNewType(v as CustomFieldType)}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="upload">Upload</option>
                </SelectInput>
              </Field>
              <button
                type="button"
                onClick={handleAdd}
                className="flex items-center justify-center gap-2 h-11 px-4 text-sm font-semibold text-brand-foreground bg-brand rounded-lg hover:bg-brand/90 transition-colors cursor-pointer shadow-lg shadow-brand/10"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            {draft.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-[12px] font-medium text-[#a8a8a8] uppercase tracking-wider">
                  Custom Fields ({draft.length})
                </h4>
                {draft.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0a0a0a] rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm text-white truncate">
                        {f.label}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#a8a8a8] bg-white/5 ring-1 ring-white/10">
                        {TYPE_ICON[f.type]}
                        {TYPE_LABEL[f.type]}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(f.id)}
                      title="Remove field"
                      className="p-1.5 hover:bg-white/8 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </DetailCard>

          {/* Footer actions */}
          <div className="bg-[#050505] rounded-xl border border-white/8 p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[#7a7a7a]">
              {published.length > 0
                ? `${published.length} field${
                    published.length !== 1 ? "s" : ""
                  } currently published`
                : "No fields published yet"}
              {isDirty && (
                <span className="ml-2 text-amber-300">• Unsaved changes</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || publishing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Form
              </button>
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                disabled={saving || publishing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eye className="h-4 w-4" />
                Preview Form
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || publishing || !isDirty}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#7c3aed] rounded-lg hover:bg-[#6d28d9] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Publish Form
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Pipeline (grid of applicants for a recruitment request)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_META: Record<CandidateStage, { label: string; cls: string }> = {
  applied: {
    label: "Applied",
    cls: "text-blue-300 bg-blue-500/10 ring-1 ring-blue-500/20",
  },
  reviewing: {
    label: "Reviewing",
    cls: "text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20",
  },
  shortlisted: {
    label: "Shortlisted",
    cls: "text-purple-300 bg-purple-500/10 ring-1 ring-purple-500/20",
  },
  interview: {
    label: "Interview",
    cls: "text-cyan-300 bg-cyan-500/10 ring-1 ring-cyan-500/20",
  },
  offer: {
    label: "Offer",
    cls: "text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/20",
  },
  hired: {
    label: "Hired",
    cls: "text-green-400 bg-green-500/10 ring-1 ring-green-500/20",
  },
  rejected: {
    label: "Rejected",
    cls: "text-red-400 bg-red-500/10 ring-1 ring-red-500/20",
  },
};

const STAGE_OPTIONS: CandidateStage[] = [
  "applied",
  "reviewing",
  "shortlisted",
  "interview",
  "offer",
  "hired",
  "rejected",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CandidatePipelineView({
  request,
  onBack,
  onViewCandidate,
}: {
  request: RecruitmentRequest;
  onBack: () => void;
  onViewCandidate: (c: Candidate) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const mounted = useRef(true);
  const pg = usePagination(candidates);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCandidates({
        requestId: request._id,
        pageSize: 100,
      });
      if (!mounted.current) return;
      setCandidates(res.candidates || []);
    } catch {
      if (mounted.current) toast.error("Failed to load candidates");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request._id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStageChange(id: string, stage: CandidateStage) {
    if (savingId) return;
    setSavingId(id);
    try {
      const res = await updateCandidateStage(id, { stage });
      if (!mounted.current) return;
      setCandidates((list) =>
        list.map((c) => (c._id === id ? { ...c, ...res.candidate } : c))
      );
      setEditingId(null);
      toast.success("Status updated");
    } catch {
      if (mounted.current) toast.error("Failed to update status");
    } finally {
      if (mounted.current) setSavingId(null);
    }
  }

  function handleWhatsApp(c: Candidate) {
    const phone = c.mobileNumber.replace(/\D/g, "");
    if (!phone) {
      toast.error("No valid phone number for this candidate");
      return;
    }
    const text = encodeURIComponent(
      `Hi ${c.fullName}, thank you for applying to ${request.positionName}.`
    );
    window.open(
      `https://wa.me/${phone}?text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleDownloadAll() {
    if (downloading) return;
    const targets = candidates.filter((c) => c.stage !== "rejected");
    if (targets.length === 0) {
      toast.info("No candidates available for download");
      return;
    }
    setDownloading(true);
    let success = 0;
    try {
      for (const c of targets) {
        try {
          const res = await getCandidateResumeUrl(c._id);
          const blob = await fetch(res.url).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.blob();
          });
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = res.fileName || `${c.fullName}_resume`;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          // defer revoke so browser has time to start the download
          setTimeout(() => URL.revokeObjectURL(href), 2000);
          success++;
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          // continue with remaining candidates
        }
      }
      if (!mounted.current) return;
      if (success === 0) toast.error("Failed to download resumes");
      else
        toast.success(
          `Downloaded ${success} of ${targets.length} resume${
            targets.length !== 1 ? "s" : ""
          }`
        );
    } finally {
      if (mounted.current) setDownloading(false);
    }
  }

  function notImplemented() {
    toast.info("Coming soon");
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Candidate Pipeline
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">
          Manage candidates across stages
        </p>
      </div>

      {/* Header card: back + actions + title/count */}
      <div className="bg-[#050505] rounded-xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Request
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={notImplemented}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#7c3aed] rounded-lg hover:bg-[#6d28d9] transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Run AI Screening
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={downloading || loading || candidates.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download All CVs
            </button>
          </div>
        </div>
        <h2 className="text-[22px] font-semibold text-white tracking-tight">
          Candidates — {request.positionName}
        </h2>
        <p className="text-sm text-[#a8a8a8] mt-1">
          {candidates.length} total application
          {candidates.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Grid */}
      <div className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {[
                  "Candidate Name",
                  "Mobile Number",
                  "Years of Experience",
                  "AI Score",
                  "Status",
                  "Rejection Type",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-[#7a7a7a] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || pg.transitioning ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand inline-block" />
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="text-xs text-[#a8a8a8]">No applications yet</p>
                    <p className="text-xs text-[#5a5a5a] mt-0.5">
                      Applications will appear here once candidates apply
                    </p>
                  </td>
                </tr>
              ) : (
                pg.pageItems.map((c) => {
                  const stageMeta = STAGE_META[c.stage];
                  const isEditing = editingId === c._id;
                  const isSaving = savingId === c._id;
                  return (
                    <tr
                      key={c._id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-[11px] font-semibold">
                            {initials(c.fullName)}
                          </div>
                          <span className="text-sm font-medium text-white">
                            {c.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#a8a8a8]">
                        {c.mobileNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#a8a8a8]">
                        {c.yearsOfExperience} year
                        {c.yearsOfExperience !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5a5a5a]">—</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              autoFocus
                              disabled={isSaving}
                              value={c.stage}
                              onChange={(e) =>
                                handleStageChange(
                                  c._id,
                                  e.target.value as CandidateStage
                                )
                              }
                              className="bg-[#0a0a0a] border border-white/10 rounded-md h-7 px-2 text-xs text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 disabled:opacity-50"
                            >
                              {STAGE_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {STAGE_META[s].label}
                                </option>
                              ))}
                            </select>
                            {isSaving && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#a8a8a8]" />
                            )}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${stageMeta.cls}`}
                          >
                            {stageMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5a5a5a]">—</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <IconBtn
                            title="View Application"
                            onClick={() => onViewCandidate(c)}
                          >
                            <Eye className="h-3.5 w-3.5 text-[#a8a8a8]" />
                          </IconBtn>
                          <IconBtn
                            title="Change Status"
                            onClick={() =>
                              setEditingId(isEditing ? null : c._id)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-400" />
                          </IconBtn>
                          <IconBtn
                            title="Send WhatsApp Message"
                            onClick={() => handleWhatsApp(c)}
                          >
                            <svg
                              className="h-3.5 w-3.5 text-[#25D366]"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pg.page}
          totalPages={pg.totalPages}
          total={pg.total}
          start={pg.start}
          end={pg.end}
          loading={pg.transitioning}
          onPrev={pg.goPrev}
          onNext={pg.goNext}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Application (single-candidate detail view)
// ─────────────────────────────────────────────────────────────────────────────

function CandidateApplicationView({
  request,
  candidate,
  onBack,
}: {
  request: RecruitmentRequest;
  candidate: Candidate;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState<Candidate>(candidate);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : "—";

  async function handleStageChange(stage: CandidateStage) {
    if (saving || stage === current.stage) return;
    setSaving(true);
    try {
      const res = await updateCandidateStage(current._id, { stage });
      if (!mounted.current) return;
      setCurrent((c) => ({ ...c, ...res.candidate }));
      toast.success("Status updated");
    } catch {
      if (mounted.current) toast.error("Failed to update status");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function handleDownloadResume() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await getCandidateResumeUrl(current._id);
      const blob = await fetch(res.url).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = res.fileName || `${current.fullName}_resume`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } catch {
      if (mounted.current) toast.error("Failed to download resume");
    } finally {
      if (mounted.current) setDownloading(false);
    }
  }

  const stageMeta = STAGE_META[current.stage];

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Candidate Application
        </h1>
        <p className="text-[11px] text-[#7a7a7a] mt-0.5">
          {request.positionName}
        </p>
      </div>

      {/* Header card: back + status select + avatar/name/status */}
      <div className="bg-[#050505] rounded-xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Candidate List
          </button>
          <div className="flex items-center gap-2">
            <select
              value={current.stage}
              disabled={saving}
              onChange={(e) =>
                handleStageChange(e.target.value as CandidateStage)
              }
              className="bg-[#0a0a0a] border border-white/10 rounded-lg h-9 px-3 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 disabled:opacity-50 cursor-pointer"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </select>
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin text-[#a8a8a8]" />
            )}
          </div>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-semibold shrink-0">
              {initials(current.fullName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold text-white tracking-tight truncate">
                {current.fullName}
              </h2>
              <p className="text-sm text-[#a8a8a8] mt-1">
                {current.yearsOfExperience} year
                {current.yearsOfExperience !== 1 ? "s" : ""} of experience
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex px-3 py-1 rounded-md text-sm font-medium ${stageMeta.cls}`}
          >
            {stageMeta.label}
          </span>
        </div>
      </div>

      {/* Candidate Information */}
      <DetailCard title="Candidate Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoRow
            icon={<User className="h-5 w-5 text-blue-400" />}
            iconCls="bg-blue-500/10"
            label="Full Name"
            value={current.fullName}
          />
          <InfoRow
            icon={<Mail className="h-5 w-5 text-purple-400" />}
            iconCls="bg-purple-500/10"
            label="Email ID"
            value={current.email}
          />
          <InfoRow
            icon={<Phone className="h-5 w-5 text-green-400" />}
            iconCls="bg-green-500/10"
            label="Mobile Number"
            value={current.mobileNumber}
          />
          <InfoRow
            icon={<Briefcase className="h-5 w-5 text-orange-400" />}
            iconCls="bg-orange-500/10"
            label="Years of Experience"
            value={`${current.yearsOfExperience} year${
              current.yearsOfExperience !== 1 ? "s" : ""
            }`}
          />
        </div>
      </DetailCard>

      {/* Resume */}
      <DetailCard title="Resume">
        <div className="flex items-center gap-3 p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
          <FileText className="h-8 w-8 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {current.resumeFileName}
            </p>
            <p className="text-xs text-[#7a7a7a] mt-0.5">
              Uploaded on {fmtDate(current.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadResume}
            disabled={downloading}
            className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/15 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Resume
          </button>
        </div>
      </DetailCard>

      {/* Experience Details */}
      <DetailCard title="Experience Details">
        <p className="text-sm text-white leading-relaxed whitespace-pre-line">
          {current.experienceDetails?.trim() || "—"}
        </p>
      </DetailCard>

      {/* Compensation & Availability */}
      <DetailCard title="Compensation & Availability">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoRow
            icon={<DollarSign className="h-5 w-5 text-green-400" />}
            iconCls="bg-green-500/10"
            label="Current CTC"
            value={current.currentCtc?.trim() || "—"}
          />
          <InfoRow
            icon={<DollarSign className="h-5 w-5 text-blue-400" />}
            iconCls="bg-blue-500/10"
            label="Expected CTC"
            value={current.expectedCtc?.trim() || "—"}
          />
          <InfoRow
            icon={<Clock className="h-5 w-5 text-orange-400" />}
            iconCls="bg-orange-500/10"
            label="Notice Period"
            value={current.noticePeriod?.trim() || "—"}
          />
        </div>
      </DetailCard>

      {/* Additional Information (custom fields) */}
      {current.customFieldValues && current.customFieldValues.length > 0 && (
        <DetailCard title="Additional Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {current.customFieldValues.map((v) => (
              <CustomFieldValueRow
                key={v.fieldId}
                candidateId={current._id}
                entry={v}
              />
            ))}
          </div>
        </DetailCard>
      )}

      {/* Application Status */}
      <DetailCard title="Application Status">
        <DetailGrid
          items={[
            ["Applied Date", fmtDate(current.createdAt)],
            ["Current Status", stageMeta.label],
            ["Rejection Type", "—"],
          ]}
        />
      </DetailCard>
    </div>
  );
}

function CustomFieldValueRow({
  candidateId,
  entry,
}: {
  candidateId: string;
  entry: CustomFieldValue;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await getCandidateCustomFileUrl(candidateId, entry.fieldId);
      const blob = await fetch(res.url).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = res.fileName || entry.fileName || "file";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } catch {
      toast.error("Failed to download file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium text-[#7a7a7a] mb-1">
        {entry.label}
      </span>
      {entry.type === "upload" ? (
        entry.fileKey ? (
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="self-start inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {entry.fileName || "Download"}
          </button>
        ) : (
          <span className="text-sm text-white">—</span>
        )
      ) : (
        <span className="text-sm text-white break-words">
          {entry.value || "—"}
        </span>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  iconCls,
  label,
  value,
}: {
  icon: ReactNode;
  iconCls: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${iconCls}`}>{icon}</div>
      <div className="min-w-0">
        <label className="text-[11px] font-medium text-[#7a7a7a] block mb-1">
          {label}
        </label>
        <p className="text-sm text-white break-words">{value}</p>
      </div>
    </div>
  );
}

function ApplyField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#c8c8c8] mb-2">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ApplyInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
    />
  );
}

function PreviewBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold text-white mb-3">{title}</h3>
      <p className="text-sm text-[#c8c8c8] leading-relaxed whitespace-pre-line">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

function ViewActionBtn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a8a8a8] bg-transparent border border-white/10 rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
    >
      {icon}
      {children}
    </button>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-[#050505] rounded-xl border border-white/8 p-6">
      <h2 className="text-[15px] font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className="text-[11px] font-medium text-[#7a7a7a] mb-1">
            {label}
          </span>
          <span className="text-sm text-white">{value || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-[#7a7a7a] block mb-2">
        {label}
      </span>
      <p className="text-sm text-white leading-relaxed whitespace-pre-line">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form primitives
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#a8a8a8] mb-1.5 block uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
    />
  );
}

function DateInput({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    // Prefer the modern showPicker API; fall back to focus for older browsers.
    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
      try {
        (el as HTMLInputElement & { showPicker: () => void }).showPicker();
        return;
      } catch {}
    }
    el.focus();
  };
  return (
    <input
      ref={ref}
      type="date"
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      onClick={open}
      onFocus={open}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors [color-scheme:dark] cursor-pointer"
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg h-11 px-3 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
    >
      {children}
    </select>
  );
}

/** Lightweight multi-select. Renders a button surface with selected items
 *  as removable chips and a dropdown panel with checkbox options. */
function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  const selected = options.filter((o) => value.includes(o.value));
  // Preserve any selected names that aren't in the current options list
  // (e.g. an approver who was removed from the org or whose role changed
  // since the request was saved). Keeps editing non-destructive.
  const orphanSelected = value.filter(
    (v) => !options.some((o) => o.value === v)
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors min-h-[44px]"
      >
        {selected.length === 0 && orphanSelected.length === 0 ? (
          <span className="text-[#5a5a5a]">
            {placeholder || "Select..."}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...selected.map((o) => o.value), ...orphanSelected].map(
              (val) => {
                const opt = options.find((o) => o.value === val);
                const label = opt ? opt.label : val;
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/15 text-brand text-xs rounded"
                  >
                    {label}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(value.filter((x) => x !== val));
                      }}
                      className="cursor-pointer hover:text-white leading-none"
                    >
                      ×
                    </span>
                  </span>
                );
              }
            )}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-[#0a0a0a] border border-white/8 rounded-lg shadow-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#7a7a7a]">
              No options available
            </div>
          ) : (
            options.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex items-center gap-2"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked
                        ? "bg-brand border-brand"
                        : "border-white/20"
                    }`}
                  >
                    {checked && (
                      <CheckCircle2 className="h-3 w-3 text-black" />
                    )}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-colors"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination (mirrors AttendanceSection)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function usePagination<T>(data: T[], pageSize: number = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pageItems = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize]
  );

  const go = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(1, next), totalPages);
      if (target === safePage) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setTransitioning(true);
      timerRef.current = setTimeout(() => {
        setPage(target);
        setTransitioning(false);
        timerRef.current = null;
      }, 250);
    },
    [safePage, totalPages]
  );

  return {
    page: safePage,
    totalPages,
    pageItems,
    transitioning,
    goNext: () => go(safePage + 1),
    goPrev: () => go(safePage - 1),
    total: data.length,
    start: data.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, data.length),
  };
}

function Pagination({
  page,
  totalPages,
  total,
  start,
  end,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
      <span className="text-xs text-[#7a7a7a]">
        Showing <span className="text-white font-medium">{start}</span>–
        <span className="text-white font-medium">{end}</span> of{" "}
        <span className="text-white font-medium">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1 || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>
        <span className="text-xs text-[#7a7a7a] px-1">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#a8a8a8] bg-[#0e0e12] border border-white/8 rounded-md hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
