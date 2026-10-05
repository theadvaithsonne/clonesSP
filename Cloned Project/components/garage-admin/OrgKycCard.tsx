"use client";

/**
 * One office's KYC packet, as rendered on the Office KYC console page
 * (/garage-admin/kyc) once an office is selected.
 *
 * Two halves:
 *   - Requirements — tick the built-ins (PAN card, address proof, government
 *     ID, GST number) and add any custom field. Saving sends the request to
 *     the founder, who sees a "KYC pending" nudge in the app.
 *   - Submitted documents — open each one through a short-lived presigned URL
 *     (they live in a private bucket, so there is no permanent link), approve
 *     or reject individually, then verify or send the whole packet back.
 */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminOrgKycApi } from "@/lib/admin-api/org-kyc";
import {
  ORG_KYC_STATUS_LABEL,
  type OrgKycRecord,
  type OrgKycRequirement,
  type OrgKycStatus,
} from "@/lib/org-kyc";

const STATUS_CLASS: Record<OrgKycStatus, string> = {
  not_requested: "border-white/[0.12] bg-white/[0.04] text-zinc-400",
  pending: "border-brand/30 bg-brand/15 text-brand",
  submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  verified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function OrgKycCard({
  orgId,
  onChanged,
}: {
  orgId: string;
  /** Fired after any write, so a parent list can refresh its status column. */
  onChanged?: () => void;
}) {
  const [record, setRecord] = useState<OrgKycRecord | null>(null);
  const [defaults, setDefaults] = useState<OrgKycRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  /** Working copy of the requirement list — only written on Save. */
  const [draft, setDraft] = useState<OrgKycRequirement[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customKind, setCustomKind] = useState<"file" | "text">("file");
  const [rejectNote, setRejectNote] = useState("");
  /** Which single document is mid-rejection, and the reason being typed for
   *  it. Per-document reasons ride along in the rejection email, so this is
   *  the difference between "fix your KYC" and "your PAN scan is cropped". */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [docNote, setDocNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, defs] = await Promise.all([
        adminOrgKycApi.get(orgId),
        adminOrgKycApi.defaults(),
      ]);
      setRecord(rec);
      setDefaults(defs);
      setDraft(rec.requirements);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load KYC");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const isPicked = (key: string) => draft.some((r) => r.key === key);

  const toggleDefault = (req: OrgKycRequirement) => {
    setDraft((prev) =>
      prev.some((r) => r.key === req.key)
        ? prev.filter((r) => r.key !== req.key)
        : [...prev, { ...req, required: true, custom: false }],
    );
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const key =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || `custom_${draft.length + 1}`;
    if (draft.some((r) => r.key === key)) {
      toast.error("That field is already on the list");
      return;
    }
    setDraft((prev) => [
      ...prev,
      { key, label, kind: customKind, required: true, custom: true },
    ]);
    setCustomLabel("");
  };

  const saveRequirements = async () => {
    if (!draft.length) {
      toast.error("Pick at least one document");
      return;
    }
    setSaving(true);
    try {
      const next = await adminOrgKycApi.setRequirements(orgId, draft);
      setRecord(next);
      setDraft(next.requirements);
      onChanged?.();
      toast.success("KYC requested from the founder");
    } catch (err: any) {
      toast.error(err?.message || "Could not save requirements");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (
    submissionId: string,
    status: "approved" | "rejected",
    note?: string,
  ) => {
    setActing(submissionId);
    try {
      setRecord(
        await adminOrgKycApi.decideSubmission(orgId, submissionId, status, note),
      );
      onChanged?.();
      if (status === "rejected") {
        setRejectingId(null);
        setDocNote("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not update that document");
    } finally {
      setActing(null);
    }
  };

  const verify = async () => {
    setActing("verify");
    try {
      setRecord(await adminOrgKycApi.verify(orgId));
      onChanged?.();
      toast.success("Office verified");
    } catch (err: any) {
      toast.error(err?.message || "Could not verify");
    } finally {
      setActing(null);
    }
  };

  const reject = async () => {
    if (!rejectNote.trim()) {
      toast.error("Tell the founder what needs fixing");
      return;
    }
    setActing("reject");
    try {
      setRecord(await adminOrgKycApi.reject(orgId, rejectNote.trim()));
      setRejectNote("");
      onChanged?.();
      toast.success("Sent back to the founder");
    } catch (err: any) {
      toast.error(err?.message || "Could not reject");
    } finally {
      setActing(null);
    }
  };

  const labelFor = (key: string) =>
    record?.requirements.find((r) => r.key === key)?.label || key;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand" />
          <h3 className="text-sm font-semibold text-white">
            KYC &amp; Verification
          </h3>
          {record && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[record.status]}`}
            >
              {ORG_KYC_STATUS_LABEL[record.status]}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-zinc-400">
          Choose what this office has to produce, then review what comes back.
          Documents are held in a private bucket and opened through links that
          expire in minutes.
        </p>
      </div>

      <div className="space-y-6 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {record && !record.storageConfigured && (
              <div className="rounded-xl border border-brand/25 bg-brand/[0.06] p-3 text-[13px] text-brand">
                AWS_S3_KYC_BUCKET isn't set on the API — founders can't upload
                until it is.
              </div>
            )}

            {/* ── Requirements ─────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">
                Requested documents
              </h4>

              <div className="grid gap-2 sm:grid-cols-2">
                {defaults.map((req) => (
                  <label
                    key={req.key}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 cursor-pointer transition-colors hover:bg-white/[0.06]"
                  >
                    <Checkbox
                      checked={isPicked(req.key)}
                      onCheckedChange={() => toggleDefault(req)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-white">
                        {req.label}
                        {req.kind === "text" && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">
                            typed value
                          </span>
                        )}
                      </span>
                      {req.description && (
                        <span className="block text-xs text-zinc-500 mt-0.5">
                          {req.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              {/* Custom fields already on the draft list */}
              {draft.filter((r) => r.custom).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft
                    .filter((r) => r.custom)
                    .map((req) => (
                      <span
                        key={req.key}
                        className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-200"
                      >
                        {req.label}
                        <span className="text-[10px] uppercase text-zinc-500">
                          {req.kind === "text" ? "typed" : "file"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) =>
                              prev.filter((r) => r.key !== req.key),
                            )
                          }
                          className="text-zinc-500 hover:text-rose-400"
                          aria-label={`Remove ${req.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder="Add a custom field (e.g. Incorporation certificate)"
                  className="h-9 max-w-md rounded-full border-white/[0.08] bg-[#0f0f0f] text-zinc-200 placeholder:text-zinc-500"
                />
                <select
                  value={customKind}
                  onChange={(e) =>
                    setCustomKind(e.target.value === "text" ? "text" : "file")
                  }
                  className="h-9 rounded-full border border-white/[0.08] bg-[#0f0f0f] px-3 text-sm text-zinc-200"
                >
                  <option value="file">File upload</option>
                  <option value="text">Typed value</option>
                </select>
                <Button
                  type="button"
                  onClick={addCustom}
                  variant="outline"
                  className="h-9 rounded-full border-white/[0.1] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveRequirements}
                  disabled={saving}
                  className="h-9 rounded-full bg-brand px-4 font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {record?.requirements.length
                    ? "Update request"
                    : "Send KYC request"}
                </Button>
                <p className="text-xs text-zinc-500">
                  Removing a document also deletes whatever was uploaded for it.
                </p>
              </div>
            </div>

            {/* ── Submissions ──────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">
                Submitted by the founder
              </h4>

              {!record?.submissions.length ? (
                <p className="text-sm text-zinc-500">
                  Nothing submitted yet.
                  {record?.missing?.length
                    ? ` Waiting on: ${record.missing.join(", ")}.`
                    : ""}
                </p>
              ) : (
                <div className="space-y-2">
                  {record.submissions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white flex items-center gap-2">
                            {labelFor(s.requirementKey)}
                            {s.status === "approved" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            {s.status === "rejected" && (
                              <TriangleAlert className="h-3.5 w-3.5 text-rose-400" />
                            )}
                          </p>
                          {s.textValue ? (
                            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                              {s.textValue}
                            </p>
                          ) : s.viewUrl ? (
                            /* Presigned, ~10 min — reload the page for a fresh one */
                            <a
                              href={s.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {s.filename || "Open document"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {s.filename || "File"} — link unavailable
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acting === s.id || s.status === "approved"}
                            onClick={() => decide(s.id, "approved")}
                            className="h-8 rounded-full border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/15"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acting === s.id}
                            onClick={() => {
                              setRejectingId(
                                rejectingId === s.id ? null : s.id,
                              );
                              setDocNote(s.reviewNote || "");
                            }}
                            className="h-8 rounded-full border-rose-500/30 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/15"
                          >
                            {s.status === "rejected" ? "Edit reason" : "Reject"}
                          </Button>
                        </div>
                      </div>

                      {/* Already-rejected rows keep their reason on show, so
                          the admin can see what the founder was told. */}
                      {s.status === "rejected" &&
                        s.reviewNote &&
                        rejectingId !== s.id && (
                          <p className="mt-2 text-xs text-rose-300">
                            Reason sent: {s.reviewNote}
                          </p>
                        )}

                      {rejectingId === s.id && (
                        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                          <Textarea
                            value={docNote}
                            onChange={(e) => setDocNote(e.target.value)}
                            rows={2}
                            autoFocus
                            placeholder={`What's wrong with the ${labelFor(
                              s.requirementKey,
                            ).toLowerCase()}? The founder sees this.`}
                            className="rounded-xl border-white/[0.08] bg-[#0f0f0f] text-zinc-200 placeholder:text-zinc-500"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={acting === s.id || !docNote.trim()}
                              onClick={() =>
                                decide(s.id, "rejected", docNote.trim())
                              }
                              className="h-8 rounded-full bg-rose-500/90 text-white hover:bg-rose-500"
                            >
                              {acting === s.id && (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              )}
                              Reject this document
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingId(null);
                                setDocNote("");
                              }}
                              className="h-8 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                            >
                              Cancel
                            </Button>
                            <p className="text-xs text-zinc-500">
                              Sent to the founder when you Send back below.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Verdict ──────────────────────────────────────────────── */}
            {record && record.requirements.length > 0 && (
              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                {record.missing.length > 0 && (
                  <p className="text-xs text-amber-300">
                    Can't verify yet — still missing:{" "}
                    {record.missing.join(", ")}.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={verify}
                    disabled={
                      acting === "verify" ||
                      record.missing.length > 0 ||
                      record.status === "verified"
                    }
                    className="h-9 rounded-full bg-brand px-4 font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
                  >
                    {acting === "verify" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {record.status === "verified"
                      ? "Office verified"
                      : "Verify office"}
                  </Button>
                  <p className="text-xs text-zinc-500">
                    Emails every founder of this office.
                  </p>
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  <Textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Reason to send it back (the founder sees this)"
                    rows={2}
                    className="max-w-md rounded-xl border-white/[0.08] bg-[#0f0f0f] text-zinc-200 placeholder:text-zinc-500"
                  />
                  <Button
                    onClick={reject}
                    disabled={acting === "reject"}
                    variant="outline"
                    className="h-9 rounded-full border-rose-500/30 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/15"
                  >
                    {acting === "reject" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Send back
                  </Button>
                  <p className="w-full text-xs text-zinc-500">
                    Emails the founder with this reason plus every per-document
                    reason you set above.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
