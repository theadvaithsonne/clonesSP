"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Film,
  GripVertical,
  ImageIcon,
  Info,
  Layers,
  Loader2,
  Lock,
  Paperclip,
  Play,
  Plus,
  Search,
  Shield,
  Timer,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createService,
  updateService,
  getTeamMembers,
  DEFAULT_HOURLY_CONFIG,
  type Service,
  type ServiceHourlyConfig,
  type ServiceMilestoneAttachment,
  type ServiceMilestoneInput,
  type ServiceTaskAssignee,
  type ServiceTaskroomConfig,
  type ServiceTeamMember,
  type ServiceWhyChooseUs,
  type TeamMember,
} from "@/lib/feed-api";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { CommissionPlanSection, saveCommissionPlan } from "./CommissionPlanSection";
import { formatFileSize, youtubeId, youtubeThumb } from "./ServiceMediaCarousel";
import {
  TaskroomVisibilitySection,
  buildDefaultStages,
  emptyTaskroomConfig,
} from "./service-taskroom/TaskroomVisibilitySection";
import { DeliveryTeamSection } from "./service-taskroom/DeliveryTeamSection";
import {
  MAX_BENEFITS,
  MAX_DELIVERABLES,
  filterNonEmptyStrings,
  limitReachedLabel,
} from "@/lib/form-limits";
import {
  formatSellablePrice,
  garageStorefrontUrl,
  showSellablePublished,
} from "@/components/shared/SellablePublishedModal";

/** The share popup, for a service that was just created or first published. */
export function announceService(service: Service) {
  const billable = service.pricingModel === "billable";
  const free = service.paymentTiming === "free";
  const milestones = service.milestones?.length || 0;
  showSellablePublished({
    kind: "service",
    title: service.title,
    image: service.coverImage || service.images?.[0] || null,
    url: garageStorefrontUrl("service", service._id),
    price: free
      ? "Free"
      : billable
        ? formatSellablePrice(service.hourlyConfig?.hourlyRate, service.currency, "hr")
        : formatSellablePrice(service.totalPrice, service.currency),
    facts: [
      service.duration,
      billable
        ? "Billed hourly"
        : milestones > 0 && `${milestones} milestone${milestones === 1 ? "" : "s"}`,
      service.category,
    ],
    draft: service.status === "draft",
  });
}

// ============================================================================
// Tokens
// ============================================================================

const INPUT_CLS =
  "w-full bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm transition-all";
const LABEL_CLS =
  "text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block";

/**
 * A focused `<input type="number">` treats the wheel as a stepper, so scrolling
 * the form with the cursor over a price silently rewrites the amount. Dropping
 * focus on wheel keeps the scroll and leaves the value alone — preventDefault
 * would swallow the scroll itself.
 *
 * Attach to every number input in this form.
 */
const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) =>
  e.currentTarget.blur();
const PILL_ADVANCE =
  "bg-brand/10 text-brand border border-brand/20 text-xs px-2.5 py-0.5 rounded-md font-medium";
const PILL_COMPLETION =
  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-md font-medium";

const MAX_IMAGES = 8;
const MAX_VIDEOS = 3;
const MAX_MILESTONE_FILES = 5;
const MAX_ATTACHMENT_MB = 25;

// Backend enforces an INR/USD enum on services — anything else fails to save.
const CURRENCIES: DropdownOption[] = [
  { value: "USD", label: "USD", icon: "🇺🇸" },
  { value: "INR", label: "INR", icon: "🇮🇳" },
];

const CATEGORIES = [
  "UI/UX Design & Strategy",
  "Engineering & Full-stack",
  "Cloud & DevOps",
  "Marketing & Growth",
  "Branding & Content",
  "Data & AI",
  "Consulting & Advisory",
  "Other",
];

const CANCELLATION_PRESETS = [
  "Flexible — Full refund up to 7 days before sprint launch",
  "Moderate — 50% refund up to 3 days before sprint launch",
  "Strict — No refund once the sprint is scheduled",
];

const MILESTONE_TEMPLATES: Array<{
  name: string;
  hint: string;
  milestones: Array<Omit<MilestoneDraft, "id">>;
}> = [
  {
    name: "Design Sprint",
    hint: "Discovery → wireframes → UI → handoff",
    milestones: [
      {
        title: "Discovery & Research",
        description: "Stakeholder interviews, competitive teardown and success metrics.",
        duration: "5 days",
        deliverables: ["Research summary deck", "Success metric sheet"],
        attachments: [],
        amount: 0,
        paymentTiming: "advance",
      },
      {
        title: "UX Refinement & Wireframes",
        description: "High-fidelity wireframes and the core screen layout map for approval.",
        duration: "12 days",
        deliverables: ["Figma interactive core flow map", "Low fidelity wireframes"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
      {
        title: "UI Design System",
        description: "Component library, tokens and production-ready screens.",
        duration: "10 days",
        deliverables: ["Component library", "Final screen set"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
      {
        title: "Handoff & Support",
        description: "Developer handoff, annotations and two weeks of design QA.",
        duration: "3 days",
        deliverables: ["Annotated handoff file"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
    ],
  },
  {
    name: "Web Build",
    hint: "Scope → build → QA & launch",
    milestones: [
      {
        title: "Scope & Architecture",
        description: "Technical scope, data model and delivery plan.",
        duration: "5 days",
        deliverables: ["Architecture doc", "Delivery plan"],
        attachments: [],
        amount: 0,
        paymentTiming: "advance",
      },
      {
        title: "Core Build",
        description: "Implementation of the agreed feature set.",
        duration: "20 days",
        deliverables: ["Staging environment"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
      {
        title: "QA & Launch",
        description: "Test pass, fixes and production deploy.",
        duration: "7 days",
        deliverables: ["Test report", "Production deploy"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
    ],
  },
  {
    name: "Growth Retainer",
    hint: "Audit → campaigns → optimisation",
    milestones: [
      {
        title: "Growth Audit",
        description: "Funnel, channel and analytics audit with a prioritised backlog.",
        duration: "7 days",
        deliverables: ["Audit report", "Prioritised backlog"],
        attachments: [],
        amount: 0,
        paymentTiming: "advance",
      },
      {
        title: "Campaign Setup",
        description: "Creative, tracking and channel setup for the first cycle.",
        duration: "10 days",
        deliverables: ["Campaign assets", "Tracking plan"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
      {
        title: "Optimisation Cycle",
        description: "Iteration on live performance data.",
        duration: "14 days",
        deliverables: ["Performance report"],
        attachments: [],
        amount: 0,
        paymentTiming: "on_completion",
      },
    ],
  },
];

// ============================================================================
// Types
// ============================================================================

interface MilestoneDraft {
  id: string;
  /** Set for milestones that already exist server-side — preserves opt-in links. */
  persistedId?: string;
  title: string;
  description: string;
  duration: string;
  deliverables: string[];
  attachments: ServiceMilestoneAttachment[];
  amount: number;
  paymentTiming: "advance" | "on_completion";
}

type SectionKey =
  | "basics"
  | "pricing"
  | "milestones"
  | "highlights"
  | "access"
  | "taskroom"
  | "publish";

// ============================================================================
// Helpers
// ============================================================================

function uid() {
  return `m-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0);
}

async function uploadToBackend(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body,
    },
  );
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

// ============================================================================
// Small building blocks
// ============================================================================

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function GoldRadio({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
        checked ? "border-brand" : "border-[#3A3A3A]",
      )}
    >
      {checked && <span className="h-2 w-2 rounded-full bg-brand" />}
    </span>
  );
}

interface DropdownOption {
  value: string;
  label: string;
  /** Leading glyph, e.g. a flag emoji. */
  icon?: string;
}

/** Themed replacement for a native <select> — the OS popup can't be styled. */
function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          INPUT_CLS,
          "flex items-center justify-between gap-2 text-left",
          open && "border-brand ring-1 ring-brand",
        )}
      >
        <span className={cn("flex items-center gap-2 truncate", !selected && "text-zinc-600")}>
          {selected?.icon && <span className="text-base leading-none">{selected.icon}</span>}
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[#262626] bg-[#1A1A1A] p-1 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  active ? "bg-brand/10 text-brand" : "text-zinc-300 hover:bg-white/5",
                )}
              >
                {option.icon && <span className="text-base leading-none">{option.icon}</span>}
                <span className="flex-1">{option.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipList({
  items,
  onRemove,
  icon,
}: {
  items: string[];
  onRemove: (index: number) => void;
  icon?: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item, idx) => (
        <div
          key={`${item}-${idx}`}
          className="flex items-center gap-2 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2"
        >
          {icon ?? <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
          <span className="flex-1 text-xs text-zinc-200">{item}</span>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="text-zinc-600 transition-colors hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AddRow({
  value,
  onChange,
  onAdd,
  placeholder,
  /** Set once the list is full — input and button go inert. */
  disabled = false,
  /** Helper text shown under the row while disabled. */
  limitLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  placeholder: string;
  disabled?: boolean;
  limitLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!disabled) onAdd();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`${INPUT_CLS} disabled:opacity-40`}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="shrink-0 rounded-xl bg-[#262626] px-3 text-zinc-300 transition-all hover:bg-[#303030] hover:text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {disabled && limitLabel && (
        <p className="text-[11px] text-zinc-500">{limitLabel}</p>
      )}
    </div>
  );
}

function SectionBlock({
  index,
  title,
  complete,
  action,
  children,
}: {
  index: number;
  title: string;
  complete: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#262626] pt-5 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
              complete
                ? "bg-brand text-brand-foreground"
                : "border border-[#3A3A3A] text-zinc-500",
            )}
          >
            {complete ? <Check className="h-3 w-3" /> : index}
          </span>
          <h4 className="text-base font-bold text-brand">
            {index}. {title}
          </h4>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ============================================================================
// Billable & hourly setup
// ============================================================================

const BILLING_CYCLE_OPTIONS: DropdownOption[] = [
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const BILLING_START_DAY_OPTIONS: DropdownOption[] = [
  { value: "1st_of_month", label: "1st of the month" },
  { value: "15th_of_month", label: "15th of the month" },
  { value: "contract_start", label: "Contract start date" },
  { value: "monday", label: "Every Monday" },
];

/** A switch row, with the field it governs revealed underneath when on. */
function ToggleRow({
  title,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{title}</p>
          <p className="text-[11px] text-zinc-500">{hint}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="data-[state=checked]:bg-brand"
        />
      </div>
      {checked && children && (
        <div className="mt-3 border-t border-[#262626] pt-3">{children}</div>
      )}
    </div>
  );
}

/**
 * Section 3 for a billable service. Replaces the milestone builder entirely —
 * the two pricing models never both apply, and the hourly setup is what the
 * engagement's billing run and its Taskroom timesheet are driven from.
 */
function BillableSetup({
  config,
  currency,
  isFree,
  onChange,
  teamSlot,
}: {
  config: ServiceHourlyConfig;
  currency: string;
  isFree: boolean;
  onChange: (patch: Partial<ServiceHourlyConfig>) => void;
  /** The delivery team & pay rate editor, owned by the modal. */
  teamSlot?: React.ReactNode;
}) {
  const isRetainer = config.billingModelType === "retainer";

  // What a full month looks like at the configured rate. The cap wins when it
  // is lower than the estimate, because that is the most the client can be
  // billed regardless of what the estimate says.
  const billableHours =
    config.hardCapEnabled && config.maxHoursPerMonth
      ? Math.min(config.maxHoursPerMonth, config.estimatedMonthlyHours || config.maxHoursPerMonth)
      : config.estimatedMonthlyHours;
  const monthlyEstimate = (config.hourlyRate || 0) * (billableHours || 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ billingModelType: "hourly" })}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            !isRetainer
              ? "border-brand bg-brand/5"
              : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
          )}
        >
          <div className="flex items-start justify-between">
            <Timer className="h-5 w-5 text-brand" />
            <GoldRadio checked={!isRetainer} />
          </div>
          <p className="mt-2.5 text-sm font-semibold text-white">Pure hourly</p>
          <p className="mt-1 text-xs text-zinc-400">
            Billed for the hours logged in each cycle, nothing more.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange({ billingModelType: "retainer" })}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            isRetainer
              ? "border-brand bg-brand/5"
              : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
          )}
        >
          <div className="flex items-start justify-between">
            <Shield className="h-5 w-5 text-brand" />
            <GoldRadio checked={isRetainer} />
          </div>
          <p className="mt-2.5 text-sm font-semibold text-white">Retainer</p>
          <p className="mt-1 text-xs text-zinc-400">
            A block of hours committed each cycle, drawn down as work is logged.
          </p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>Hourly rate ({currency})</label>
          <input
            type="number"
            onWheel={blurOnWheel}
            min={1}
            step="0.01"
            value={config.hourlyRate || ""}
            onChange={(e) =>
              onChange({ hourlyRate: parseFloat(e.target.value) || 0 })
            }
            placeholder="80.00"
            disabled={isFree}
            className={cn(INPUT_CLS, isFree && "opacity-50")}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {isFree
              ? "The service is free — hours are tracked but never billed."
              : "Applied to every billable hour logged on the engagement."}
          </p>
        </div>

        <div>
          <label className={LABEL_CLS}>
            {isRetainer ? "Committed hours per month" : "Estimated monthly hours"}
          </label>
          <input
            type="number"
            onWheel={blurOnWheel}
            min={0}
            value={config.estimatedMonthlyHours || ""}
            onChange={(e) =>
              onChange({ estimatedMonthlyHours: parseFloat(e.target.value) || 0 })
            }
            placeholder="20"
            disabled={config.noMinimumCommitment && !isRetainer}
            className={cn(
              INPUT_CLS,
              config.noMinimumCommitment && !isRetainer && "opacity-50",
            )}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {isRetainer
              ? "The block the client commits to each cycle."
              : "Shown to the client as a projection, not a floor."}
          </p>
        </div>
      </div>

      {teamSlot}

      <ToggleRow
        title="No minimum commitment"
        hint="The client is billed for logged hours only, with nothing owed for an idle cycle."
        checked={config.noMinimumCommitment}
        onCheckedChange={(value) => onChange({ noMinimumCommitment: value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Billing cycle">
          <Dropdown
            value={config.billingCycle}
            onChange={(value) =>
              onChange({ billingCycle: value as ServiceHourlyConfig["billingCycle"] })
            }
            options={BILLING_CYCLE_OPTIONS}
          />
        </Field>
        <Field label="Cycle starts on">
          <Dropdown
            value={config.billingStartDay}
            onChange={(value) =>
              onChange({
                billingStartDay: value as ServiceHourlyConfig["billingStartDay"],
              })
            }
            options={BILLING_START_DAY_OPTIONS}
          />
        </Field>
      </div>

      <ToggleRow
        title="Hard cap on billable hours"
        hint="Hours past the ceiling are logged but never billed to the client."
        checked={config.hardCapEnabled}
        onCheckedChange={(value) =>
          onChange({
            hardCapEnabled: value,
            maxHoursPerMonth: value ? config.maxHoursPerMonth : undefined,
          })
        }
      >
        <label className={LABEL_CLS}>Maximum hours per month</label>
        <input
          type="number"
          onWheel={blurOnWheel}
          min={1}
          value={config.maxHoursPerMonth || ""}
          onChange={(e) =>
            onChange({ maxHoursPerMonth: parseFloat(e.target.value) || 0 })
          }
          placeholder="40"
          className={cn(INPUT_CLS, "py-2")}
        />
      </ToggleRow>

      <ToggleRow
        title="Require timesheet approval"
        hint="Logged hours must be approved on the Taskroom timesheet before they can be invoiced."
        checked={config.timesheetApprovalRequired}
        onCheckedChange={(value) => onChange({ timesheetApprovalRequired: value })}
      />

      <ToggleRow
        title="Security deposit"
        hint="Collected once at booking and held against the final invoice."
        checked={config.securityDepositEnabled}
        onCheckedChange={(value) =>
          onChange({
            securityDepositEnabled: value,
            securityDepositAmount: value ? config.securityDepositAmount : undefined,
          })
        }
      >
        <label className={LABEL_CLS}>Deposit amount ({currency})</label>
        <input
          type="number"
          onWheel={blurOnWheel}
          min={1}
          step="0.01"
          value={config.securityDepositAmount || ""}
          onChange={(e) =>
            onChange({ securityDepositAmount: parseFloat(e.target.value) || 0 })
          }
          placeholder="500.00"
          className={cn(INPUT_CLS, "py-2")}
        />
      </ToggleRow>

      {!isFree && config.hourlyRate > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
          <span className="text-xs text-zinc-300">
            {formatMoney(config.hourlyRate, currency)} per hour
            {billableHours > 0
              ? ` · ${billableHours} h ${config.billingCycle === "monthly" ? "a month" : "a month, billed " + (config.billingCycle === "weekly" ? "weekly" : "every two weeks")}`
              : ""}
            {config.hardCapEnabled && config.maxHoursPerMonth
              ? ` · capped at ${config.maxHoursPerMonth} h`
              : ""}
          </span>
          {billableHours > 0 && (
            <span className="text-lg font-bold text-brand">
              {formatMoney(monthlyEstimate, currency)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5 text-[11px] text-zinc-400">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        <span>
          Hours come from the engagement&apos;s Taskroom room: every billable time
          log on its tasks counts towards the cycle. Clients see the sheet only
          when &quot;Reveal timelog sheet&quot; is on in the Taskroom section.
        </span>
      </div>
    </>
  );
}

// ============================================================================
// Milestone builder
// ============================================================================

function MilestoneCard({
  milestone,
  index,
  total,
  currency,
  isFree,
  expanded,
  onExpand,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  milestone: MilestoneDraft;
  index: number;
  total: number;
  currency: string;
  isFree: boolean;
  expanded: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<MilestoneDraft>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [newDeliverable, setNewDeliverable] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const percent = total > 0 ? Math.round((milestone.amount / total) * 100) : 0;
  const isAdvance = milestone.paymentTiming === "advance";

  const badge = (
    <span className={isAdvance ? PILL_ADVANCE : PILL_COMPLETION}>
      {isAdvance ? "Advance" : "On completion"}
    </span>
  );

  const addDeliverable = () => {
    const value = newDeliverable.trim();
    if (!value || milestone.deliverables.length >= MAX_DELIVERABLES) return;
    onChange({ deliverables: [...milestone.deliverables, value] });
    setNewDeliverable("");
  };

  const handleAttachmentPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const room = MAX_MILESTONE_FILES - milestone.attachments.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_MILESTONE_FILES} files per milestone`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more file${room === 1 ? "" : "s"} can be attached here`);
    }

    setUploadingFile(true);
    const added: ServiceMilestoneAttachment[] = [];
    try {
      for (const file of files.slice(0, room)) {
        if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
          toast.error(`${file.name}: over ${MAX_ATTACHMENT_MB}MB`);
          continue;
        }
        const url = await uploadToBackend(file);
        added.push({
          name: file.name,
          url,
          size: file.size,
          contentType: file.type || undefined,
        });
      }
      if (added.length > 0) {
        onChange({ attachments: [...milestone.attachments, ...added] });
      }
    } catch {
      toast.error("Failed to attach file");
    } finally {
      setUploadingFile(false);
    }
  };

  if (!expanded) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onExpand}
        className="flex cursor-pointer items-center justify-between rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5 transition-colors hover:border-[#3A3A3A]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-700" />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand text-[11px] font-bold text-brand">
            {index + 1}
          </span>
          <span className="ml-2 truncate text-sm font-semibold text-white">
            {milestone.title || "Untitled milestone"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {milestone.duration && (
            <span className="text-xs text-zinc-500">{milestone.duration}</span>
          )}
          {!isFree && (
            <span className="text-sm font-bold text-brand">
              {formatMoney(milestone.amount, currency)}
            </span>
          )}
          {!isFree && badge}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="space-y-4 rounded-xl border-2 border-brand/60 bg-[#1A1A1A] p-4 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-zinc-700" />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand text-[11px] font-bold text-brand">
            {index + 1}
          </span>
          <span className="ml-2 truncate text-sm font-semibold text-white">
            {milestone.title || "Untitled milestone"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isFree && badge}
          <button
            type="button"
            onClick={onRemove}
            className="text-zinc-600 transition-colors hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExpand}
            className="text-zinc-600 transition-colors hover:text-white"
          >
            <ChevronDown className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>

      <Field label="Milestone name">
        <input
          value={milestone.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. UX Refinement & Wireframes"
          className={INPUT_CLS}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={milestone.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          placeholder="e.g. Develop high-fidelity wireframes and core screen layout map for approval..."
          className={cn(INPUT_CLS, "resize-none")}
        />
      </Field>

      <Field label="Milestone deliverables">
        <AddRow
          value={newDeliverable}
          onChange={setNewDeliverable}
          onAdd={addDeliverable}
          placeholder="Add deliverable..."
          disabled={milestone.deliverables.length >= MAX_DELIVERABLES}
          limitLabel={limitReachedLabel(MAX_DELIVERABLES, "deliverables")}
        />
        <ChipList
          items={milestone.deliverables}
          onRemove={(idx) =>
            onChange({
              deliverables: milestone.deliverables.filter((_, i) => i !== idx),
            })
          }
        />
      </Field>

      <Field label={`Attachments (${milestone.attachments.length}/${MAX_MILESTONE_FILES})`}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleAttachmentPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile || milestone.attachments.length >= MAX_MILESTONE_FILES}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#262626] py-2.5 text-xs font-medium text-zinc-400 transition-all hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#262626] disabled:hover:text-zinc-400"
        >
          {uploadingFile ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Attach brief, spec or asset (max {MAX_ATTACHMENT_MB}MB each)
        </button>
        {milestone.attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {milestone.attachments.map((file, idx) => (
              <div
                key={`${file.url}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-brand" />
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-zinc-200 hover:text-brand hover:underline"
                >
                  {file.name}
                </a>
                {formatFileSize(file.size) && (
                  <span className="shrink-0 text-[11px] text-zinc-500">
                    {formatFileSize(file.size)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      attachments: milestone.attachments.filter((_, i) => i !== idx),
                    })
                  }
                  className="shrink-0 text-zinc-600 transition-colors hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Duration"
          hint={index === 0 ? "Starts: Immediately" : `Starts: after milestone ${index}`}
        >
          <input
            value={milestone.duration}
            onChange={(e) => onChange({ duration: e.target.value })}
            placeholder="12 days"
            className={INPUT_CLS}
          />
        </Field>
        <div>
          <label className={LABEL_CLS}>Amount ({currency})</label>
          <input
            type="number"
            onWheel={blurOnWheel}
            min={0}
            value={milestone.amount || ""}
            onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            disabled={isFree}
            className={cn(INPUT_CLS, isFree && "opacity-50")}
          />
          {!isFree && (
            <span className="mt-1 inline-block rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
              {percent}% of total
            </span>
          )}
        </div>
      </div>

      {!isFree && (
        <Field label="Payment timing">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#262626] bg-[#1A1A1A] p-1">
            <button
              type="button"
              onClick={() => onChange({ paymentTiming: "advance" })}
              className={cn(
                "rounded-lg px-3 py-2 text-left transition-all",
                isAdvance
                  ? "bg-brand/10 ring-1 ring-brand/30"
                  : "hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "block text-xs font-semibold",
                  isAdvance ? "text-brand" : "text-zinc-300",
                )}
              >
                Advance
              </span>
              <span className="block text-[11px] text-zinc-500">Paid upfront</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ paymentTiming: "on_completion" })}
              className={cn(
                "rounded-lg px-3 py-2 text-left transition-all",
                !isAdvance
                  ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                  : "hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "block text-xs font-semibold",
                  !isAdvance ? "text-emerald-400" : "text-zinc-300",
                )}
              >
                On completion
              </span>
              <span className="block text-[11px] text-zinc-500">Paid after approval</span>
            </button>
          </div>
        </Field>
      )}
    </div>
  );
}

// ============================================================================
// Modal
// ============================================================================

export interface ServiceFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  service?: Service | null;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

export function ServiceFormModal({
  isOpen,
  mode,
  service,
  onClose,
  onSaved,
}: ServiceFormModalProps) {
  // --- Section 1: basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // --- Section 2: pricing
  const [pricingModel, setPricingModel] = useState<"milestone" | "billable">("milestone");
  const [isFree, setIsFree] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [taxMode, setTaxMode] = useState<"inclusive" | "exclusive">("inclusive");
  const [bookingAdvanceFeeEnabled, setBookingAdvanceFeeEnabled] = useState(false);
  const [bookingAdvanceFee, setBookingAdvanceFee] = useState(0);
  const [cancellationPolicy, setCancellationPolicy] = useState(CANCELLATION_PRESETS[0]);
  const [customPolicy, setCustomPolicy] = useState(false);

  // --- Section 3: milestones (milestone pricing) or hourly setup (billable)
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [hourlyConfig, setHourlyConfig] = useState<ServiceHourlyConfig>({
    ...DEFAULT_HOURLY_CONFIG,
  });
  const patchHourly = useCallback(
    (patch: Partial<ServiceHourlyConfig>) =>
      setHourlyConfig((prev) => ({ ...prev, ...patch })),
    [],
  );
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  // --- Section 4: highlights
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [whyChooseUs, setWhyChooseUs] = useState<ServiceWhyChooseUs[]>([]);
  // Parked with the "Why choose us" UI:
  // const [uploadingWhyIcon, setUploadingWhyIcon] = useState(false);
  // const whyIconInputRef = useRef<HTMLInputElement>(null);
  const [icon, setIcon] = useState("");
  const [iconBgColor, setIconBgColor] = useState("#1a1a22");

  // --- Section 5: contact & visibility
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [restrictToUsers, setRestrictToUsers] = useState(false);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  // --- Section 6: taskroom & customer visibility
  const [taskroomConfig, setTaskroomConfig] = useState<ServiceTaskroomConfig>(
    emptyTaskroomConfig,
  );

  // --- UI
  const founderAlertsForm = useFounderAlerts();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => milestones.reduce((sum, m) => sum + (m.amount || 0), 0),
    [milestones],
  );

  // Hydrate from the service being edited (and reset between opens)
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && service) {
      setTitle(service.title || "");
      setDescription(service.description || "");
      setLongDescription(service.longDescription || "");
      setImages(service.images?.length ? service.images : service.coverImage ? [service.coverImage] : []);
      setVideos(service.videos || []);
      setYoutubeUrl(service.youtubeUrl || "");
      setCategory(service.category || "");
      setDuration(service.duration || "");
      setPricingModel(service.pricingModel || "milestone");
      setIsFree(service.paymentTiming === "free");
      setCurrency(service.currency || "USD");
      setTaxMode(service.taxMode || "inclusive");
      setBookingAdvanceFeeEnabled(!!service.bookingAdvanceFeeEnabled);
      setBookingAdvanceFee(service.bookingAdvanceFee || 0);
      setCancellationPolicy(service.cancellationPolicy || CANCELLATION_PRESETS[0]);
      setCustomPolicy(
        !!service.cancellationPolicy &&
          !CANCELLATION_PRESETS.includes(service.cancellationPolicy),
      );
      setMilestones(
        (service.milestones || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((m) => ({
            id: m._id,
            persistedId: m._id,
            title: m.title,
            description: m.description || "",
            duration: m.duration || "",
            deliverables: m.deliverables || [],
            attachments: m.attachments || [],
            amount: m.paymentAmount || 0,
            paymentTiming:
              m.paymentTiming ||
              (service.paymentTiming === "pay_after_milestone"
                ? "on_completion"
                : "advance"),
          })),
      );
      setHourlyConfig({
        ...DEFAULT_HOURLY_CONFIG,
        ...(service.hourlyConfig || {}),
      });
      setTags(service.tags || []);
      setFeatures(service.features || []);
      setDeliverables(service.deliverables || []);
      setWhyChooseUs(service.whyChooseUs || []);
      setIcon(service.icon || "");
      setIconBgColor(service.iconBgColor || "#1a1a22");
      setContactPhone(service.contactInfo?.phone || "");
      setContactEmail(service.contactInfo?.email || "");
      setContactWhatsapp(service.contactInfo?.whatsapp || "");
      setRestrictToUsers((service.allowedUserIds?.length || 0) > 0);
      setAllowedUserIds(service.allowedUserIds || []);
      setTaskroomConfig(service.taskroomConfig || emptyTaskroomConfig());
      founderAlertsForm.hydrate((service as any).founderAlerts);
    } else {
      setTitle("");
      setDescription("");
      setLongDescription("");
      setImages([]);
      setVideos([]);
      setYoutubeUrl("");
      setCategory("");
      setDuration("");
      setPricingModel("milestone");
      setIsFree(false);
      setCurrency("USD");
      setTaxMode("inclusive");
      setBookingAdvanceFeeEnabled(false);
      setBookingAdvanceFee(0);
      setCancellationPolicy(CANCELLATION_PRESETS[0]);
      setCustomPolicy(false);
      setMilestones([]);
      setHourlyConfig({ ...DEFAULT_HOURLY_CONFIG });
      setTags([]);
      setFeatures([]);
      setDeliverables([]);
      setWhyChooseUs([]);
      setIcon("");
      setIconBgColor("#1a1a22");
      setContactPhone("");
      setContactEmail("");
      setContactWhatsapp("");
      setRestrictToUsers(false);
      setAllowedUserIds([]);
      setTaskroomConfig(emptyTaskroomConfig());
      founderAlertsForm.reset();
    }

    setYoutubeDraft("");
    setNewTag("");
    setNewFeature("");
    setNewDeliverable("");
    setMemberSearchQuery("");
    setExpandedMilestone(null);
    setShowTemplates(false);
    setError("");
  }, [isOpen, mode, service]);

  // Lock background scroll while the modal is open
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // The roster is needed by three surfaces now: the visibility restriction in
  // Section 5, the delivery team in Section 3 and the card assignees in
  // Section 6 — so load it as soon as any of them can be reached.
  const needsMembers =
    restrictToUsers || pricingModel === "billable" || taskroomConfig.enabled;

  useEffect(() => {
    if (!needsMembers || orgMembers.length > 0) return;
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;
    setLoadingMembers(true);
    getTeamMembers(orgId)
      .then(setOrgMembers)
      .catch(() => toast.error("Failed to load members"))
      .finally(() => setLoadingMembers(false));
  }, [needsMembers, orgMembers.length]);

  // --- media handlers
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_IMAGES} images per service`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more image${room === 1 ? "" : "s"} can be added`);
    }

    setUploadingImage(true);
    try {
      for (const file of files.slice(0, room)) {
        if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
          toast.error(`${file.name}: PNG or JPEG only`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: over 10MB`);
          continue;
        }
        const url = await uploadToBackend(file);
        setImages((prev) => [...prev, url]);
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const room = MAX_VIDEOS - videos.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_VIDEOS} videos per service`);
      return;
    }
    if (files.length > room) {
      toast.error(`Only ${room} more video${room === 1 ? "" : "s"} can be added`);
    }

    setUploadingVideo(true);
    try {
      for (const file of files.slice(0, room)) {
        if (!["video/mp4", "video/webm"].includes(file.type)) {
          toast.error(`${file.name}: MP4 or WebM only`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name}: over 50MB`);
          continue;
        }
        const url = await uploadToBackend(file);
        setVideos((prev) => [...prev, url]);
      }
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploadingVideo(false);
    }
  };

  /* Parked with the "Why choose us" UI:
  const handleWhyIconPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = parseInt(e.target.dataset.idx || "0", 10);
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setUploadingWhyIcon(true);
    try {
      const url = await uploadToBackend(file);
      setWhyChooseUs((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, icon: url } : item)),
      );
    } catch {
      toast.error("Failed to upload icon");
    } finally {
      setUploadingWhyIcon(false);
    }
  };

  */

  // --- milestone handlers
  const addMilestone = useCallback(() => {
    const draft: MilestoneDraft = {
      id: uid(),
      title: "",
      description: "",
      duration: "",
      deliverables: [],
      attachments: [],
      amount: 0,
      paymentTiming: milestones.length === 0 ? "advance" : "on_completion",
    };
    setMilestones((prev) => [...prev, draft]);
    setExpandedMilestone(draft.id);
  }, [milestones.length]);

  const applyTemplate = (templateIndex: number) => {
    const template = MILESTONE_TEMPLATES[templateIndex];
    setMilestones(template.milestones.map((m) => ({ ...m, id: uid() })));
    setShowTemplates(false);
    setExpandedMilestone(null);
    toast.success(`${template.name} template applied`);
  };

  const moveMilestone = (from: number, to: number) => {
    if (from === to) return;
    setMilestones((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const isBillable = pricingModel === "billable";

  // --- Section 3 delivery team ↔ Section 6 board
  //
  // The team roster and the board are one flow: a person added here is added to
  // the client's room, and a task given to them is a card on the board with
  // them as its assignee. Both sides read the same `taskroomConfig`, so there is
  // no second list to keep in step.

  const deliveryTeam = hourlyConfig.team || [];

  /**
   * Only staff can be given work: guests joined through the guest-request flow
   * and are not part of the organisation's delivery capacity, so they are never
   * offered as an assignee or a team member.
   */
  const staffMembers = useMemo(
    () => orgMembers.filter((member) => !member.guest),
    [orgMembers],
  );

  /** Task titles per assignee, for the chips under each team member. */
  const assignedTasks = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const stage of taskroomConfig.stages) {
      for (const task of stage.tasks) {
        const userId = task.assignee?.userId;
        if (!userId) continue;
        (map[userId] = map[userId] || []).push(task.title);
      }
    }
    return map;
  }, [taskroomConfig.stages]);

  /**
   * Put a new card in the first column the client can work in — the leftmost
   * shared column that is not the terminal Completed one, so the task starts
   * where work starts.
   */
  const assignTaskToMember = (member: ServiceTeamMember, title: string) => {
    setTaskroomConfig((prev) => {
      const stages =
        prev.stages.length > 0
          ? prev.stages
          : buildDefaultStages(
              milestones.map((m) => ({
                title: m.title,
                deliverables: m.deliverables,
              })),
              isBillable,
            );

      const targetIndex = stages.findIndex(
        (stage) => !stage.isInternal && stage.stageType !== "done",
      );
      const index = targetIndex >= 0 ? targetIndex : 0;

      return {
        ...prev,
        stages: stages.map((stage, i) =>
          i !== index
            ? stage
            : {
                ...stage,
                tasks: [
                  ...stage.tasks,
                  {
                    title,
                    kind: "task" as const,
                    priority: "medium" as const,
                    assignee: {
                      userId: member.userId,
                      name: member.name,
                      email: member.email,
                      image: member.image,
                    },
                  },
                ],
              },
        ),
      };
    });
  };

  /** Removing the chip removes the card it stands for. */
  const unassignTaskFromMember = (userId: string, title: string) => {
    setTaskroomConfig((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        tasks: stage.tasks.filter(
          (task) => !(task.assignee?.userId === userId && task.title === title),
        ),
      })),
    }));
  };

  /**
   * Anyone in the org can own a card. The delivery team is listed first because
   * that is who the founder just picked, but a milestone service has no roster
   * and still needs assignees.
   */
  const assignableMembers: ServiceTaskAssignee[] = useMemo(() => {
    const seen = new Set<string>();
    const list: ServiceTaskAssignee[] = [];

    for (const member of deliveryTeam) {
      if (seen.has(member.userId)) continue;
      seen.add(member.userId);
      list.push({
        userId: member.userId,
        name: member.name,
        email: member.email,
        image: member.image,
      });
    }

    for (const member of staffMembers) {
      if (seen.has(member._id)) continue;
      seen.add(member._id);
      list.push({
        userId: member._id,
        name: member.name || member.email,
        email: member.email,
        image: member.profilePicture,
      });
    }

    return list;
  }, [deliveryTeam, staffMembers]);

  // --- completion tracking
  const completion: Record<SectionKey, boolean> = {
    basics: !!title.trim() && !!description.trim(),
    pricing:
      !!currency &&
      !!cancellationPolicy.trim() &&
      (!bookingAdvanceFeeEnabled || bookingAdvanceFee > 0),
    // Section 3 is either the milestone list or the hourly setup, never both.
    milestones: isBillable
      ? (isFree || hourlyConfig.hourlyRate > 0) &&
        (hourlyConfig.noMinimumCommitment ||
          hourlyConfig.billingModelType === "hourly" ||
          hourlyConfig.estimatedMonthlyHours > 0) &&
        (!hourlyConfig.hardCapEnabled || (hourlyConfig.maxHoursPerMonth || 0) > 0) &&
        (!hourlyConfig.securityDepositEnabled ||
          (hourlyConfig.securityDepositAmount || 0) > 0)
      : milestones.length > 0 &&
        milestones.every((m) => m.title.trim() && (isFree || m.amount > 0)),
    highlights: features.length > 0 || deliverables.length > 0,
    access: !!(contactPhone.trim() || contactEmail.trim() || contactWhatsapp.trim()),
    // Either the founder configured a board — columns and a workspace to
    // provision them into — or they deliberately opted out.
    taskroom:
      !taskroomConfig.enabled ||
      (taskroomConfig.stages.length > 0 && !!taskroomConfig.workspaceId),
    publish:
      !!title.trim() &&
      (isFree || (isBillable ? hourlyConfig.hourlyRate > 0 : total > 0)),
  };

  const totalSections = Object.keys(completion).length;
  const completedSections = Object.values(completion).filter(Boolean).length;

  // --- save
  const buildPayload = (status: "draft" | "active") => {
    const milestonePayload: ServiceMilestoneInput[] = milestones.map((m, index) => ({
      ...(m.persistedId ? { _id: m.persistedId } : {}),
      order: index + 1,
      title: m.title.trim(),
      description: m.description.trim() || undefined,
      duration: m.duration.trim() || undefined,
      deliverables: filterNonEmptyStrings(m.deliverables),
      attachments: m.attachments,
      paymentAmount: isFree ? 0 : m.amount || 0,
      currency,
      paymentTiming: m.paymentTiming,
    }));

    // Service-level timing stays in sync for legacy consumers; the per-milestone
    // value is what the payment gating actually reads.
    // Billable work is billed in arrears, from the hours approved in the cycle.
    const paymentTiming: Service["paymentTiming"] = isFree
      ? "free"
      : isBillable
        ? "pay_after_milestone"
        : milestones[0]?.paymentTiming === "on_completion"
          ? "pay_after_milestone"
          : "pay_before_milestone";

    const contactInfo =
      contactPhone.trim() || contactEmail.trim() || contactWhatsapp.trim()
        ? {
            phone: contactPhone.trim() || undefined,
            email: contactEmail.trim() || undefined,
            whatsapp: contactWhatsapp.trim() || undefined,
          }
        : undefined;

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      longDescription: longDescription.trim() || undefined,
      icon: icon.trim() || undefined,
      iconBgColor: iconBgColor || undefined,
      coverImage: images[0] || undefined,
      images,
      videos,
      youtubeUrl: youtubeUrl.trim() || undefined,
      category: category || undefined,
      duration: duration.trim() || undefined,
      // Blank chips can't be typed in, but a service loaded from an older
      // record can carry them — strip on the way back out either way.
      tags: filterNonEmptyStrings(tags),
      features: filterNonEmptyStrings(features),
      deliverables: filterNonEmptyStrings(deliverables),
      pricingModel,
      paymentTiming,
      currency,
      taxMode,
      bookingAdvanceFeeEnabled,
      bookingAdvanceFee: bookingAdvanceFeeEnabled ? bookingAdvanceFee : 0,
      cancellationPolicy: cancellationPolicy.trim() || undefined,
      // The two pricing models are exclusive: a billable service keeps no
      // milestones, and switching back to milestones clears the hourly setup
      // server-side rather than leaving it for a later billing run to read.
      milestones: isBillable ? [] : milestonePayload,
      hourlyConfig: isBillable ? hourlyConfig : null,
      status,
      whyChooseUs: whyChooseUs.filter((w) => w.title.trim() && w.icon.trim()),
      contactInfo,
      allowedUserIds: restrictToUsers ? allowedUserIds : [],
      taskroomConfig,
      founderAlerts: founderAlertsForm.buildPayload(),
    };
  };

  const validate = () => {
    if (!title.trim()) {
      setError("Please enter a service name");
        return false;
    }
    if (isBillable) {
      if (!isFree && hourlyConfig.hourlyRate <= 0) {
        setError("Set an hourly rate for a paid billable service");
        return false;
      }
      if (
        hourlyConfig.billingModelType === "retainer" &&
        hourlyConfig.estimatedMonthlyHours <= 0
      ) {
        setError("A retainer needs the hours committed each cycle");
        return false;
      }
      if (
        hourlyConfig.hardCapEnabled &&
        (hourlyConfig.maxHoursPerMonth || 0) <= 0
      ) {
        setError("Set the maximum billable hours, or turn the hard cap off");
        return false;
      }
      if (
        hourlyConfig.securityDepositEnabled &&
        (hourlyConfig.securityDepositAmount || 0) <= 0
      ) {
        setError("Set the deposit amount, or turn the security deposit off");
        return false;
      }
    } else {
      if (!isFree && milestones.length === 0) {
        setError("Add at least one milestone for a paid service");
        return false;
      }
      if (milestones.some((m) => !m.title.trim())) {
        setError("Every milestone needs a name");
        return false;
      }
    }
    // Without a workspace the server would have to guess where client rooms
    // belong; the founder picks it in section 6 instead.
    if (taskroomConfig.enabled && !taskroomConfig.workspaceId) {
      setError("Pick a Taskroom workspace in the Taskroom & Customer Visibility section");
      return false;
    }
    setError("");
    return true;
  };

  const handleSave = async (status: "draft" | "active") => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload(status);
      const result =
        mode === "edit" && service
          ? await updateService(service._id, payload)
          : await createService(payload);

      if (!isFree && result.service._id) {
        try {
          await saveCommissionPlan(result.service._id);
        } catch (commissionError) {
          console.error("Error saving commission plan:", commissionError);
        }
      }

      const firstPublish = mode === "edit" && service?.status === "draft" && status === "active";
      if (mode !== "edit" || firstPublish) announceService(result.service);
      else toast.success("Service saved");
      onSaved(result.service);
    } catch (saveError) {
      console.error("Error saving service:", saveError);
      // Surface the API's own message — a silent "try again" hides real causes
      // like a rejected field or an expired session.
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : "Failed to save service. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredMembers = orgMembers.filter(
    (m) =>
      m.role !== "founder" &&
      (m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-[#262626] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {mode === "edit" ? "Edit Digital Service" : "Create Digital Service"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              Configure pricing, deliverables, and service parameters.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-[#262626] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ---------------- 1. Basic Details ---------------- */}
          <SectionBlock
            index={1}
            title="Basic Details"
            complete={completion.basics}
          >
            <Field label="Service name">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                placeholder="e.g. Brand Identity Sprint"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Describe your service offering, core deliverables, and target client..."
                className={cn(INPUT_CLS, "resize-none")}
              />
            </Field>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={handleImagePick}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm"
              multiple
              onChange={handleVideoPick}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() =>
                  images.length >= MAX_IMAGES
                    ? toast.error(`Up to ${MAX_IMAGES} images per service`)
                    : imageInputRef.current?.click()
                }
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-4 transition-all",
                  images.length >= MAX_IMAGES
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-[#3A3A3A]",
                )}
              >
                <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">
                    Upload service images
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    PNG or JPEG up to 10MB · {images.length}/{MAX_IMAGES}
                  </p>
                </div>
              </div>
              <div
                onClick={() =>
                  videos.length >= MAX_VIDEOS
                    ? toast.error(`Up to ${MAX_VIDEOS} videos per service`)
                    : videoInputRef.current?.click()
                }
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-4 transition-all",
                  videos.length >= MAX_VIDEOS
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-[#3A3A3A]",
                )}
              >
                <span className="rounded-lg bg-brand/10 p-2.5 text-brand">
                  {uploadingVideo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Film className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">Upload video files</p>
                  <p className="text-[11px] text-zinc-500">
                    MP4 or WebM up to 50MB · {videos.length}/{MAX_VIDEOS}
                  </p>
                </div>
              </div>
            </div>

            {(images.length > 0 || videos.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {images.map((url, idx) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-16 w-24 rounded-lg border border-[#262626] object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-bold text-brand">
                        COVER
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {videos.map((url, idx) => (
                  <div key={url} className="group relative">
                    <video
                      src={url}
                      className="h-16 w-24 rounded-lg border border-[#262626] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Field label="YouTube demo link (optional)">
              <div className="flex gap-2">
                <input
                  value={youtubeDraft}
                  onChange={(e) => setYoutubeDraft(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = youtubeDraft.trim();
                    if (!value) return;
                    if (!youtubeId(value)) {
                      toast.error("Enter a valid YouTube link");
                      return;
                    }
                    setYoutubeUrl(value);
                    setYoutubeDraft("");
                  }}
                  className="shrink-0 rounded-lg bg-brand px-4 text-xs font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                >
                  Add
                </button>
              </div>
              {youtubeUrl && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#262626] bg-[#1A1A1A] p-2">
                  <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={youtubeThumb(youtubeUrl) || ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-white">
                      YouTube demo attached
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {youtubeUrl}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setYoutubeUrl("")}
                    className="shrink-0 text-zinc-600 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Dropdown
                  value={category}
                  onChange={setCategory}
                  placeholder="Select a category"
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Expected sprint duration">
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 34 days"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

          </SectionBlock>

          {/* ---------------- 2. Pricing Model ---------------- */}
          <SectionBlock
            index={2}
            title="Pricing Model"
            complete={completion.pricing}
          >
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPricingModel("milestone")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  pricingModel === "milestone"
                    ? "border-brand bg-brand/5"
                    : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
                )}
              >
                <div className="flex items-start justify-between">
                  <Layers className="h-5 w-5 text-brand" />
                  <GoldRadio checked={pricingModel === "milestone"} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-white">Milestone-based</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Clients pay upon approval of fixed-price stages.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPricingModel("billable")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  pricingModel === "billable"
                    ? "border-brand bg-brand/5"
                    : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
                )}
              >
                <div className="flex items-start justify-between">
                  <Clock className="h-5 w-5 text-brand" />
                  <GoldRadio checked={pricingModel === "billable"} />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-white">Billable-based</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Tracked hourly support with automatic invoice generation.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
              <div>
                <p className="text-xs font-semibold text-white">Offer this service for free</p>
                <p className="text-[11px] text-zinc-500">
                  Milestones stay, but no payment is collected.
                </p>
              </div>
              <Switch
                checked={isFree}
                onCheckedChange={setIsFree}
                className="data-[state=checked]:bg-brand"
              />
            </div>

            <Field label="Currency">
              <Dropdown value={currency} onChange={setCurrency} options={CURRENCIES} />
            </Field>

            <Field label="Tax and GST handling">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTaxMode("inclusive")}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                    taxMode === "inclusive"
                      ? "border-brand bg-brand/5"
                      : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
                  )}
                >
                  <GoldRadio checked={taxMode === "inclusive"} />
                  <span className="text-xs text-zinc-200">
                    Prices are inclusive of standard local taxes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaxMode("exclusive")}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                    taxMode === "exclusive"
                      ? "border-brand bg-brand/5"
                      : "border-[#262626] bg-[#1A1A1A] hover:border-[#3A3A3A]",
                  )}
                >
                  <GoldRadio checked={taxMode === "exclusive"} />
                  <span className="text-xs text-zinc-200">
                    Add extra tax calculation dynamically at invoice step
                  </span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-brand">
                * Note: 18% GST is added at checkout for Indian buyers
              </p>
            </Field>

            <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Switch
                    checked={bookingAdvanceFeeEnabled}
                    onCheckedChange={setBookingAdvanceFeeEnabled}
                    className="mt-0.5 data-[state=checked]:bg-brand"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Enable booking advance fee
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Requires clients to pay an upfront retainer
                    </p>
                  </div>
                </div>
                {bookingAdvanceFeeEnabled && (
                  <div className="w-40 shrink-0">
                    <label className={LABEL_CLS}>Fee amount ({currency})</label>
                    <input
                      type="number"
                      onWheel={blurOnWheel}
                      min={0}
                      value={bookingAdvanceFee || ""}
                      onChange={(e) =>
                        setBookingAdvanceFee(parseFloat(e.target.value) || 0)
                      }
                      placeholder="500.00"
                      className={cn(INPUT_CLS, "py-2")}
                    />
                  </div>
                )}
              </div>
            </div>

            <Field label="Cancellation policy">
              <Dropdown
                value={customPolicy ? "__custom" : cancellationPolicy}
                onChange={(value) => {
                  if (value === "__custom") {
                    setCustomPolicy(true);
                    setCancellationPolicy("");
                  } else {
                    setCustomPolicy(false);
                    setCancellationPolicy(value);
                  }
                }}
                options={[
                  ...CANCELLATION_PRESETS.map((p) => ({ value: p, label: p })),
                  { value: "__custom", label: "Custom policy…" },
                ]}
              />
              {customPolicy && (
                <input
                  value={cancellationPolicy}
                  onChange={(e) => setCancellationPolicy(e.target.value)}
                  placeholder="Describe your cancellation terms"
                  className={cn(INPUT_CLS, "mt-2")}
                />
              )}
            </Field>

            <div className="flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs text-brand/90">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Adjusting pricing models won&apos;t affect current live engagements in
                progress. Changes apply only to new client orders.
              </span>
            </div>
          </SectionBlock>

          {/* ------- 3. Service Milestones / Billable & Hourly Setup ------- */}
          <SectionBlock
            index={3}
            title={isBillable ? "Billable & Hourly Setup" : "Service Milestones"}
            complete={completion.milestones}
            action={
              isBillable ? undefined : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplates((prev) => !prev)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Start from a template
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-7 z-10 w-64 overflow-hidden rounded-xl border border-[#262626] bg-[#1A1A1A] shadow-2xl">
                    {MILESTONE_TEMPLATES.map((template, idx) => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() => applyTemplate(idx)}
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                      >
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                        <span>
                          <span className="block text-xs font-semibold text-white">
                            {template.name}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            {template.hint}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )
            }
          >
            {isBillable ? (
              <BillableSetup
                config={hourlyConfig}
                currency={currency}
                isFree={isFree}
                onChange={patchHourly}
                teamSlot={
                  <DeliveryTeamSection
                    team={deliveryTeam}
                    onChange={(team) => patchHourly({ team })}
                    currency={currency}
                    hourlyRate={hourlyConfig.hourlyRate}
                    members={staffMembers}
                    loadingMembers={loadingMembers}
                    assignedTasks={assignedTasks}
                    onAssignTask={assignTaskToMember}
                    onUnassignTask={unassignTaskFromMember}
                    boardEnabled={taskroomConfig.enabled}
                  />
                }
              />
            ) : (
              <>
              {milestones.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#262626] py-6 text-center text-xs text-zinc-500">
                  No milestones yet. Add one, or start from a template.
                </p>
              )}

              <div className="space-y-2.5">
                {milestones.map((milestone, index) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    index={index}
                    total={total}
                    currency={currency}
                    isFree={isFree}
                    expanded={expandedMilestone === milestone.id}
                    onExpand={() =>
                      setExpandedMilestone(
                        expandedMilestone === milestone.id ? null : milestone.id,
                      )
                    }
                    onChange={(patch) =>
                      setMilestones((prev) =>
                        prev.map((m) => (m.id === milestone.id ? { ...m, ...patch } : m)),
                      )
                    }
                    onRemove={() => {
                      setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));
                      setExpandedMilestone(null);
                    }}
                    onDragStart={() => {
                      dragIndexRef.current = index;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndexRef.current !== null) {
                        moveMilestone(dragIndexRef.current, index);
                        dragIndexRef.current = null;
                      }
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addMilestone}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#262626] py-2.5 text-xs font-medium text-zinc-400 transition-all hover:border-brand hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Milestone
              </button>

              {!isFree && milestones.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
                  <span className="text-xs text-zinc-300">
                    Total from {milestones.length} milestone
                    {milestones.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-lg font-bold text-brand">
                    {formatMoney(total, currency)}
                  </span>
                </div>
              )}
              </>
            )}
          </SectionBlock>

          {/* ---------------- 4. Deliverables & Highlights ---------------- */}
          <SectionBlock
            index={4}
            title="Deliverables & Highlights"
            complete={completion.highlights}
          >
            <Field label="What's included">
              <AddRow
                value={newFeature}
                onChange={setNewFeature}
                onAdd={() => {
                  const value = newFeature.trim();
                  if (!value || features.length >= MAX_BENEFITS) return;
                  setFeatures([...features, value]);
                  setNewFeature("");
                }}
                placeholder="Add a feature..."
                disabled={features.length >= MAX_BENEFITS}
                limitLabel={limitReachedLabel(MAX_BENEFITS, "items")}
              />
              <ChipList
                items={features}
                onRemove={(idx) => setFeatures(features.filter((_, i) => i !== idx))}
              />
            </Field>

            <Field label="Deliverables the client receives">
              <AddRow
                value={newDeliverable}
                onChange={setNewDeliverable}
                onAdd={() => {
                  const value = newDeliverable.trim();
                  if (!value || deliverables.length >= MAX_DELIVERABLES) return;
                  setDeliverables([...deliverables, value]);
                  setNewDeliverable("");
                }}
                placeholder="Add a deliverable..."
                disabled={deliverables.length >= MAX_DELIVERABLES}
                limitLabel={limitReachedLabel(MAX_DELIVERABLES, "deliverables")}
              />
              <ChipList
                items={deliverables}
                onRemove={(idx) =>
                  setDeliverables(deliverables.filter((_, i) => i !== idx))
                }
              />
            </Field>

            <Field label="Tags">
              <AddRow
                value={newTag}
                onChange={setNewTag}
                onAdd={() => {
                  const value = newTag.trim();
                  if (!value) return;
                  if (tags.includes(value)) {
                    toast.error("Tag already exists");
                    return;
                  }
                  setTags([...tags, value]);
                  setNewTag("");
                }}
                placeholder="Add a tag..."
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#262626] bg-[#1A1A1A] px-2.5 py-1 text-xs text-zinc-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            {/* Parked until we use them again — "Why choose us" cards and the
                emoji icon / icon background pickers. Existing values still
                round-trip through state, so nothing is lost on edit.

            <input
              ref={whyIconInputRef}
              type="file"
              accept="image/*"
              onChange={handleWhyIconPick}
              className="hidden"
            />

            <Field label="Why choose us">
              <div className="space-y-2">
                {whyChooseUs.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (whyIconInputRef.current) {
                          whyIconInputRef.current.dataset.idx = String(idx);
                          whyIconInputRef.current.click();
                        }
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#3A3A3A] transition-colors hover:border-brand"
                    >
                      {uploadingWhyIcon ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                      ) : item.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.icon} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Star className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                    </button>
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.title}
                        onChange={(e) =>
                          setWhyChooseUs((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, title: e.target.value } : it,
                            ),
                          )
                        }
                        placeholder="Title (e.g. Fast Delivery)"
                        className={cn(INPUT_CLS, "py-2")}
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) =>
                          setWhyChooseUs((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, description: e.target.value } : it,
                            ),
                          )
                        }
                        rows={2}
                        placeholder="Description..."
                        className={cn(INPUT_CLS, "resize-none py-2")}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setWhyChooseUs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-zinc-600 transition-colors hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setWhyChooseUs([...whyChooseUs, { icon: "", title: "", description: "" }])
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#262626] py-2.5 text-xs font-medium text-zinc-400 transition-all hover:border-brand hover:text-brand"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add card
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Icon (emoji)">
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="💻"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Icon background">
                <input
                  type="color"
                  value={iconBgColor}
                  onChange={(e) => setIconBgColor(e.target.value)}
                  className="h-[46px] w-full cursor-pointer rounded-xl border border-[#262626] bg-[#1A1A1A] p-1"
                />
              </Field>
            </div>
            */}
          </SectionBlock>

          {/* ---------------- 5. Contact & Visibility ---------------- */}
          <SectionBlock
            index={5}
            title="Contact & Visibility"
            complete={completion.access}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone number">
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Email">
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="hello@company.com"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
            <Field label="WhatsApp number">
              <input
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                placeholder="+91 98765 43210"
                className={INPUT_CLS}
              />
            </Field>

            {/* Founder's own "someone opted in" alert */}
            <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
              <FounderAlertsSection
                {...founderAlertsForm.sectionProps}
                context="service"
              />
            </div>

            <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Restrict to specific users
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Only selected users can see and opt into this service
                    </p>
                  </div>
                </div>
                <Switch
                  checked={restrictToUsers}
                  onCheckedChange={(checked) => {
                    setRestrictToUsers(checked);
                    if (!checked) {
                      setAllowedUserIds([]);
                      setMemberSearchQuery("");
                    }
                  }}
                  className="data-[state=checked]:bg-brand"
                />
              </div>

              {restrictToUsers && (
                <div className="mt-3 space-y-2.5">
                  {allowedUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allowedUserIds.map((uidValue) => {
                        const member = orgMembers.find((m) => m._id === uidValue);
                        return (
                          <span
                            key={uidValue}
                            className="inline-flex items-center gap-1.5 rounded-md border border-brand/20 bg-brand/10 px-2.5 py-1 text-xs text-brand"
                          >
                            {member?.name || "Selected user"}
                            <button
                              type="button"
                              onClick={() =>
                                setAllowedUserIds((prev) =>
                                  prev.filter((id) => id !== uidValue),
                                )
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                    <input
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search members by name or email..."
                      className={cn(INPUT_CLS, "py-2 pl-9")}
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[#262626] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {loadingMembers ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <p className="py-6 text-center text-xs text-zinc-500">
                        No members found
                      </p>
                    ) : (
                      filteredMembers.map((member) => {
                        const selected = allowedUserIds.includes(member._id);
                        return (
                          <button
                            key={member._id}
                            type="button"
                            onClick={() =>
                              setAllowedUserIds((prev) =>
                                selected
                                  ? prev.filter((id) => id !== member._id)
                                  : [...prev, member._id],
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              selected ? "bg-brand/10" : "hover:bg-white/5",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-brand bg-brand"
                                  : "border-[#3A3A3A]",
                              )}
                            >
                              {selected && <Check className="h-3 w-3 text-black" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-white">
                                {member.name}
                              </span>
                              <span className="block truncate text-[11px] text-zinc-500">
                                {member.email}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </SectionBlock>

          {/* ---------------- 6. Taskroom & Customer Visibility ---------------- */}
          <SectionBlock
            index={6}
            title="Taskroom & Customer Visibility"
            complete={completion.taskroom}
          >
            <TaskroomVisibilitySection
              config={taskroomConfig}
              onChange={setTaskroomConfig}
              milestones={milestones.map((m) => ({
                title: m.title,
                deliverables: m.deliverables,
              }))}
              serviceTitle={title}
              billable={isBillable}
              assignableMembers={assignableMembers}
            />
          </SectionBlock>

          {/* ---------------- 7. Commission & Publish ---------------- */}
          <SectionBlock
            index={7}
            title="Commission & Publish"
            complete={completion.publish}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
                <p className={LABEL_CLS}>Total service price</p>
                <p className="text-xl font-bold text-brand">
                  {isFree ? "Free" : formatMoney(total, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
                <p className={LABEL_CLS}>Booking advance</p>
                <p className="text-xl font-bold text-white">
                  {bookingAdvanceFeeEnabled
                    ? formatMoney(bookingAdvanceFee, currency)
                    : "—"}
                </p>
              </div>
            </div>

            {/* Kept mounted so the commission plan can register its save handler */}
            <div className={cn(isFree && "hidden")}>
              <CommissionPlanSection
                itemType="service"
                itemId={mode === "edit" ? service?._id : undefined}
                itemName={title || "New Service"}
                isPaid={!isFree}
              />
            </div>

          </SectionBlock>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#262626] bg-[#141414] px-5 py-4">
          <p className="text-xs text-zinc-500">
            <span className="font-bold text-brand">
              {completedSections} of {totalSections} sections
            </span>{" "}
            completed
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl bg-[#262626] px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-[#303030] disabled:opacity-50"
            >
              Cancel
            </button>
            {(mode === "create" || service?.status === "draft") && (
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="rounded-xl border border-[#262626] px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-[#3A3A3A] hover:text-white disabled:opacity-50"
              >
                Save draft
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                handleSave(
                  mode === "edit" ? (service?.status === "active" ? "active" : "draft") : "active",
                )
              }
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-brand-foreground shadow-md transition-all hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] active:scale-95 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Publish Service"}
            </button>
            {mode === "edit" && service?.status === "draft" && (
              <button
                type="button"
                onClick={() => handleSave("active")}
                disabled={saving}
                className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-brand-foreground shadow-md transition-all hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] active:scale-95 disabled:opacity-50"
              >
                Publish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Named wrappers
// ============================================================================

export function CreateDigitalServiceModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (service: Service) => void;
}) {
  return (
    <ServiceFormModal
      isOpen={isOpen}
      mode="create"
      onClose={onClose}
      onSaved={onSuccess}
    />
  );
}

export function EditServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: (service: Service) => void;
}) {
  return (
    <ServiceFormModal
      isOpen={!!service}
      mode="edit"
      service={service}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
