"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Check,
  User,
  Briefcase,
  GraduationCap,
  Building2,
  DollarSign,
  FileText,
  Landmark,
  Clock,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getEmployee,
  upsertEmployee,
  updateEmployeeProfile,
  listBranches,
  listDepartments,
  listShifts,
  listWeeklyOffPatterns,
  listEmployees,
  listSalaryStructures,
  listPTSlabs,
  uploadFile,
} from "../api";
import type {
  Branch,
  Department,
  Shift,
  WeeklyOffPattern,
  EducationEntry,
  WorkExperienceEntry,
  CustomAmount,
  EmployeeListItem,
  SalaryStructure,
  Section,
} from "../types";
import InfoCard from "../lib/InfoCard";
import { getUserIdFromToken } from "@/lib/auth";

interface Props {
  mode: "add" | "edit";
  userId?: string | null;
  hasWriteAccess: boolean;
  /** When true, the form is being used by a non-admin user to edit their own
   *  profile. Fields are editable but sensitive/manager-only sections are
   *  hidden, and Save is shown. The backend enforces the same restrictions. */
  selfEdit?: boolean;
  /** First-time self-onboarding for a newly-invited employee with no
   *  Teamforce profile yet. Same as selfEdit, but also hides the
   *  admin-assigned "Joining & Organization Details" section (branch,
   *  department, designation, reporting manager, etc. get set by HR later)
   *  and reports back via onOnboardingComplete instead of navigating. */
  onboarding?: boolean;
  onOnboardingComplete?: () => void;
  onNavigate: (section: Section) => void;
}

function getId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val)
    return (val as { _id: string })._id;
  return "";
}

export default function EmployeeForm({ mode, userId, hasWriteAccess, selfEdit = false, onboarding = false, onOnboardingComplete, onNavigate }: Props) {
  // Effective write access: admins always write; self-edit users can also write
  // (but gated sections stay hidden — handled via `canSeeSensitive`).
  const canWrite = hasWriteAccess || selfEdit;
  // True when an admin/founder is editing their OWN profile — hierarchy
  // (reporting manager etc.) doesn't apply to yourself, so that section is
  // hidden and its required-field validation skipped.
  const isEditingSelf =
    mode === "edit" && !!userId && userId === getUserIdFromToken();
  // Only admins/founders see: salary/TDS, reporting hierarchy, attendance,
  // offer letter, exit/F&F. Employees can see bank details (self-managed).
  const canSeeSensitive = hasWriteAccess;
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [dobError, setDobError] = useState("");
  const [degreeErrors, setDegreeErrors] = useState<string[]>([]);
  const [yearErrors, setYearErrors] = useState<string[]>([]);
  const [companyErrors, setCompanyErrors] = useState<string[]>([]);
  const [expErrors, setExpErrors] = useState<string[]>([]);
  const [designationError, setDesignationError] = useState("");
  const [workDesignationErrors, setWorkDesignationErrors] = useState<string[]>([]);
  const [refNameErrors, setRefNameErrors] = useState<string[]>([]);
  const [joiningDateError, setJoiningDateError] = useState("");
  const [exitedAtError, setExitedAtError] = useState("");
  const [placeOfJoiningError, setPlaceOfJoiningError] = useState("");
  const [bankHolderNameError, setBankHolderNameError] = useState("");
  const [bankAccountNumberError, setBankAccountNumberError] = useState("");
  const [ifscError, setIfscError] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weeklyOffPatterns, setWeeklyOffPatterns] = useState<WeeklyOffPattern[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeListItem[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [ptStates, setPtStates] = useState<string[]>([]);

  const [form, setForm] = useState({
    email: "", name: "", mobileNumber: "", pan: "", dateOfBirth: "",
    exitedAt: "", exitReason: "",
    permanentAddress: "", currentAddress: "", sameAsPermanent: false,
    dateOfJoining: "", placeOfJoining: "", branchId: "", departmentId: "",
    designation: "", employmentType: "",
    state: "", cityType: "",
    reportingManagerId: "", secondaryReviewerId: "", managesTeam: false,
    salaryStructureId: "", monthlyCtc: 0,
    basicSalary: 0, hra: 0, transportAllowance: 0, providentFund: 0,
    professionalTax: 0, variablePay: 0,
    pfOption: "CEILING", esiApplicable: false,
    tdsRegime: "", estimatedAnnualTds: 0, autoCalculateTds: false,
    shiftId: "", weeklyOffPatternId: "",
    offerLetterUrl: "", idProofUrl: "", educationCertificatesUrl: "", experienceLettersUrl: "",
    bankAccountHolderName: "", bankAccountType: "", bankAccountNumber: "", bankIfscCode: "",
  });

  const [education, setEducation] = useState<EducationEntry[]>([{ degreeName: "", yearOfPassing: "", certificateUrl: "" }]);
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>([{ companyName: "", yearsOfExperience: "", designation: "", referenceName: "", referenceContact: "" }]);
  const [customAllowances, setCustomAllowances] = useState<CustomAmount[]>([]);
  const [customDeductions, setCustomDeductions] = useState<CustomAmount[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([listBranches(), listDepartments(), listShifts(), listWeeklyOffPatterns(), listEmployees(), listSalaryStructures(), listPTSlabs()])
      .then(([b, d, s, w, e, ss, pt]) => {
        setBranches(b.branches || []);
        setDepartments(d.departments || []);
        setShifts(s.shifts || []);
        setWeeklyOffPatterns(w.patterns || []);
        setAllEmployees(e.employees || []);
        setSalaryStructures(ss.structures || []);
        setPtStates(pt.states || []);
      })
      .catch(() => {/* fields without these lists just render empty */});
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !userId) return;
    getEmployee(userId)
      .then((data) => {
        const p = data.profile;
        setForm({
          email: data.email || "", name: data.name || "",
          mobileNumber: p?.mobileNumber || "", pan: p?.pan || "",
          dateOfBirth: p?.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
          exitedAt: p?.exitedAt ? new Date(p.exitedAt).toISOString().split("T")[0] : "",
          exitReason: p?.exitReason || "",
          permanentAddress: p?.permanentAddress || "", currentAddress: p?.currentAddress || "",
          sameAsPermanent: p?.sameAsPermanent || false,
          dateOfJoining: p?.dateOfJoining ? new Date(p.dateOfJoining).toISOString().split("T")[0] : "",
          placeOfJoining: p?.placeOfJoining || "",
          branchId: getId(p?.branchId), departmentId: getId(p?.departmentId),
          designation: p?.designation || "", employmentType: p?.employmentType || "",
          state: p?.state || "", cityType: p?.cityType || "",
          reportingManagerId: getId(p?.reportingManagerId),
          secondaryReviewerId: getId(p?.secondaryReviewerId),
          managesTeam: p?.managesTeam || false,
          salaryStructureId: getId(p?.salaryStructureId),
          monthlyCtc: p?.monthlyCtc || 0,
          basicSalary: p?.basicSalary || 0, hra: p?.hra || 0,
          transportAllowance: p?.transportAllowance || 0, providentFund: p?.providentFund || 0,
          professionalTax: p?.professionalTax || 0, variablePay: p?.variablePay || 0,
          pfOption: p?.pfOption || "CEILING", esiApplicable: p?.esiApplicable || false,
          tdsRegime: p?.tdsRegime || "", estimatedAnnualTds: p?.estimatedAnnualTds || 0,
          autoCalculateTds: p?.autoCalculateTds || false,
          shiftId: getId(p?.shiftId),
          weeklyOffPatternId: getId(p?.weeklyOffPatternId),
          offerLetterUrl: p?.offerLetterUrl || "", idProofUrl: p?.idProofUrl || "",
          educationCertificatesUrl: p?.educationCertificatesUrl || "",
          experienceLettersUrl: p?.experienceLettersUrl || "",
          bankAccountHolderName: p?.bankAccountHolderName || "",
          bankAccountType: p?.bankAccountType || "",
          bankAccountNumber: p?.bankAccountNumber || "", bankIfscCode: p?.bankIfscCode || "",
        });
        if (p?.education?.length) setEducation(p.education);
        if (p?.workExperience?.length) setWorkExperience(p.workExperience);
        if (p?.customAllowances?.length) setCustomAllowances(p.customAllowances);
        if (p?.customDeductions?.length) setCustomDeductions(p.customDeductions);
      })
      .catch(() => toast.error("Failed to load employee data"))
      .finally(() => setLoading(false));
  }, [mode, userId]);

  function set(field: string, value: unknown) { setForm((p) => ({ ...p, [field]: value })); }

  async function handleFileUpload(field: string, file: File) {
    setUploading((p) => ({ ...p, [field]: true }));
    try {
      const res = await uploadFile(file);
      set(field, res.url);
      toast.success(`${file.name} uploaded`);
    } catch { toast.error("Upload failed"); }
    finally { setUploading((p) => ({ ...p, [field]: false })); }
  }

  async function handleSave() {
    if (!form.name) { toast.error("Full Legal Name is required"); return; }
    if (form.name && form.name.length > 100) { toast.error("Full Legal Name must be 100 characters or fewer"); return; }
    if (form.name && !/^[\p{L}\s.\-']+$/u.test(form.name)) { toast.error("Full Legal Name should contain only letters, spaces, hyphens, apostrophes, or periods"); return; }
    if (mode === "add" && !form.email) { toast.error("Email is required"); return; }
    if (mode === "add" && form.email && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,8}$/.test(form.email)) { toast.error("Enter a valid email address"); return; }
    if (mode === "add" && form.email && allEmployees.some((emp) => emp.email.toLowerCase() === form.email.toLowerCase())) { toast.error("This email is already assigned to another employee"); return; }
    if (!form.mobileNumber) { toast.error("Mobile Number is required"); return; }
    if (form.mobileNumber && (() => { const d = form.mobileNumber.replace(/\D/g, ""); return d.length < 7 || d.length > 15; })()) { toast.error("Enter a valid phone number"); return; }
    if (form.dateOfBirth && form.dateOfBirth > new Date().toISOString().split("T")[0]) { toast.error("Date of Birth cannot be a future date"); return; }
    if (education.some((e) => e.degreeName && e.degreeName.length > 100)) { toast.error("Degree name must be 100 characters or fewer"); return; }
    if (education.some((e, i) => e.degreeName && !/^[\p{L}\s.,()\-']+$/u.test(e.degreeName))) { toast.error("One or more degree names contain invalid characters"); return; }
    if (education.some((e) => { const y = e.yearOfPassing; return y && (y.length !== 4 || Number(y) < 1900 || Number(y) > new Date().getFullYear()); })) { toast.error("One or more year of passing values are invalid"); return; }
    if (workExperience.some((e) => e.companyName && e.companyName.length > 100)) { toast.error("Company name must be 100 characters or fewer"); return; }
    if (workExperience.some((e) => e.companyName && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(e.companyName))) { toast.error("One or more company names contain invalid characters"); return; }
    if (workExperience.some((e) => e.designation && e.designation.length > 100)) { toast.error("Work experience designation must be 100 characters or fewer"); return; }
    if (workExperience.some((e) => e.designation && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(e.designation))) { toast.error("One or more work experience designations contain invalid characters"); return; }
    if (workExperience.some((e) => { const v = e.yearsOfExperience; return v && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 50); })) { toast.error("One or more years of experience values are invalid (0–50)"); return; }
    if (workExperience.some((e) => e.referenceName && e.referenceName.length > 100)) { toast.error("Reference name must be 100 characters or fewer"); return; }
    if (workExperience.some((e) => e.referenceName && !/^[\p{L}\s.\-']+$/u.test(e.referenceName))) { toast.error("One or more reference names contain invalid characters (letters only)"); return; }
    if (!onboarding && !form.dateOfJoining) { toast.error("Date of Joining is required"); return; }
    if (form.dateOfJoining && new Date(form.dateOfJoining).getFullYear() < 1900) { toast.error("Enter a valid Date of Joining (year must be 1900 or later)"); return; }
    if (form.dateOfJoining && form.dateOfJoining > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]) { toast.error("Date of Joining cannot be more than 1 year in the future"); return; }
    // Cross-field date & experience validations
    const dobYear = form.dateOfBirth ? new Date(form.dateOfBirth).getFullYear() : null;
    const dojYear = form.dateOfJoining ? new Date(form.dateOfJoining).getFullYear() : null;
    const lwdYear = form.exitedAt ? new Date(form.exitedAt).getFullYear() : null;
    const currentYear = new Date().getFullYear();
    if (form.dateOfBirth && form.dateOfJoining && form.dateOfJoining < form.dateOfBirth) { toast.error("Date of Joining cannot be before the Date of Birth"); return; }
    if (form.dateOfBirth && form.exitedAt && form.exitedAt < form.dateOfBirth) { toast.error("Last Working Day cannot be before the Date of Birth"); return; }
    if (form.dateOfJoining && form.exitedAt && form.exitedAt <= form.dateOfJoining) { toast.error("Last Working Day must be after the Date of Joining"); return; }
    if (form.dateOfJoining && form.exitedAt) { const tenureYears = (new Date(form.exitedAt).getTime() - new Date(form.dateOfJoining).getTime()) / (365.25 * 24 * 60 * 60 * 1000); if (tenureYears > 50) { toast.error("Duration between Date of Joining and Last Working Day cannot exceed 50 years"); return; } }
    const maxLwdDate = new Date(); maxLwdDate.setMonth(maxLwdDate.getMonth() + 6);
    if (form.exitedAt && form.exitedAt > maxLwdDate.toISOString().split("T")[0]) { toast.error("Last Working Day cannot be more than 6 months in the future"); return; }
    if (dobYear && education.some((e) => e.yearOfPassing && Number(e.yearOfPassing) < dobYear)) { toast.error("Year of Passing cannot be before the employee's birth year"); return; }
    if (dobYear && education.some((e) => e.yearOfPassing && (Number(e.yearOfPassing) - dobYear) < 14)) { toast.error("Year of Passing is unrealistic — employee must be at least 14 years old to complete a qualification"); return; }
    if (dojYear && education.some((e) => e.yearOfPassing && Number(e.yearOfPassing) > dojYear)) { toast.error("Date of Joining cannot be before the Year of Passing of a qualification"); return; }
    if (lwdYear && education.some((e) => e.yearOfPassing && Number(e.yearOfPassing) > lwdYear)) { toast.error("Last Working Day cannot be before the Year of Passing of a qualification"); return; }
    const totalExp = workExperience.reduce((sum, e) => sum + (parseFloat(e.yearsOfExperience || "0") || 0), 0);
    if (totalExp > 0 && dobYear && totalExp > (currentYear - dobYear)) { toast.error(`Total work experience (${totalExp} yrs) cannot exceed the employee's age (${currentYear - dobYear} yrs)`); return; }
    const earliestPassOut = education.reduce<number | null>((min, e) => { const y = e.yearOfPassing && e.yearOfPassing.length === 4 ? Number(e.yearOfPassing) : null; return y && (!min || y < min) ? y : min; }, null);
    if (totalExp > 0 && earliestPassOut && totalExp > (currentYear - earliestPassOut)) { toast.error(`Total experience (${totalExp} yrs) exceeds years since earliest qualification (${currentYear - earliestPassOut} yrs)`); return; }
    if (form.placeOfJoining && !/^[\p{L}\s.,\-']+$/u.test(form.placeOfJoining)) { toast.error("Place of Joining should contain only letters"); return; }
    if (form.bankAccountHolderName && form.bankAccountHolderName.length > 100) { toast.error("Account holder name must be 100 characters or fewer"); return; }
    if (form.bankAccountHolderName && !/^[\p{L}\s.\-']+$/u.test(form.bankAccountHolderName)) { toast.error("Account holder name should contain only letters"); return; }
    if (form.bankAccountNumber && (!/^\d+$/.test(form.bankAccountNumber) || form.bankAccountNumber.length < 6 || form.bankAccountNumber.length > 20)) { toast.error("Account number must be 6–20 digits"); return; }
    if (form.bankIfscCode && (!/^[A-Z0-9\-]+$/.test(form.bankIfscCode) || form.bankIfscCode.replace(/-/g, "").length < 6 || form.bankIfscCode.replace(/-/g, "").length > 15)) { toast.error("Enter a valid bank/IFSC code (6–15 alphanumeric characters)"); return; }
    if (!selfEdit) {
      if (!form.branchId) { toast.error("Branch is required"); return; }
      if (!form.departmentId) { toast.error("Department is required"); return; }
      if (!form.designation) { toast.error("Designation is required"); return; }
      if (form.designation && form.designation.length > 100) { toast.error("Designation must be 100 characters or fewer"); return; }
      if (form.designation && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(form.designation)) { toast.error("Designation contains invalid characters"); return; }
      if (!form.employmentType) { toast.error("Employment Type is required"); return; }
      if (!isEditingSelf && !form.reportingManagerId) { toast.error("Reporting Manager is required"); return; }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.education = education.filter((e) => e.degreeName);
      payload.workExperience = workExperience.filter((e) => e.companyName);
      payload.customAllowances = customAllowances.filter((a) => a.name);
      payload.customDeductions = customDeductions.filter((d) => d.name);
      // exitedAt is special — an explicit empty string means "clear the
      // exit", which must propagate as null (not be stripped from payload).
      const wantsClearExit = payload.exitedAt === "";
      for (const key of Object.keys(payload)) { if (payload[key] === "") delete payload[key]; }
      if (wantsClearExit) payload.exitedAt = null;
      if (form.email) payload.email = form.email;
      if (form.name) payload.name = form.name;
      if (mode === "add") {
        await upsertEmployee(payload);
        toast.success("Employee added successfully");
      } else if (userId) {
        delete payload.email;
        await updateEmployeeProfile(userId, payload);
        toast.success(onboarding ? "Profile saved — welcome aboard!" : "Employee updated successfully");
      }
      if (onboarding && onOnboardingComplete) {
        onOnboardingComplete();
      } else {
        onNavigate("employees");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employee");
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  // Read-only: true when the user can't write anything at all
  // (should never happen now — either admin/founder OR self-edit).
  const ro = !canWrite;
  // Manager-controlled fields: read-only for self-edit users
  const roManaged = selfEdit ? true : ro;

  const headerTitle = onboarding
    ? "Welcome! Complete Your Profile"
    : selfEdit
      ? "My Information"
      : mode === "add"
        ? "Add Employee"
        : "Edit Employee";
  const headerSubtitle = onboarding
    ? "Fill in your details to get started — your HR admin will set up the rest"
    : selfEdit
      ? "View and update your personal details"
      : mode === "add"
        ? "Fill in employee details below"
        : `Editing ${form.name || form.email}`;

  return (
    <div className="max-w-4xl animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        {!onboarding && (
          <button
            onClick={() => onNavigate(mode === "add" ? "add-employee" : "employees")}
            className="h-9 w-9 rounded-xl bg-[#050505] hover:bg-white/8 flex items-center justify-center cursor-pointer transition-all duration-150 group"
          >
            <ArrowLeft className="h-4 w-4 text-[#a8a8a8] group-hover:text-white transition-colors" />
          </button>
        )}
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            {headerTitle}
          </h2>
          <p className="text-[12px] text-[#a8a8a8] mt-0.5">
            {headerSubtitle}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. Basic & Personal */}
        <FormCard icon={User} title="Basic & Personal Information" index={0}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Legal Name" required>
              <Input
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 100);
                  set("name", val);
                  if (!val) { setNameError(""); return; }
                  if (val.length >= 100) { setNameError("Name must be 100 characters or fewer"); return; }
                  setNameError(!/^[\p{L}\s.\-']+$/u.test(val) ? "Name should contain only letters, spaces, hyphens, apostrophes, or periods" : "");
                }}
                placeholder="Enter full name"
                maxLength={100}
                disabled={ro}
                title={ro ? form.name : undefined}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors${nameError ? " border-red-500/50" : ""}`}
              />
              {nameError && <p className="text-[11px] text-red-400 mt-1">{nameError}</p>}
            </Field>
            <Field label="Mobile Number" required>
              <Input
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d+\-\s().]/g, "");
                  set("mobileNumber", val);
                  const digits = val.replace(/\D/g, "");
                  setMobileError(!val ? "Mobile Number is required" : (digits.length < 7 || digits.length > 15) ? "Enter a valid phone number (e.g. +1 555 000 0000)" : "");
                }}
                placeholder="+1 555 000 0000"
                disabled={ro}
                title={ro ? form.mobileNumber : undefined}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors${mobileError ? " border-red-500/50" : ""}`}
              />
              {mobileError && <p className="text-[11px] text-red-400 mt-1">{mobileError}</p>}
            </Field>
            <Field label="Email ID" required={mode === "add"}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  set("email", val);
                  if (!val) { setEmailError(""); return; }
                  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,8}$/.test(val)) {
                    setEmailError("Enter a valid email address"); return;
                  }
                  const duplicate = allEmployees.find((emp) => emp.email.toLowerCase() === val.toLowerCase());
                  setEmailError(duplicate ? `This email is already assigned to ${duplicate.name}` : "");
                }}
                placeholder="email@example.com"
                disabled={ro || mode === "edit"}
                title={(ro || mode === "edit") ? form.email : undefined}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors${emailError ? " border-red-500/50" : ""}`}
              />
              {emailError && <p className="text-[11px] text-red-400 mt-1">{emailError}</p>}
            </Field>
            <Field label="PAN">
              <Input value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} disabled={ro} className="bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors uppercase tracking-wider" />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dateOfBirth}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  set("dateOfBirth", val);
                  setDobError(val && val > new Date().toISOString().split("T")[0] ? "Date of Birth cannot be a future date" : "");
                }}
                disabled={ro}
                onClick={(e) => {
                  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                  el.showPicker?.();
                }}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors [color-scheme:dark] cursor-pointer${dobError ? " border-red-500/50" : ""}`}
              />
              {dobError && <p className="text-[11px] text-red-400 mt-1">{dobError}</p>}
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Permanent Address">
              <Textarea value={form.permanentAddress} onChange={(e) => set("permanentAddress", e.target.value)} placeholder="Enter permanent address" disabled={ro} title={ro ? form.permanentAddress : undefined} className="bg-[#0a0a0a] border-white/8 min-h-[72px] focus:border-brand/30 transition-colors resize-none" />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
            <Checkbox checked={form.sameAsPermanent} onCheckedChange={(v) => { set("sameAsPermanent", v); if (v) set("currentAddress", form.permanentAddress); }} disabled={ro} />
            <span className="text-[13px] text-[#a8a8a8]">Same as Permanent Address</span>
          </label>
          {!form.sameAsPermanent && (
            <div className="mt-3 animate-[fadeIn_0.2s_ease-out]">
              <Field label="Current Address">
                <Textarea value={form.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} placeholder="Enter current address" disabled={ro} title={ro ? form.currentAddress : undefined} className="bg-[#0a0a0a] border-white/8 min-h-[72px] focus:border-brand/30 transition-colors resize-none" />
              </Field>
            </div>
          )}
        </FormCard>

        {/* 2. Joining & Organization — manager-controlled, read-only for self-edit,
               hidden entirely during first-time onboarding (HR fills it in later) */}
        {!onboarding && (
        <FormCard icon={Building2} title="Joining & Organization Details" index={1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date of Joining" required>
              <Input
                type="date"
                value={form.dateOfJoining}
                min="1900-01-01"
                max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  set("dateOfJoining", val);
                  const yr = val ? new Date(val).getFullYear() : 0;
                  const maxDoj = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                  setJoiningDateError(
                    val && yr < 1900 ? "Enter a valid joining date (year must be 1900 or later)" :
                    val && val > maxDoj ? "Date of Joining cannot be more than 1 year in the future" : ""
                  );
                }}
                disabled={roManaged}
                onClick={(e) => {
                  const el = e.currentTarget as HTMLInputElement & {
                    showPicker?: () => void;
                  };
                  el.showPicker?.();
                }}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors [color-scheme:dark] cursor-pointer${joiningDateError ? " border-red-500/50" : ""}`}
              />
              {joiningDateError && <p className="text-[11px] text-red-400 mt-1">{joiningDateError}</p>}
            </Field>
            <Field label="Place of Joining">
              <Input
                value={form.placeOfJoining}
                onChange={(e) => {
                  const val = e.target.value;
                  set("placeOfJoining", val);
                  setPlaceOfJoiningError(val && !/^[\p{L}\s.,\-']+$/u.test(val) ? "Place of Joining should contain only letters" : "");
                }}
                placeholder="Enter place"
                disabled={roManaged}
                title={roManaged ? form.placeOfJoining : undefined}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors${placeOfJoiningError ? " border-red-500/50" : ""}`}
              />
              {placeOfJoiningError && <p className="text-[11px] text-red-400 mt-1">{placeOfJoiningError}</p>}
            </Field>
            <Field label="Branch" required>
              <Select value={form.branchId} onValueChange={(v) => set("branchId", v)} disabled={roManaged}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">{branches.map((b) => (<SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>))}</SelectContent>
              </Select>
            </Field>
            <Field label="Department" required>
              <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)} disabled={roManaged}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">{departments.map((d) => (<SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>))}</SelectContent>
              </Select>
            </Field>
            <Field label="Designation" required>
              <Input
                value={form.designation}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 100);
                  set("designation", val);
                  if (val.length >= 100) { setDesignationError("Designation must be 100 characters or fewer"); return; }
                  setDesignationError(val && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(val) ? "Designation contains invalid characters" : "");
                }}
                placeholder="e.g. Senior Developer"
                maxLength={100}
                disabled={roManaged}
                title={roManaged ? form.designation : undefined}
                className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors${designationError ? " border-red-500/50" : ""}`}
              />
              {designationError && <p className="text-[11px] text-red-400 mt-1">{designationError}</p>}
            </Field>
            <Field label="Employment Type" required>
              <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)} disabled={roManaged}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">
                  <SelectItem value="full-time">Full Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="State (for PT)">
              <Select value={form.state} onValueChange={(v) => set("state", v)} disabled={roManaged}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select State" /></SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10 max-h-[280px]">
                  {ptStates.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="City Type (for HRA)">
              <Select value={form.cityType} onValueChange={(v) => set("cityType", v)} disabled={roManaged}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select City Type" /></SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">
                  <SelectItem value="METRO">Metro (Delhi / Mumbai / Chennai / Kolkata)</SelectItem>
                  <SelectItem value="NON_METRO">Non-Metro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {/* B3: state + city type explainer */}
          <div className="mt-4">
            <InfoCard variant="info">
              <b>State</b> drives Professional Tax lookups.{" "}
              <b>City Type</b> (Metro / Non-Metro) drives the HRA exemption
              formula in Old Regime. Changing either affects the next payroll
              run.
            </InfoCard>
          </div>
          {selfEdit && (
            <p className="text-[11px] text-[#7a7a7a] mt-3">
              Joining & organization details are managed by your HR admin.
            </p>
          )}
        </FormCard>
        )}

        {/* 3. Reporting — admin-only, employees cannot see org hierarchy.
            Also hidden when an admin/founder edits their own profile. */}
        {canSeeSensitive && !isEditingSelf && (
          <FormCard icon={Briefcase} title="Reporting & Hierarchy" index={2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Reporting Manager" required>
                <Select value={form.reportingManagerId} onValueChange={(v) => set("reportingManagerId", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">{allEmployees.map((e) => (<SelectItem key={e.userId} value={e.userId}>{e.name}</SelectItem>))}</SelectContent>
                </Select>
              </Field>
              <Field label="Secondary Reviewer">
                <Select value={form.secondaryReviewerId} onValueChange={(v) => set("secondaryReviewerId", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Reviewer" /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">{allEmployees.map((e) => (<SelectItem key={e.userId} value={e.userId}>{e.name}</SelectItem>))}</SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
              <Checkbox checked={form.managesTeam} onCheckedChange={(v) => set("managesTeam", v)} disabled={ro} />
              <span className="text-[13px] text-[#a8a8a8]">This employee manages a team</span>
            </label>
          </FormCard>
        )}

        {/* 4. Education */}
        <FormCard icon={GraduationCap} title="Education Information" index={3}>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} className="flex gap-4 items-start p-4 rounded-xl bg-[#0a0a0a] border border-white/5 animate-[scaleIn_0.2s_ease-out]">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <Field label="Degree Name">
                    <Input
                      value={edu.degreeName || ""}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 100);
                        const n = [...education]; n[i] = { ...n[i], degreeName: val }; setEducation(n);
                        const errs = [...degreeErrors];
                        if (val.length >= 100) { errs[i] = "Degree name must be 100 characters or fewer"; setDegreeErrors(errs); return; }
                        errs[i] = val && !/^[\p{L}\s.,()\-']+$/u.test(val) ? "Degree name should contain only letters and punctuation" : "";
                        setDegreeErrors(errs);
                      }}
                      placeholder="e.g. B.Tech in CS"
                      maxLength={100}
                      disabled={ro}
                      title={ro ? (edu.degreeName || "") : undefined}
                      className={`bg-transparent border-white/8 h-10${degreeErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {degreeErrors[i] && <p className="text-[11px] text-red-400 mt-1">{degreeErrors[i]}</p>}
                  </Field>
                  <Field label="Year of Passing">
                    <Input
                      value={edu.yearOfPassing || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        const n = [...education]; n[i] = { ...n[i], yearOfPassing: val }; setEducation(n);
                        if (yearErrors[i]) { const errs = [...yearErrors]; errs[i] = ""; setYearErrors(errs); }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const yr = Number(val);
                        const currentYearBlur = new Date().getFullYear();
                        const errs = [...yearErrors];
                        if (val && (val.length !== 4 || yr < 1900 || yr > currentYearBlur)) {
                          errs[i] = `Enter a valid year (1900–${currentYearBlur})`;
                        } else if (val && form.dateOfBirth && yr < new Date(form.dateOfBirth).getFullYear()) {
                          errs[i] = "Year of Passing cannot be before the birth year";
                        } else if (val && form.dateOfBirth && (yr - new Date(form.dateOfBirth).getFullYear()) < 14) {
                          errs[i] = "Year of Passing is unrealistic — minimum qualification age is 14";
                        } else {
                          errs[i] = "";
                        }
                        setYearErrors(errs);
                      }}
                      placeholder="e.g. 2020"
                      disabled={ro}
                      className={`bg-transparent border-white/8 h-10${yearErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {yearErrors[i] && <p className="text-[11px] text-red-400 mt-1">{yearErrors[i]}</p>}
                  </Field>
                </div>
                {!ro && education.length > 1 && (
                  <button onClick={() => setEducation(education.filter((_, j) => j !== i))} className="mt-7 h-8 w-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!ro && <AddButton label="Add Another Education" onClick={() => setEducation([...education, { degreeName: "", yearOfPassing: "", certificateUrl: "" }])} />}
        </FormCard>

        {/* 5. Work Experience */}
        <FormCard icon={Briefcase} title="Work Experience" index={4}>
          <div className="space-y-3">
            {workExperience.map((exp, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5 animate-[scaleIn_0.2s_ease-out]">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Company Name">
                    <Input
                      value={exp.companyName || ""}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 100);
                        const n = [...workExperience]; n[i] = { ...n[i], companyName: val }; setWorkExperience(n);
                        const errs = [...companyErrors];
                        if (val.length >= 100) { errs[i] = "Company name must be 100 characters or fewer"; setCompanyErrors(errs); return; }
                        errs[i] = val && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(val) ? "Company name contains invalid characters" : "";
                        setCompanyErrors(errs);
                      }}
                      placeholder="e.g. Tech Corp"
                      maxLength={100}
                      disabled={ro}
                      title={ro ? (exp.companyName || "") : undefined}
                      className={`bg-transparent border-white/8 h-10${companyErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {companyErrors[i] && <p className="text-[11px] text-red-400 mt-1">{companyErrors[i]}</p>}
                  </Field>
                  <Field label="Years of Experience">
                    <Input
                      value={exp.yearsOfExperience || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,1}).*$/, "$1");
                        const n = [...workExperience]; n[i] = { ...n[i], yearsOfExperience: val }; setWorkExperience(n);
                        if (expErrors[i]) { const errs = [...expErrors]; errs[i] = ""; setExpErrors(errs); }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const errs = [...expErrors];
                        errs[i] = val && (isNaN(Number(val)) || Number(val) < 0 || Number(val) > 50) ? "Enter a valid number between 0 and 50" : "";
                        setExpErrors(errs);
                      }}
                      placeholder="e.g. 3.5"
                      disabled={ro}
                      className={`bg-transparent border-white/8 h-10${expErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {expErrors[i] && <p className="text-[11px] text-red-400 mt-1">{expErrors[i]}</p>}
                  </Field>
                  <Field label="Designation">
                    <Input
                      value={exp.designation || ""}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 100);
                        const n = [...workExperience]; n[i] = { ...n[i], designation: val }; setWorkExperience(n);
                        const errs = [...workDesignationErrors];
                        if (val.length >= 100) { errs[i] = "Designation must be 100 characters or fewer"; setWorkDesignationErrors(errs); return; }
                        errs[i] = val && !/^[\p{L}\p{N}\s.,&\-'()/]+$/u.test(val) ? "Designation contains invalid characters" : "";
                        setWorkDesignationErrors(errs);
                      }}
                      placeholder="e.g. Software Engineer"
                      maxLength={100}
                      disabled={ro}
                      title={ro ? (exp.designation || "") : undefined}
                      className={`bg-transparent border-white/8 h-10${workDesignationErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {workDesignationErrors[i] && <p className="text-[11px] text-red-400 mt-1">{workDesignationErrors[i]}</p>}
                  </Field>
                  <Field label="Reference Name">
                    <Input
                      value={exp.referenceName || ""}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 100);
                        const n = [...workExperience]; n[i] = { ...n[i], referenceName: val }; setWorkExperience(n);
                        const errs = [...refNameErrors];
                        if (val.length >= 100) { errs[i] = "Reference name must be 100 characters or fewer"; setRefNameErrors(errs); return; }
                        errs[i] = val && !/^[\p{L}\s.\-']+$/u.test(val) ? "Reference name should contain only letters" : "";
                        setRefNameErrors(errs);
                      }}
                      placeholder="Enter reference"
                      maxLength={100}
                      disabled={ro}
                      title={ro ? (exp.referenceName || "") : undefined}
                      className={`bg-transparent border-white/8 h-10${refNameErrors[i] ? " border-red-500/50" : ""}`}
                    />
                    {refNameErrors[i] && <p className="text-[11px] text-red-400 mt-1">{refNameErrors[i]}</p>}
                  </Field>
                </div>
                {!ro && workExperience.length > 1 && (
                  <div className="flex justify-end mt-3">
                    <button onClick={() => setWorkExperience(workExperience.filter((_, j) => j !== i))} className="text-xs text-red-400/70 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!ro && <AddButton label="Add Another Experience" onClick={() => setWorkExperience([...workExperience, { companyName: "", yearsOfExperience: "", designation: "", referenceName: "", referenceContact: "" }])} />}
        </FormCard>

        {/* 6. Salary Structure — hidden from self-edit view.
            Previously held inline per-employee salary fields (basicSalary, hra,
            transportAllowance, providentFund, professionalTax, variablePay,
            customAllowances, customDeductions). Those are now managed centrally
            under Payroll → Salary Structure Setup; each employee just picks one
            of those structures here. */}
        {/* TEMP: body hidden (Coming Soon) — remove `comingSoon` to restore the fields */}
        {canSeeSensitive && (
          <FormCard icon={DollarSign} title="Salary Structure" index={5} sensitive comingSoon>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Salary Structure">
                <Select value={form.salaryStructureId} onValueChange={(v) => set("salaryStructureId", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10">
                    <SelectValue placeholder={salaryStructures.length ? "Select Salary Structure" : "No structures defined — create one in Payroll"} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">
                    {salaryStructures.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Monthly CTC (₹)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5a5a5a] font-medium pointer-events-none">₹</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.monthlyCtc || ""}
                    onChange={(e) => set("monthlyCtc", Number(e.target.value) || 0)}
                    placeholder="e.g. 100000"
                    disabled={ro}
                    className="bg-[#0a0a0a] border-white/8 h-10 pl-7 tabular-nums focus:border-brand/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <p className="text-[10.5px] text-[#7a7a7a] mt-1.5 leading-relaxed">
                  Monthly anchor for % of CTC components. Drives the entire payroll engine.
                </p>
              </Field>
            </div>
            {/* A6: Monthly CTC anchor explainer */}
            <div className="mt-4">
              <InfoCard variant="info" title="Monthly CTC drives the engine">
                If your structure uses % of CTC components (Basic = 40% of CTC,
                etc.), the rupee amounts come from this anchor.{" "}
                <b>Without it, payroll runs will skip this employee.</b>
              </InfoCard>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <Field label="PF Option">
                <Select value={form.pfOption} onValueChange={(v) => set("pfOption", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">
                    <SelectItem value="CEILING">Ceiling — 12% on ₹15,000 max</SelectItem>
                    <SelectItem value="ACTUAL">Actual — 12% on full Basic+DA</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ESI">
                <label className="flex items-center gap-2.5 h-10 cursor-pointer select-none">
                  <Checkbox checked={form.esiApplicable} onCheckedChange={(v) => set("esiApplicable", !!v)} disabled={ro} />
                  <span className="text-[13px] text-[#a8a8a8]">Eligible for ESI (gross ≤ ₹21,000)</span>
                </label>
              </Field>
            </div>
            {/* B4: PF + ESI explainer */}
            <div className="mt-4">
              <InfoCard variant="info">
                <b>PF Option:</b> Ceiling caps PF at 12% of ₹15k; Actual uses
                12% of full Basic+DA. <b>ESI:</b> ticked employees have 0.75%
                deducted automatically when monthly gross ≤ ₹21,000 — sticky
                for the contribution period (Apr–Sep / Oct–Mar).
              </InfoCard>
            </div>
            {/*
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ["basicSalary", "Basic Salary (Monthly)"],
                ["hra", "House Rent Allowance (HRA)"],
                ["transportAllowance", "Transport Allowance"],
                ["providentFund", "Provident Fund (PF)"],
                ["professionalTax", "Professional Tax"],
                ["variablePay", "Variable Pay / Bonus"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input type="number" value={(form as any)[key] || ""} onChange={(e) => set(key, Number(e.target.value))} placeholder="$0" className="bg-[#0a0a0a] border-white/8 h-10 tabular-nums" />
                </Field>
              ))}
            </div>
            <DynamicAmountList label="Custom Allowances" items={customAllowances} setItems={setCustomAllowances} addLabel="Add Custom Allowance" />
            <DynamicAmountList label="Custom Deductions" items={customDeductions} setItems={setCustomDeductions} addLabel="Add Custom Deduction" />
            */}
          </FormCard>
        )}

        {/* 7. Tax (TDS) Configuration — fully removed. TDS Regime, Auto
            Calculate TDS, and Estimated Annual TDS all live on the chosen
            Salary Structure now (Payroll → Salary Structure Setup). */}

        {/* 8. Attendance — admin-only, employees cannot see assigned shift/pattern */}
        {canSeeSensitive && (
          <FormCard icon={Clock} title="Attendance & Policy Settings" index={7}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shift Type">
                <Select value={form.shiftId} onValueChange={(v) => set("shiftId", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Shift" /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">{shifts.map((s) => (<SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
              </Field>
              <Field label="Weekly Off Pattern">
                <Select value={form.weeklyOffPatternId} onValueChange={(v) => set("weeklyOffPatternId", v)} disabled={ro}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Pattern" /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">{weeklyOffPatterns.map((p) => (<SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </Field>
            </div>
          </FormCard>
        )}

        {/* 9. Documents */}
        <FormCard icon={FileText} title="Document Uploads" index={8}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { field: "offerLetterUrl", label: "Offer Letter" },
              { field: "idProofUrl", label: "ID Proof" },
              { field: "educationCertificatesUrl", label: "Education Certificates" },
              { field: "experienceLettersUrl", label: "Experience Letters" },
            ] as const).filter(({ field }) => canSeeSensitive || field !== "offerLetterUrl").map(({ field, label }) => (
              <Field key={field} label={label}>
                {(form as Record<string, unknown>)[field] ? (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-[13px] text-emerald-400/80 truncate flex-1 font-medium">Uploaded</span>
                    {!ro && (
                      <button onClick={() => set(field, "")} className="text-red-400/50 hover:text-red-400 cursor-pointer transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <label className={`flex items-center gap-2.5 h-10 px-3 rounded-lg border border-dashed border-white/8 hover:border-brand/20 hover:bg-brand/[0.02] transition-all duration-200 ${ro ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                    {uploading[field] ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <Upload className="h-4 w-4 text-[#5a5a5a]" />}
                    <span className="text-[13px] text-[#a8a8a8]">Choose File</span>
                    <input type="file" className="hidden" disabled={ro || uploading[field]} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(field, file); e.target.value = ""; }} />
                  </label>
                )}
              </Field>
            ))}
          </div>
        </FormCard>

        {/* 10. Bank — visible to employees; they can manage their own bank details */}
        <FormCard icon={Landmark} title="Bank Account Details" index={9} sensitive>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Holder Name">
                <Input
                  value={form.bankAccountHolderName}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 100);
                    set("bankAccountHolderName", val);
                    if (val.length >= 100) { setBankHolderNameError("Account holder name must be 100 characters or fewer"); return; }
                    setBankHolderNameError(val && !/^[\p{L}\s.\-']+$/u.test(val) ? "Account holder name should contain only letters" : "");
                  }}
                  placeholder="Enter account holder name"
                  maxLength={100}
                  className={`bg-[#0a0a0a] border-white/8 h-10${bankHolderNameError ? " border-red-500/50" : ""}`}
                />
                {bankHolderNameError && <p className="text-[11px] text-red-400 mt-1">{bankHolderNameError}</p>}
              </Field>
              <Field label="Account Type">
                <Select value={form.bankAccountType} onValueChange={(v) => set("bankAccountType", v)}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/8 h-10"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent className="bg-[#050505] border-white/10">
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Account Number">
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 20);
                    set("bankAccountNumber", val);
                    setBankAccountNumberError(val && (val.length < 6 || val.length > 20) ? "Account number must be 6–20 digits" : "");
                  }}
                  placeholder="Enter account number (digits only)"
                  maxLength={20}
                  inputMode="numeric"
                  className={`bg-[#0a0a0a] border-white/8 h-10 tabular-nums${bankAccountNumberError ? " border-red-500/50" : ""}`}
                />
                {bankAccountNumberError && <p className="text-[11px] text-red-400 mt-1">{bankAccountNumberError}</p>}
              </Field>
              <Field label="IFSC Code">
                <Input
                  value={form.bankIfscCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 15);
                    set("bankIfscCode", val);
                    const core = val.replace(/-/g, "");
                    setIfscError(val && (core.length < 6 || core.length > 15) ? "Enter a valid bank/IFSC code (6–15 alphanumeric characters)" : "");
                  }}
                  placeholder="e.g. SBIN0001234 or SWIFT code"
                  maxLength={15}
                  className={`bg-[#0a0a0a] border-white/8 h-10 uppercase tracking-wider${ifscError ? " border-red-500/50" : ""}`}
                />
                {ifscError && <p className="text-[11px] text-red-400 mt-1">{ifscError}</p>}
              </Field>
            </div>
        </FormCard>

        {/* 10. Exit / Full & Final — admin-only, manager-controlled */}
        {canSeeSensitive && (
          <FormCard icon={Trash2} title="Exit / Full & Final" index={10} sensitive>
            <InfoCard variant="warning">
              Set the <b>last working day</b> to mark this employee as exiting.
              Their next payroll run becomes the F&amp;F: TDS deducts the full
              remaining annual liability instead of being spread. Leave blank
              to revert.
            </InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Field label="Last Working Day">
                <Input
                  type="date"
                  value={form.exitedAt}
                  max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split("T")[0]; })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    set("exitedAt", val);
                    if (!val) { setExitedAtError(""); return; }
                    const maxLwd = new Date(); maxLwd.setMonth(maxLwd.getMonth() + 6);
                    if (form.dateOfBirth && val < form.dateOfBirth) {
                      setExitedAtError("Last Working Day cannot be before the Date of Birth");
                    } else if (form.dateOfJoining && val <= form.dateOfJoining) {
                      setExitedAtError("Last Working Day must be after the Date of Joining");
                    } else if (form.dateOfJoining && (new Date(val).getTime() - new Date(form.dateOfJoining).getTime()) / (365.25 * 24 * 60 * 60 * 1000) > 50) {
                      setExitedAtError("Duration between Date of Joining and Last Working Day cannot exceed 50 years");
                    } else if (val > maxLwd.toISOString().split("T")[0]) {
                      setExitedAtError("Last Working Day cannot be more than 6 months in the future");
                    } else {
                      setExitedAtError("");
                    }
                  }}
                  disabled={roManaged}
                  onClick={(e) => {
                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                    el.showPicker?.();
                  }}
                  className={`bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors [color-scheme:dark] cursor-pointer${exitedAtError ? " border-red-500/50" : ""}`}
                />
                {exitedAtError && <p className="text-[11px] text-red-400 mt-1">{exitedAtError}</p>}
              </Field>
              <Field label="Reason (optional)">
                <Input
                  value={form.exitReason}
                  onChange={(e) => set("exitReason", e.target.value)}
                  disabled={roManaged}
                  title={roManaged ? form.exitReason : undefined}
                  placeholder="Resignation / termination / contract end"
                  className="bg-[#0a0a0a] border-white/8 h-10 focus:border-brand/30 transition-colors"
                />
              </Field>
            </div>
            {form.exitedAt && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    set("exitedAt", "");
                    set("exitReason", "");
                    setExitedAtError("");
                  }}
                  disabled={roManaged}
                  className="text-[12px] text-[#a8a8a8] hover:text-white underline-offset-2 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Clear exit date (revert to active employee)
                </button>
              </div>
            )}
          </FormCard>
        )}

        {/* Actions */}
        {canWrite && (
          <div className="flex items-center gap-3 pt-2 pb-8 animate-[slideUp_0.4s_ease-out_0.3s_both]">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 font-semibold
                         active:scale-[0.97] transition-all duration-150 cursor-pointer px-6 h-11"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {onboarding
                ? "Complete Profile"
                : selfEdit
                  ? "Save My Information"
                  : mode === "add"
                    ? "Save Employee"
                    : "Update Employee"}
            </Button>
            {!onboarding && (
              <Button
                variant="ghost"
                onClick={() => onNavigate(mode === "add" ? "add-employee" : "employees")}
                className="text-[#a8a8a8] hover:text-white cursor-pointer h-11"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Reusable sub-components ---

function FormCard({ icon: Icon, title, children, index = 0, sensitive, comingSoon }: { icon: typeof User; title: string; children: ReactNode; index?: number; sensitive?: boolean; comingSoon?: boolean }) {
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className="bg-[#050505] rounded-xl border border-white/8 overflow-hidden animate-[slideUp_0.4s_ease-out_both]"
    >
      <div className={`flex items-center gap-3 px-6 py-4 ${comingSoon ? "" : "border-b border-white/5"}`}>
        <div className={`h-8 w-8 rounded-lg ${sensitive ? "bg-amber-500/10" : "bg-white/5"} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${sensitive ? "text-amber-400" : "text-[#a8a8a8]"}`} />
        </div>
        <h3 className="text-[14px] font-semibold text-white">{title}</h3>
        {comingSoon ? (
          <span className="ml-auto text-[9px] font-semibold text-brand/70 uppercase tracking-widest">Coming Soon</span>
        ) : (
          sensitive && (
            <span className="ml-auto text-[9px] font-semibold text-amber-400/60 uppercase tracking-widest">Restricted</span>
          )
        )}
      </div>
      {!comingSoon && <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#a8a8a8] mb-1.5 block uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:text-brand/80 mt-4 cursor-pointer transition-colors group"
    >
      <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
      {label}
    </button>
  );
}

function DynamicAmountList({ label, items, setItems, addLabel }: { label: string; items: CustomAmount[]; setItems: (v: CustomAmount[]) => void; addLabel: string }) {
  return (
    <div className="mt-5">
      <p className="text-[12px] font-medium text-[#a8a8a8] mb-2.5 uppercase tracking-wider">{label}</p>
      <div className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className="flex gap-3 animate-[scaleIn_0.2s_ease-out]">
            <Input value={a.name} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], name: e.target.value }; setItems(n); }} placeholder="Name" className="bg-[#0a0a0a] border-white/8 h-10 flex-1" />
            <Input type="number" value={a.amount || ""} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], amount: Number(e.target.value) }; setItems(n); }} placeholder="$0" className="bg-[#0a0a0a] border-white/8 h-10 w-32 tabular-nums" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="h-10 w-10 rounded-lg hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-red-400/60" />
            </button>
          </div>
        ))}
      </div>
      <AddButton label={addLabel} onClick={() => setItems([...items, { name: "", amount: 0 }])} />
    </div>
  );
}
