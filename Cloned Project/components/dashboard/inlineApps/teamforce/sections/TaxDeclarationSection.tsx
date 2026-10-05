"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Receipt,
  Lock,
  LockOpen,
  Loader2,
  Check,
  TrendingUp,
  Home,
  GraduationCap,
  Heart,
  Briefcase,
  Award,
  RefreshCw,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import {
  getTaxDeclaration,
  upsertTaxDeclaration,
  lockTaxDeclaration,
  unlockTaxDeclaration,
  getRegimePreview,
  getOrgTaxSummary,
} from "../api";
import type {
  EmployeeTaxDeclaration,
  Regime,
  RegimePreview,
  OrgTaxSummaryEntry,
} from "../types";
import InfoCard from "../lib/InfoCard";

/** Returns the current Indian financial year string (e.g. "2024-25"). */
function currentFY(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1..12
  const startYear = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

interface FormState {
  regime: Regime;
  hraDeclaration: {
    monthlyRentPaid: number;
    landlordName: string;
    landlordPan: string;
    ownsHouseInCity: boolean;
  };
  ltaClaimAmount: number;
  numChildren: number;
  declared80C: number;
  declaredNpsSelf: number;
  declared80DSelf: number;
  declared80DParent: number;
  parentSeniorCitizen: boolean;
  savingsInterest: number;
  fdInterest: number;
  declared80E: number;
  declared80EEA: number;
  declared80G: number;
  previousEmployer: {
    name: string;
    tan: string;
    grossSalary: number;
    tdsDeducted: number;
    ptPaid: number;
    pfPaid: number;
  };
}

const emptyForm: FormState = {
  regime: "NEW",
  hraDeclaration: {
    monthlyRentPaid: 0,
    landlordName: "",
    landlordPan: "",
    ownsHouseInCity: false,
  },
  ltaClaimAmount: 0,
  numChildren: 0,
  declared80C: 0,
  declaredNpsSelf: 0,
  declared80DSelf: 0,
  declared80DParent: 0,
  parentSeniorCitizen: false,
  savingsInterest: 0,
  fdInterest: 0,
  declared80E: 0,
  declared80EEA: 0,
  declared80G: 0,
  previousEmployer: {
    name: "",
    tan: "",
    grossSalary: 0,
    tdsDeducted: 0,
    ptPaid: 0,
    pfPaid: 0,
  },
};

function fromDeclaration(d: EmployeeTaxDeclaration): FormState {
  return {
    regime: d.regime || "NEW",
    hraDeclaration: {
      monthlyRentPaid: d.hraDeclaration?.monthlyRentPaid || 0,
      landlordName: d.hraDeclaration?.landlordName || "",
      landlordPan: d.hraDeclaration?.landlordPan || "",
      ownsHouseInCity: !!d.hraDeclaration?.ownsHouseInCity,
    },
    ltaClaimAmount: d.ltaClaimAmount || 0,
    numChildren: d.numChildren || 0,
    declared80C: d.declared80C || 0,
    declaredNpsSelf: d.declaredNpsSelf || 0,
    declared80DSelf: d.declared80DSelf || 0,
    declared80DParent: d.declared80DParent || 0,
    parentSeniorCitizen: !!d.parentSeniorCitizen,
    savingsInterest: d.savingsInterest || 0,
    fdInterest: d.fdInterest || 0,
    declared80E: d.declared80E || 0,
    declared80EEA: d.declared80EEA || 0,
    declared80G: d.declared80G || 0,
    previousEmployer: {
      name: d.previousEmployer?.name || "",
      tan: d.previousEmployer?.tan || "",
      grossSalary: d.previousEmployer?.grossSalary || 0,
      tdsDeducted: d.previousEmployer?.tdsDeducted || 0,
      ptPaid: d.previousEmployer?.ptPaid || 0,
      pfPaid: d.previousEmployer?.pfPaid || 0,
    },
  };
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    /* non-JSON */
  }
  return raw || fallback;
}

const INR = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function TaxDeclarationSection() {
  const { amIFounder, userData } = useAmIFounder();
  const [fy] = useState(currentFY());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [decl, setDecl] = useState<EmployeeTaxDeclaration | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preview, setPreview] = useState<RegimePreview | null>(null);

  // Org view state (admin/founder only)
  const [view, setView] = useState<"my" | "org">("my");
  const [canSeeOrgView, setCanSeeOrgView] = useState(false);
  const [orgSummary, setOrgSummary] = useState<OrgTaxSummaryEntry[] | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { declaration } = await getTaxDeclaration(fy);
      setDecl(declaration);
      if (declaration) setForm(fromDeclaration(declaration));
    } catch {
      toast.error("Failed to load tax declaration");
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => {
    load();
  }, [load]);

  // Probe org-summary immediately on mount and on org/FY change.
  // Backend hasFullAccess is the single source of truth for both founders and
  // teamforce admins, so no need to wait for useAmIFounder's /auth/me call.
  useEffect(() => {
    let cancelled = false;
    setCanSeeOrgView(false);
    getOrgTaxSummary(fy)
      .then(() => { if (!cancelled) setCanSeeOrgView(true); })
      .catch(() => { if (!cancelled) setCanSeeOrgView(false); });
    return () => { cancelled = true; };
  }, [fy, userData.orgId]);

  const loadOrgSummary = useCallback(async () => {
    setOrgLoading(true);
    try {
      const { summary } = await getOrgTaxSummary(fy);
      setOrgSummary(summary);
    } catch {
      toast.error("Failed to load organisation summary");
    } finally {
      setOrgLoading(false);
    }
  }, [fy]);

  // Fetch org summary / my declaration whenever the active tab changes.
  // Skip on initial mount (load() already runs via its own effect above).
  const tabSwitchRef = useRef(false);
  useEffect(() => {
    if (!tabSwitchRef.current) {
      tabSwitchRef.current = true;
      return;
    }
    if (view === "org") loadOrgSummary();
    else load();
  }, [view, loadOrgSummary, load]);

  const onUnlockForEmployee = async (empUserId: string, empName: string) => {
    if (!confirm(`Unlock ${empName}'s tax declaration for FY ${fy}? They will be able to edit and re-submit.`)) return;
    setUnlockingUserId(empUserId);
    try {
      await unlockTaxDeclaration(fy, empUserId);
      // Optimistic update — instantly reflect locked: false in the table
      setOrgSummary((prev) =>
        prev
          ? prev.map((e) => (e.userId === empUserId ? { ...e, locked: false } : e))
          : prev
      );
      toast.success(`${empName}'s declaration unlocked`);
      // Background refresh — non-blocking so spinner clears immediately
      loadOrgSummary();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to unlock"));
    } finally {
      setUnlockingUserId(null);
    }
  };

  const locked = !!decl?.locked;
  const ro = locked;

  const onSave = async () => {
    setSaving(true);
    try {
      const { declaration } = await upsertTaxDeclaration({ fy, ...form });
      setDecl(declaration);
      toast.success("Saved");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const onLock = async () => {
    if (
      !confirm(
        "Lock declaration for this FY? You will not be able to edit it after locking."
      )
    )
      return;
    setLocking(true);
    try {
      // Save current edits first so the locked snapshot has them.
      const { declaration: saved } = await upsertTaxDeclaration({ fy, ...form });
      const { declaration } = await lockTaxDeclaration(fy);
      setDecl(declaration || saved);
      toast.success("Declaration locked for FY " + fy);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to lock"));
    } finally {
      setLocking(false);
    }
  };

  const onUnlock = async () => {
    if (
      !confirm(
        `Master unlock declaration for FY ${fy}? This is a founder-only override. Any active payroll runs that referenced this declaration will keep their original numbers; future runs will pick up the edits.`
      )
    )
      return;
    setUnlocking(true);
    try {
      const { declaration } = await unlockTaxDeclaration(fy);
      setDecl(declaration);
      toast.success("Declaration unlocked");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to unlock"));
    } finally {
      setUnlocking(false);
    }
  };

  const onPreview = async () => {
    setPreviewing(true);
    try {
      // Save current edits first so the preview reflects what the user typed.
      await upsertTaxDeclaration({ fy, ...form });
      const r = await getRegimePreview(fy);
      setPreview(r);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to compute comparison"));
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] space-y-5 max-w-4xl">
      {/* View toggle — admin/founder only */}
      {canSeeOrgView && (
        <div className="flex items-center gap-1 p-1 rounded-xl border border-white/8 bg-[#0a0a0a] self-start w-fit">
          {(["my", "org"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`h-8 px-4 rounded-lg text-[12px] font-medium transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                view === v
                  ? "bg-brand text-brand-foreground"
                  : "text-[#7a7a7a] hover:text-white"
              }`}
            >
              {v === "my" ? (
                <><User className="h-3.5 w-3.5" />My Declaration</>
              ) : (
                <><Building2 className="h-3.5 w-3.5" />Organisation</>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Organisation view (admin/founder only) ── */}
      {view === "org" && canSeeOrgView && (
        <OrgSummaryView
          fy={fy}
          summary={orgSummary}
          loading={orgLoading}
          unlockingUserId={unlockingUserId}
          onUnlock={onUnlockForEmployee}
          onRefresh={loadOrgSummary}
        />
      )}

      {/* ── My Declaration view ── */}
      {view === "my" && (
        <>
      {/* Header card */}
      <div className="rounded-xl border border-white/8 bg-[#0e0e0e] px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Tax Declaration · FY {fy}
            </h1>
            <p className="text-[12px] text-[#7a7a7a] mt-1">
              Choose your regime, declare your investments, and compare Old vs
              New.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-medium ${
                locked
                  ? "bg-amber-500/[0.04] border-amber-500/20 text-amber-300"
                  : "bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-300"
              }`}
            >
              {locked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <LockOpen className="h-3 w-3" />
              )}
              {locked ? "Locked" : "Editable"}
            </div>
            {locked && amIFounder && (
              <button
                onClick={onUnlock}
                disabled={unlocking}
                className="h-7 px-2.5 rounded-md border border-amber-500/30 bg-amber-500/[0.04] text-amber-300 text-[11px] font-medium hover:bg-amber-500/[0.08] transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                title="Founder-only master unlock"
              >
                {unlocking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <LockOpen className="h-3 w-3" />
                )}
                Master unlock
              </button>
            )}
          </div>
        </div>
      </div>

      {/* A7: top-of-page intent card */}
      <InfoCard variant="info" title="What this is">
        Your declaration tells HR how much tax to withhold each month. Pick a
        regime, declare investments, then <b>Compare regimes</b> to see which
        is cheaper for your situation. Lock for FY only when you&rsquo;re
        sure — HR can unlock if needed.
      </InfoCard>

      {/* Regime selector */}
      <FormCard
        icon={Award}
        title="Tax Regime"
        subtitle={`Pick the regime you want for FY ${fy}. Click 'Compare regimes' below to see which is cheaper for you.`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["OLD", "NEW"] as Regime[]).map((r) => {
            const checked = form.regime === r;
            return (
              <button
                key={r}
                type="button"
                disabled={ro}
                onClick={() => setForm((f) => ({ ...f, regime: r }))}
                className={`relative text-left p-4 rounded-xl border transition-all ${
                  ro ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                } ${
                  checked
                    ? "border-brand/30 bg-brand/[0.04]"
                    : "border-white/8 bg-[#050505] hover:border-white/12"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[13px] font-semibold ${
                      checked ? "text-white" : "text-[#d4d4d4]"
                    }`}
                  >
                    {r === "OLD" ? "Old Regime" : "New Regime (default)"}
                  </span>
                  {checked && (
                    <div className="h-[18px] w-[18px] rounded-full bg-brand/12 ring-1 ring-brand/45 flex items-center justify-center">
                      <Check
                        className="h-2.5 w-2.5 text-brand"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </div>
                <ul className="text-[11px] text-[#a8a8a8] space-y-1 leading-relaxed">
                  {r === "OLD" ? (
                    <>
                      <li>HRA, LTA, 80C, 80D exemptions available</li>
                      <li>Std deduction ₹50,000</li>
                      <li>Better if you have significant investments</li>
                    </>
                  ) : (
                    <>
                      <li>Lower slab rates, fewer exemptions</li>
                      <li>Std deduction ₹75,000</li>
                      <li>Zero tax up to ₹7L (effective)</li>
                    </>
                  )}
                </ul>
              </button>
            );
          })}
        </div>
      </FormCard>

      {/* HRA — only meaningful in Old Regime, but stored anyway */}
      <FormCard
        icon={Home}
        title="House Rent Allowance (HRA)"
        subtitle={
          form.regime === "OLD"
            ? "Required for HRA exemption under Sec 10(13A)"
            : "Stored but not used in New Regime"
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Monthly Rent Paid (₹)">
            <NumberInput
              value={form.hraDeclaration.monthlyRentPaid}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  hraDeclaration: { ...f.hraDeclaration, monthlyRentPaid: v },
                }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="Landlord Name">
            <TextInput
              value={form.hraDeclaration.landlordName}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  hraDeclaration: { ...f.hraDeclaration, landlordName: v },
                }))
              }
              disabled={ro}
              placeholder="As per agreement"
            />
          </Field>
          <Field label="Landlord PAN (required if rent > ₹8,333/m)">
            <TextInput
              value={form.hraDeclaration.landlordPan}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  hraDeclaration: {
                    ...f.hraDeclaration,
                    landlordPan: v.toUpperCase(),
                  },
                }))
              }
              disabled={ro}
              placeholder="ABCDE1234F"
              uppercase
              maxLength={10}
            />
          </Field>
          <Field label="Own house in same city?">
            <CheckboxRow
              checked={form.hraDeclaration.ownsHouseInCity}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  hraDeclaration: { ...f.hraDeclaration, ownsHouseInCity: v },
                }))
              }
              disabled={ro}
              label="Yes — I own a house in this city"
            />
          </Field>
        </div>
      </FormCard>

      {/* Children + LTA (Old Regime only) */}
      <FormCard
        icon={GraduationCap}
        title="Travel & Children Allowances"
        subtitle="Old Regime only — Sec 10(5) and Sec 10(14)"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="LTA Claim Amount (₹/FY)">
            <NumberInput
              value={form.ltaClaimAmount}
              onChange={(v) => setForm((f) => ({ ...f, ltaClaimAmount: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="Number of children (max 2 eligible)">
            <NumberInput
              value={form.numChildren}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  numChildren: Math.max(0, Math.min(10, Math.floor(v))),
                }))
              }
              disabled={ro}
            />
          </Field>
        </div>
      </FormCard>

      {/* Chapter VI-A — Old Regime mostly */}
      <FormCard
        icon={Heart}
        title="Chapter VI-A Deductions"
        subtitle="Mostly Old Regime; 80CCD(2) flows in both"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="80C — Investments (₹/FY, max ₹1.5L incl. PF)">
            <NumberInput
              value={form.declared80C}
              onChange={(v) => setForm((f) => ({ ...f, declared80C: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="80CCD(1B) — NPS self (max ₹50k extra)">
            <NumberInput
              value={form.declaredNpsSelf}
              onChange={(v) => setForm((f) => ({ ...f, declaredNpsSelf: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="80D — Self/Family medical premium">
            <NumberInput
              value={form.declared80DSelf}
              onChange={(v) => setForm((f) => ({ ...f, declared80DSelf: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="80D — Parent medical premium">
            <NumberInput
              value={form.declared80DParent}
              onChange={(v) =>
                setForm((f) => ({ ...f, declared80DParent: v }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="Parent senior citizen? (raises 80D cap to ₹50k)">
            <CheckboxRow
              checked={form.parentSeniorCitizen}
              onChange={(v) =>
                setForm((f) => ({ ...f, parentSeniorCitizen: v }))
              }
              disabled={ro}
              label="Yes"
            />
          </Field>
          <Field label="80TTA — Savings interest (max ₹10k, age <60)">
            <NumberInput
              value={form.savingsInterest}
              onChange={(v) =>
                setForm((f) => ({ ...f, savingsInterest: v }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="80E — Education loan interest (no cap)">
            <NumberInput
              value={form.declared80E}
              onChange={(v) => setForm((f) => ({ ...f, declared80E: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="80EEA — First home loan interest (max ₹1.5L)">
            <NumberInput
              value={form.declared80EEA}
              onChange={(v) => setForm((f) => ({ ...f, declared80EEA: v }))}
              disabled={ro}
            />
          </Field>
          <Field label="80G — Donations">
            <NumberInput
              value={form.declared80G}
              onChange={(v) => setForm((f) => ({ ...f, declared80G: v }))}
              disabled={ro}
            />
          </Field>
        </div>
      </FormCard>

      {/* Form 12B */}
      <FormCard
        icon={Briefcase}
        title="Previous Employer (Form 12B)"
        subtitle="Only if you joined mid-FY — counts toward annual TDS computation"
      >
        {/* B5: Form 12B explainer */}
        <div className="mb-4">
          <InfoCard variant="info">
            Fill this <b>only if you joined mid-FY</b> and have a Form 16 /
            16A from your previous employer. Their gross + TDS counts toward
            your annual liability so this employer deducts only the balance.
          </InfoCard>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Previous Employer Name">
            <TextInput
              value={form.previousEmployer.name}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: { ...f.previousEmployer, name: v },
                }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="Their TAN">
            <TextInput
              value={form.previousEmployer.tan}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: {
                    ...f.previousEmployer,
                    tan: v.toUpperCase(),
                  },
                }))
              }
              disabled={ro}
              uppercase
              maxLength={10}
            />
          </Field>
          <Field label="Gross Salary Paid (₹)">
            <NumberInput
              value={form.previousEmployer.grossSalary}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: { ...f.previousEmployer, grossSalary: v },
                }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="TDS Already Deducted (₹)">
            <NumberInput
              value={form.previousEmployer.tdsDeducted}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: { ...f.previousEmployer, tdsDeducted: v },
                }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="PT Already Paid (₹)">
            <NumberInput
              value={form.previousEmployer.ptPaid}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: { ...f.previousEmployer, ptPaid: v },
                }))
              }
              disabled={ro}
            />
          </Field>
          <Field label="PF Already Paid (₹)">
            <NumberInput
              value={form.previousEmployer.pfPaid}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  previousEmployer: { ...f.previousEmployer, pfPaid: v },
                }))
              }
              disabled={ro}
            />
          </Field>
        </div>
      </FormCard>

      {/* Side-by-side comparison */}
      {preview && (
        <FormCard
          icon={TrendingUp}
          title={`Regime Comparison · ${preview.recommended} recommended`}
          subtitle={
            preview.recommended === preview.currentRegime
              ? `You're already on the cheaper regime — saving ₹${INR(preview.saving)} vs the other.`
              : `Switching to ${preview.recommended} would save you ₹${INR(preview.saving)}/year.`
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RegimePreviewCard label="Old Regime" data={preview.old} regime="OLD" recommended={preview.recommended} />
            <RegimePreviewCard label="New Regime" data={preview.new} regime="NEW" recommended={preview.recommended} />
          </div>
          <p className="mt-3 text-[10.5px] text-[#7a7a7a] leading-relaxed">
            Comparison uses your current salary structure × 12 as projected
            annual gross. Numbers are estimates; final TDS is computed monthly
            during payroll runs.
          </p>
        </FormCard>
      )}

      {/* A8: Lock for FY warning (only when not yet locked) */}
      {!locked && (
        <InfoCard variant="warning" title="Locking is final for the FY">
          Once locked, you can&rsquo;t edit any field. Your locked numbers
          drive every payroll run for FY {fy}. Only an HR admin can unlock.
        </InfoCard>
      )}

      {/* Action footer */}
      <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e] to-transparent">
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onPreview}
            disabled={previewing || saving || locking}
            className="h-10 px-4 rounded-lg border border-white/10 text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Compare regimes
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={ro || saving || locking}
              className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[13px] font-semibold hover:bg-brand/90 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              type="button"
              onClick={onLock}
              disabled={ro || saving || locking}
              className="h-10 px-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] text-amber-300 text-[13px] font-medium hover:bg-amber-500/[0.08] transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {locking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Lock for FY
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/* ─── Organisation summary view ────────────────────────────────────────── */

function OrgSummaryView({
  fy,
  summary,
  loading,
  unlockingUserId,
  onUnlock,
  onRefresh,
}: {
  fy: string;
  summary: OrgTaxSummaryEntry[] | null;
  loading: boolean;
  unlockingUserId: string | null;
  onUnlock: (userId: string, name: string) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!summary) return [];
    const q = search.toLowerCase().trim();
    if (!q) return summary;
    return summary.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    );
  }, [summary, search]);

  const { page, totalPages, pageItems, transitioning, goNext, goPrev, total, start, end } =
    usePagination(filtered);

  return (
    <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/5 ring-1 ring-white/8 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-[#a8a8a8]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white tracking-tight">
              Organisation · FY {fy}
            </h3>
            <p className="text-[11px] text-[#7a7a7a] mt-0.5">
              Employee tax declaration status
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 px-2.5 rounded-md border border-white/10 text-[11px] text-[#7a7a7a] hover:text-white hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-white/5">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-lg border border-white/8 bg-[#050505] px-3 text-[12px] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors"
        />
      </div>

      {loading && !summary && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 text-brand animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-12 text-center text-[13px] text-[#5a5a5a]">
          {summary === null
            ? "Loading…"
            : search
            ? "No employees match your search."
            : "No employees found in this organisation."}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="overflow-x-auto">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px] min-w-[420px] gap-3 px-5 py-2.5 border-b border-white/5">
            <span className="text-[10.5px] font-medium text-[#5a5a5a] uppercase tracking-wider">Employee</span>
            <span className="text-[10.5px] font-medium text-[#5a5a5a] uppercase tracking-wider text-center">Declaration</span>
            <span className="text-[10.5px] font-medium text-[#5a5a5a] uppercase tracking-wider text-center">Regime</span>
            <span className="text-[10.5px] font-medium text-[#5a5a5a] uppercase tracking-wider text-center">Action</span>
          </div>

          {/* Table rows */}
          <div
            className={`divide-y divide-white/[0.04] transition-opacity duration-200 ${
              transitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {pageItems.map((emp) => (
              <div
                key={emp.userId}
                className="grid grid-cols-[1fr_120px_120px_100px] min-w-[420px] gap-3 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors"
              >
                {/* Name + email */}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{emp.name}</p>
                  <p className="text-[11px] text-[#5a5a5a] truncate">{emp.email}</p>
                </div>

                {/* Declaration status badge — three states: Locked / Filled / Pending */}
                <div className="flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-semibold ${
                      emp.filled && emp.locked
                        ? "bg-amber-500/[0.08] text-amber-400 ring-1 ring-amber-500/20"
                        : emp.filled
                        ? "bg-emerald-500/[0.08] text-emerald-400 ring-1 ring-emerald-500/20"
                        : "bg-[#1a1a1a] text-[#5a5a5a] ring-1 ring-white/8"
                    }`}
                  >
                    {emp.filled && emp.locked ? (
                      <><Lock className="h-3 w-3" />Locked</>
                    ) : emp.filled ? (
                      "Filled"
                    ) : (
                      "Pending"
                    )}
                  </span>
                </div>

                {/* Regime */}
                <div className="flex justify-center">
                  {emp.regime ? (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-semibold bg-brand/[0.06] text-brand ring-1 ring-brand/20">
                      {emp.regime}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#3a3a3a]">—</span>
                  )}
                </div>

                {/* Unlock button */}
                <div className="flex justify-center">
                  {emp.filled && emp.locked ? (
                    <button
                      type="button"
                      onClick={() => onUnlock(emp.userId, emp.name)}
                      disabled={unlockingUserId === emp.userId}
                      className="h-7 px-2.5 rounded-md border border-amber-500/30 bg-amber-500/[0.04] text-amber-300 text-[11px] font-medium hover:bg-amber-500/[0.08] transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {unlockingUserId === emp.userId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LockOpen className="h-3 w-3" />
                      )}
                      Unlock
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#3a3a3a]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>{/* /overflow-x-auto */}

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            start={start}
            end={end}
            loading={loading}
            onPrev={goPrev}
            onNext={goNext}
          />
        </>
      )}
    </div>
  );
}

/* ─── Pagination utilities (matches AttendanceSection pattern) ──────────── */

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
      }, 200);
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
    <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
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

/* ─── shared UI primitives (kept local; matches PayrollSection visuals) ── */

function FormCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Receipt;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <div className="h-9 w-9 rounded-lg bg-white/5 ring-1 ring-white/8 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-[#a8a8a8]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-white tracking-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-[#7a7a7a] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#a8a8a8] uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-lg border border-white/8 bg-[#050505] px-3.5 text-[12px] text-white placeholder:text-[#5a5a5a] outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-colors disabled:opacity-50";

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  uppercase,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  uppercase?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      className={`${inputCls} ${uppercase ? "uppercase tracking-wider" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
    />
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5a5a5a] font-medium pointer-events-none">
        ₹
      </span>
      <input
        type="text"
        inputMode="decimal"
        className={`${inputCls} pl-7 tabular-nums`}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.]/g, "");
          setText(cleaned);
          const n = cleaned === "" ? 0 : Number(cleaned);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex items-center gap-2.5 h-11 px-3.5 rounded-lg border transition-all w-full text-left ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${
        checked
          ? "border-brand/30 bg-brand/[0.04]"
          : "border-white/8 bg-[#050505] hover:border-white/12"
      }`}
    >
      <div
        className={`h-[18px] w-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? "bg-brand/12 border-brand/45"
            : "bg-[#050505] border-white/15"
        }`}
      >
        {checked && (
          <Check className="h-3 w-3 text-brand" strokeWidth={3} />
        )}
      </div>
      <span className="text-[12px] text-white/80">{label}</span>
    </button>
  );
}

function RegimePreviewCard({
  label,
  data,
  regime,
  recommended,
}: {
  label: string;
  data: RegimePreview["old"];
  regime: Regime;
  recommended: Regime;
}) {
  const isWinner = regime === recommended;
  return (
    <div
      className={`rounded-xl border p-4 ${
        isWinner
          ? "border-brand/40 bg-brand/[0.05]"
          : "border-white/8 bg-[#050505]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[12px] font-semibold ${
            isWinner ? "text-brand" : "text-white/80"
          }`}
        >
          {label}
        </span>
        {isWinner && (
          <span className="text-[10px] font-semibold text-brand bg-brand/10 ring-1 ring-brand/30 px-2 py-0.5 rounded-md">
            CHEAPER
          </span>
        )}
      </div>
      <div className="text-[20px] font-bold text-white tabular-nums mb-1">
        ₹{INR(data.annualTaxLiability)}
      </div>
      <div className="text-[11px] text-[#7a7a7a] mb-3">
        annual tax · ₹{INR(data.monthlyTDS)}/month TDS
      </div>
      <div className="space-y-1 text-[10.5px] text-[#a8a8a8] tabular-nums">
        <Row label="Gross (projected)" value={data.projectedAnnualGross} />
        <Row label="Exemptions" value={-data.totalExemptions} />
        <Row label="Std deduction" value={-data.standardDeduction} />
        <Row label="Chapter VI-A" value={-data.chapterVIATotal} />
        <Row label="PT (annual)" value={-data.projectedAnnualPT} />
        <div className="border-t border-white/5 my-1" />
        <Row label="Net taxable" value={data.netTaxableIncome} bold />
        <Row label="Tax + cess + surcharge" value={data.annualTaxLiability} bold />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  const negative = value < 0;
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={bold ? "text-white font-semibold" : ""}>
        {negative ? "−" : ""}₹{INR(Math.abs(value))}
      </span>
    </div>
  );
}
