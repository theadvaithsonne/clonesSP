"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  LayoutDashboard,
  Users,
  Building,
  GitBranch,
  CalendarCheck,
  DollarSign,
  Settings as SettingsIcon,
  X,
  Building2,
  ChevronRight,
  UserPlus,
  Pencil,
  Receipt,
  FileText,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getUserIdFromToken } from "@/lib/auth";
import { getEmployee } from "./api";
import type { Section } from "./types";
import type { InlineAppProps } from "../registry";
import DashboardSection from "./sections/DashboardSection";
import EmployeesSection from "./sections/EmployeesSection";
import BranchesSection from "./sections/BranchesSection";
import DepartmentsSection from "./sections/DepartmentsSection";
import AttendanceSection from "./sections/AttendanceSection";
import PayrollSection from "./sections/PayrollSection";
import TaxDeclarationSection from "./sections/TaxDeclarationSection";
import MySalarySlipsSection from "./sections/MySalarySlipsSection";
import RecruitmentSection from "./sections/RecruitmentSection";
import SettingsSection from "./sections/SettingsSection";
import EmployeeForm from "./sections/EmployeeForm";
import EmployeeDetailsSection from "./sections/EmployeeDetailsSection";
import AddEmployeeSection from "./sections/AddEmployeeSection";

type SectionMeta = {
  label: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
};

const SECTION_META: Record<Section, SectionMeta> = {
  dashboard: {
    label: "Dashboard",
    subtitle: "Overview of your organization's workforce",
    icon: LayoutDashboard,
  },
  employees: {
    label: "Employees",
    subtitle: "Manage people in your organization",
    icon: Users,
  },
  "add-employee": {
    label: "Add Employee",
    subtitle: "Select entry method",
    icon: UserPlus,
  },
  "add-employee-form": {
    label: "Add Employee",
    subtitle: "Fill in employee details below",
    icon: UserPlus,
  },
  "invite-employee": {
    label: "Invite Employee",
    subtitle: "Invite one or many employees by name and email",
    icon: UserPlus,
  },
  "bulk-assign": {
    label: "Bulk Assign",
    subtitle: "Edit fields inline for onboarded employees",
    icon: Users,
  },
  "update-info": {
    label: "Update Info",
    subtitle: "View and update your personal details",
    icon: Pencil,
  },
  "edit-employee": {
    label: "Edit Employee",
    subtitle: "Update employee details",
    icon: Pencil,
  },
  departments: {
    label: "Departments",
    subtitle: "Organise teams by function",
    icon: Building,
  },
  branches: {
    label: "Branches",
    subtitle: "Locations and offices",
    icon: GitBranch,
  },
  attendance: {
    label: "Attendance",
    subtitle: "Track attendance, breaks, and leave requests",
    icon: CalendarCheck,
  },
  payroll: {
    label: "Payroll",
    subtitle: "Process salaries and manage salary structures",
    icon: DollarSign,
  },
  "tax-declaration": {
    label: "Tax Declaration",
    subtitle: "Choose regime, declare deductions, compare Old vs New",
    icon: Receipt,
  },
  "my-salary-slips": {
    label: "My Salary Slips",
    subtitle: "Approved + paid payroll runs that include you",
    icon: FileText,
  },
  recruitment: {
    label: "Recruitment",
    subtitle: "Raise and track job openings",
    icon: UserPlus,
  },
  settings: {
    label: "Settings",
    subtitle: "Module configuration",
    icon: SettingsIcon,
  },
};

// Frontend-only password gate. Resets when the browser tab closes
// (sessionStorage). NOT a security boundary — APIs still enforce access.
const TEAMFORCE_PASSWORD = "teamforce@123";
const TEAMFORCE_UNLOCK_KEY = "teamforce_unlocked";

export default function TeamforceApp({ onClose, section }: InlineAppProps) {
  // ─── Frontend password gate ────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(TEAMFORCE_UNLOCK_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TEAMFORCE_UNLOCK_KEY, "1");
    }
  }, []);

  // External section (from BackOffice sidebar) drives the visible section.
  // Internal `editingUserId` is a form-detail sub-state — stays local because
  // it's not exposed as a sidebar item.
  const externalSection = (section as Section) || "dashboard";
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [internalDetail, setInternalDetail] = useState<
    "add-employee" | "add-employee-form" | "edit-employee" | null
  >(null);

  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { amIFounder, loading: founderLoading } = useAmIFounder();

  // First-time self-onboarding gate: a newly-invited employee with no
  // Teamforce profile yet sees only the trimmed onboarding form — never the
  // dashboard or dock — until they save it. null = not yet determined.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // Reset the form-detail sub-route whenever the external section changes
  useEffect(() => {
    setInternalDetail(null);
    setEditingUserId(null);
  }, [externalSection]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Tell the dashboard shell when an employee-details page is open so the
  // dock can show "Update Profile" for admins/founders only during it.
  const onEmployeeDetail = internalDetail === "edit-employee";
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("teamforce:employee-detail", {
        detail: { active: onEmployeeDetail },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("teamforce:employee-detail", { detail: { active: false } })
      );
    };
  }, [onEmployeeDetail]);

  useEffect(() => {
    if (founderLoading) return;
    if (amIFounder) {
      setHasWriteAccess(true);
      setNeedsOnboarding(false);
      return;
    }
    const myUserId = getUserIdFromToken();
    if (!myUserId) {
      setNeedsOnboarding(false);
      return;
    }
    getEmployee(myUserId)
      .then((data) => {
        const isAdmin = data.teamforceRole === "admin";
        if (isAdmin) setHasWriteAccess(true);
        setNeedsOnboarding(!isAdmin && !data.hasProfile);
      })
      .catch(() => setNeedsOnboarding(false));
  }, [amIFounder, founderLoading]);

  const handleNavigate = useCallback(
    (target: Section, userId?: string) => {
      // Only "add-employee" / "edit-employee" are internal detail routes.
      // Everything else (dashboard, employees, departments, ...) should be
      // driven from the external sidebar — but if a section component calls
      // it (e.g. clicking a dashboard stat card), we still gracefully clear
      // the internal detail so the user sees the right section.
      if (
        target === "add-employee" ||
        target === "add-employee-form" ||
        target === "edit-employee"
      ) {
        setEditingUserId(userId || null);
        setInternalDetail(target);
        return;
      }
      // For other sections, just clear the detail; the external section won't
      // change unless the user picks it from the sidebar — but at least the
      // form view won't linger over the new section.
      setInternalDetail(null);
      setEditingUserId(null);

      // Ask the shell to switch Teamforce:* section when leaving action
      // screens, or when navigating to another top-level section (e.g.
      // Employees → Invite via Email from the Add Employee button).
      if (
        target !== externalSection &&
        (externalSection === "invite-employee" ||
          externalSection === "bulk-assign" ||
          externalSection === "update-info" ||
          target === "invite-employee" ||
          target === "bulk-assign" ||
          target === "update-info" ||
          target === "employees" ||
          target === "dashboard" ||
          target === "departments" ||
          target === "branches" ||
          target === "attendance" ||
          target === "payroll" ||
          target === "settings")
      ) {
        window.dispatchEvent(
          new CustomEvent("teamforce:navigate", { detail: { section: target } })
        );
      }
    },
    [externalSection]
  );

  // Effective section to render = internal detail (if active) else external.
  const activeSection: Section = internalDetail || externalSection;
  const baseMeta = SECTION_META[activeSection] || SECTION_META.dashboard;

  // For non-admins editing their own profile, swap the header to "My Information"
  const myUserIdForMeta =
    typeof window !== "undefined" ? getUserIdFromToken() : null;
  const isSelfEditing =
    (activeSection === "edit-employee" || activeSection === "update-info") &&
    !hasWriteAccess &&
    (activeSection === "update-info" ||
      (!!editingUserId && editingUserId === myUserIdForMeta));
  const meta =
    activeSection === "update-info" || isSelfEditing
      ? {
          label: "My Information",
          subtitle: "View and update your personal details",
          icon: Pencil,
        }
      : baseMeta;

  function renderSection() {
    // First-time onboarding overrides everything — no dashboard, no other
    // section, regardless of what was navigated to, until it's saved.
    if (needsOnboarding) {
      return (
        <EmployeeForm
          mode="edit"
          userId={getUserIdFromToken()}
          hasWriteAccess={false}
          selfEdit
          onboarding
          onOnboardingComplete={() => {
            setNeedsOnboarding(false);
            // Tell the dashboard shell right away so the bottom dock (which
            // computes its own onboarding-gate state independently) shows
            // the Teamforce tabs immediately instead of waiting for a
            // full page refresh to re-fetch the employee profile.
            window.dispatchEvent(new CustomEvent("teamforce:onboarding-complete"));
          }}
          onNavigate={() => {}}
        />
      );
    }
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection onNavigate={handleNavigate} />;
      case "employees":
        return (
          <EmployeesSection
            hasWriteAccess={hasWriteAccess}
            isFounder={amIFounder}
            onNavigate={handleNavigate}
          />
        );
      case "bulk-assign":
        return (
          <EmployeesSection
            hasWriteAccess={hasWriteAccess}
            isFounder={amIFounder}
            onNavigate={handleNavigate}
            initialBulkMode
          />
        );
      case "add-employee":
        return <AddEmployeeSection onNavigate={handleNavigate} />;
      case "invite-employee":
        return (
          <AddEmployeeSection onNavigate={handleNavigate} initialView="invite" />
        );
      case "add-employee-form":
        return (
          <EmployeeForm
            mode="add"
            hasWriteAccess={hasWriteAccess}
            onNavigate={handleNavigate}
          />
        );
      case "update-info": {
        const myUserId = getUserIdFromToken();
        return (
          <EmployeeForm
            mode="edit"
            userId={myUserId}
            hasWriteAccess={hasWriteAccess}
            selfEdit={!hasWriteAccess}
            onNavigate={handleNavigate}
          />
        );
      }
      case "edit-employee": {
        // Details-first: clicking an employee always opens the read-only
        // details page. An Edit button (founder/admin viewing anyone, or a
        // user viewing themselves) switches to the edit form; Save/Cancel
        // returns to details. Employees/managers viewing others get details
        // only — no Edit button (the backend rejects their writes anyway).
        const myUserId = getUserIdFromToken();
        const isSelf = !!editingUserId && editingUserId === myUserId;
        return (
          <EmployeeDetailOrEdit
            key={editingUserId || "none"}
            userId={editingUserId}
            hasWriteAccess={hasWriteAccess}
            isSelf={isSelf}
            onNavigate={handleNavigate}
          />
        );
      }
      case "departments":
        return <DepartmentsSection hasWriteAccess={hasWriteAccess} />;
      case "branches":
        return <BranchesSection hasWriteAccess={hasWriteAccess} />;
      case "attendance":
        return <AttendanceSection />;
      case "payroll":
        return <PayrollSection />;
      case "tax-declaration":
        return <TaxDeclarationSection />;
      case "my-salary-slips":
        return <MySalarySlipsSection />;
      case "recruitment":
        return <RecruitmentSection />;
      case "settings":
        return <SettingsSection />;
      default:
        return null;
    }
  }

  const SectionIcon = meta.icon;

  // Hold the whole UI (including the password gate) until we know whether
  // this user needs onboarding — avoids a flash of the password prompt for
  // a newly-invited employee who's never seen it.
  if (needsOnboarding === null) {
    return (
      <div className="flex flex-col h-full bg-[#0e0e0e] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-[#0e0e0e] text-white transition-opacity duration-300 ease-out ${mounted ? "opacity-100" : "opacity-0"
        }`}
    >
      {/* Password gate — overlay on top of everything when locked.
          Skipped entirely during first-time onboarding: a newly-invited
          employee has never been told this password.
          TEMP: disabled for everybody — direct access, no password prompt.
          To re-enable, uncomment the block below. */}
      {/* {!unlocked && !needsOnboarding && (
        <PasswordGate onUnlock={handleUnlock} onClose={onClose} />
      )} */}

      {/* Content area — full width, no internal sub-sidebar */}
      <main className="flex-1 overflow-y-auto bg-[#000]">
        <div
          className="p-6 w-full animate-[fadeIn_0.25s_ease-out]"
          key={activeSection}
        >
          {renderSection()}
        </div>
      </main>

      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Details-first employee view ───────────────────────────────────────
   Shows the read-only details page; the Edit button (when allowed) swaps in
   the existing EmployeeForm. The form's Save/Cancel "back to employees"
   navigation is intercepted to return to the details page instead — the
   remount refetches, so saved changes show immediately. */
function EmployeeDetailOrEdit({
  userId,
  hasWriteAccess,
  isSelf,
  onNavigate,
}: {
  userId: string | null;
  hasWriteAccess: boolean;
  isSelf: boolean;
  onNavigate: (section: Section, userId?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Self-edit lives in the dock's "Update Profile" — details page only
  // offers Edit to founders/admins.
  const canEdit = hasWriteAccess;

  // Dock "Update Profile" while this details page is open (admin/founder):
  // edit the employee being viewed, not self.
  useEffect(() => {
    const handler = () => {
      if (canEdit) setEditing(true);
    };
    window.addEventListener("teamforce:edit-current-employee", handler);
    return () => window.removeEventListener("teamforce:edit-current-employee", handler);
  }, [canEdit]);

  if (editing && canEdit) {
    return (
      <EmployeeForm
        mode="edit"
        userId={userId}
        hasWriteAccess={hasWriteAccess}
        selfEdit={isSelf && !hasWriteAccess}
        onNavigate={(target) => {
          if (target === "employees") setEditing(false);
          else onNavigate(target);
        }}
      />
    );
  }
  return (
    <EmployeeDetailsSection
      userId={userId}
      canEdit={canEdit}
      onEdit={() => setEditing(true)}
      onNavigate={onNavigate}
    />
  );
}

/* ─── Password gate ─────────────────────────────────────────────────────
   Fixed overlay (z-[99999999]) that sits on top of everything until the
   correct password is entered. The Teamforce app behind it loads normally
   so when the user unlocks, everything is already ready. */
function PasswordGate({
  onUnlock,
  onClose,
}: {
  onUnlock: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value === TEAMFORCE_PASSWORD) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6 bg-black/85 backdrop-blur-md"
      style={{ zIndex: 99999999 }}
    >
      <form
        onSubmit={submit}
        className={`w-full max-w-[400px] bg-[#161616] border border-white/8 rounded-2xl p-8 shadow-2xl shadow-black/60 ${
          shake ? "animate-[tfshake_0.4s_ease-in-out]" : ""
        }`}
      >
        {/* Lock icon */}
        <div className="flex justify-center mb-5">
          <div className="h-14 w-14 rounded-2xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center">
            <Lock className="h-6 w-6 text-brand" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-[18px] font-semibold text-white tracking-tight">
            Enter Password
          </h2>
          <p className="text-[12px] text-[#a8a8a8] mt-1.5">
            Teamforce HR is password-protected
          </p>
        </div>

        {/* Password input */}
        <label className="block text-[11px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(false);
            }}
            autoFocus
            placeholder="Enter password"
            className={`w-full h-11 pl-3 pr-10 rounded-lg bg-[#0a0a0a] text-sm text-white placeholder:text-[#5a5a5a] outline-none transition-colors border ${
              error
                ? "border-red-500/40 focus:border-red-500/60"
                : "border-white/8 focus:border-brand/40"
            }`}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-white/8 flex items-center justify-center cursor-pointer transition-colors"
          >
            {show ? (
              <EyeOff className="h-4 w-4 text-[#7a7a7a]" />
            ) : (
              <Eye className="h-4 w-4 text-[#7a7a7a]" />
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-[11px] text-red-400 mt-2">
            Incorrect password. Please try again.
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-lg border border-white/8 bg-transparent text-[#a8a8a8] hover:bg-white/5 hover:text-white text-sm font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value}
            className="flex-1 h-11 rounded-lg bg-brand text-brand-foreground font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-brand/10 hover:bg-brand/90 hover:shadow-brand/20 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Unlock
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[10px] text-[#5a5a5a] text-center mt-4">
          Session resets when you close the browser
        </p>
      </form>

      <style jsx global>{`
        @keyframes tfshake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
