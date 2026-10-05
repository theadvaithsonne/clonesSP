"use client";

/**
 * Founder-facing KYC packet: one row per document the admin asked for, an
 * upload (or a text box for things like the GST number), and a Submit button
 * that only lights up once everything required is answered.
 *
 * Used in two places and mounted at most once in each — the KYC nudge dialog
 * (`OrgKycBanner`) and the Manage Organization popover.
 *
 * The layout leads with progress ("2 of 3 provided") rather than a wall of
 * identical cards: the founder's only real question is how much is left.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteOrgKycSubmission,
  fetchOrgKyc,
  saveOrgKycText,
  submitOrgKyc,
  uploadOrgKycFile,
  type OrgKycRecord,
  type OrgKycRequirement,
  type OrgKycSubmission,
} from "@/lib/org-kyc";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif";
const MAX_MB = 15;

function statusPill(record: OrgKycRecord) {
  switch (record.status) {
    case "verified":
      return {
        label: "Verified",
        className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        icon: ShieldCheck,
      };
    case "submitted":
      return {
        label: "Under review",
        className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
        icon: Clock,
      };
    case "rejected":
      return {
        label: "Changes requested",
        className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        icon: TriangleAlert,
      };
    default:
      return {
        label: "Documents pending",
        className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        icon: Clock,
      };
  }
}

function prettySize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OrgKycSection({
  orgId,
  onStatusChange,
  className,
}: {
  orgId: string;
  /** Fires on every record change so a parent nudge can close itself. */
  onStatusChange?: (record: OrgKycRecord) => void;
  className?: string;
}) {
  const [record, setRecord] = useState<OrgKycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  // Text answers (GST number etc.) are edited locally and saved on blur /
  // explicit Save, so typing doesn't fire a request per keystroke.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const apply = useCallback(
    (next: OrgKycRecord) => {
      setRecord(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchOrgKyc(orgId)
      .then((res) => {
        if (!alive) return;
        setRecord(res);
        setDrafts(
          Object.fromEntries(
            res.submissions
              .filter((s) => s.textValue)
              .map((s) => [s.requirementKey, s.textValue as string]),
          ),
        );
        setError(null);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message || "Could not load your KYC details");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [orgId]);

  const answerFor = (key: string): OrgKycSubmission | undefined =>
    record?.submissions.find((s) => s.requirementKey === key);

  const handleFile = async (req: OrgKycRequirement, file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`${file.name} is over ${MAX_MB}MB`);
      return;
    }
    setBusyKey(req.key);
    try {
      apply(await uploadOrgKycFile(orgId, req.key, file));
      toast.success(`${req.label} uploaded`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusyKey(null);
    }
  };

  const saveText = async (req: OrgKycRequirement) => {
    const value = (drafts[req.key] || "").trim();
    const current = answerFor(req.key)?.textValue || "";
    if (!value || value === current) return;
    setBusyKey(req.key);
    try {
      apply(await saveOrgKycText(orgId, req.key, value));
      toast.success(`${req.label} saved`);
    } catch (err: any) {
      toast.error(err?.message || "Could not save");
    } finally {
      setBusyKey(null);
    }
  };

  const removeAnswer = async (submissionId: string, key: string) => {
    setBusyKey(key);
    try {
      apply(await deleteOrgKycSubmission(orgId, submissionId));
      setDrafts((d) => ({ ...d, [key]: "" }));
    } catch (err: any) {
      toast.error(err?.message || "Could not remove");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      apply(await submitOrgKyc(orgId));
      toast.success("Sent for verification");
    } catch (err: any) {
      toast.error(err?.message || "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-3 py-2", className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-xl border border-[#23232e] bg-[#15151d] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-sm text-rose-300 py-4", className)}>{error}</div>
    );
  }

  if (!record || record.requirements.length === 0) {
    return (
      <div className={cn("text-sm text-[#6a6a7a] py-4", className)}>
        Nothing to verify right now — no documents have been requested for this
        office.
      </div>
    );
  }

  const pill = statusPill(record);
  const PillIcon = pill.icon;
  const locked = record.status === "verified" || record.status === "submitted";
  const canSubmit = record.missing.length === 0 && !locked;

  // A sent-back packet where the admin flagged no individual document still
  // needs work — we just can't say which file. Treat every row as "replace
  // me" in that case, rather than showing a green, finished-looking packet
  // under a red "changes requested" banner.
  const packetRejected = record.status === "rejected";
  const anyDocRejected = record.submissions.some((s) => s.status === "rejected");
  const blanketRedo = packetRejected && !anyDocRejected;

  const answeredCount = record.requirements.filter(
    (r) => answerFor(r.key) && answerFor(r.key)?.status !== "rejected",
  ).length;
  const total = record.requirements.length;
  const progress = total ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress header — the one number that matters, plus the state badge */}
      <div className="rounded-xl border border-[#23232e] bg-[#15151d] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {answeredCount} of {total} provided
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                pill.className,
              )}
            >
              <PillIcon className="h-3 w-3" />
              {pill.label}
            </span>
          </div>
          {record.status === "submitted" && (
            <span className="text-[11px] text-[#6a6a7a]">
              We'll let you know once it's reviewed.
            </span>
          )}
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#23232e]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              record.status === "verified"
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]",
            )}
            style={{ width: `${record.status === "verified" ? 100 : progress}%` }}
          />
        </div>
      </div>

      {/* The note outlives the "rejected" status on purpose: the moment the
          founder replaces the first file the packet flips back to pending,
          and the reviewer's instructions for the remaining files must not
          vanish with it. It clears when the packet is resubmitted. */}
      {record.reviewNote && !locked && (
        <div className="flex gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-medium">Reviewer note: </span>
            {record.reviewNote}
          </span>
        </div>
      )}

      {!record.storageConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Document storage isn't configured yet. Please try again later.
        </div>
      )}

      <div className="space-y-2.5">
        {record.requirements.map((req, index) => {
          const answer = answerFor(req.key);
          const busy = busyKey === req.key;
          const rejected = answer?.status === "rejected";
          const done = Boolean(answer) && !rejected;
          /** This row is asking for a fresh file, not just offering one. */
          const needsRedo = !locked && (rejected || blanketRedo);
          const dragging = dragKey === req.key;

          return (
            <div
              key={req.key}
              onDragOver={
                req.kind === "file" && !locked
                  ? (e) => {
                      e.preventDefault();
                      setDragKey(req.key);
                    }
                  : undefined
              }
              onDragLeave={() => dragging && setDragKey(null)}
              onDrop={
                req.kind === "file" && !locked
                  ? (e) => {
                      e.preventDefault();
                      setDragKey(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(req, file);
                    }
                  : undefined
              }
              className={cn(
                "rounded-xl border p-3.5 transition-all",
                rejected
                  ? "border-rose-500/40 bg-rose-500/5"
                  : dragging
                    ? "border-brand-2 bg-brand-2/5"
                    : done
                      ? "border-[#23232e] bg-[#15151d]"
                      : "border-[#23232e] bg-[#12121a]",
              )}
            >
              <div className="flex items-start gap-3">
                {/* Step marker — ticks over as each item lands */}
                <div
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    rejected
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : done
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-[#2f2f3b] bg-[#1c1c26] text-[#7a7a8c]",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : rejected ? (
                    <TriangleAlert className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {req.label}
                        {!req.required && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-[#6a6a7a]">
                            optional
                          </span>
                        )}
                      </p>
                      {req.description && (
                        <p className="mt-0.5 text-xs text-[#6a6a7a]">
                          {req.description}
                        </p>
                      )}
                    </div>
                    {busy && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-2" />
                    )}
                  </div>

                  {rejected && (
                    <p className="mt-2 text-xs text-rose-300">
                      {answer?.reviewNote
                        ? `Rejected: ${answer.reviewNote}`
                        : "Your reviewer rejected this — send a new one."}
                    </p>
                  )}
                  {blanketRedo && !rejected && !locked && (
                    <p className="mt-2 text-xs text-rose-300/80">
                      {req.kind === "text"
                        ? "Check this value and update it if it's wrong."
                        : "Replace this if it's one your reviewer flagged."}
                    </p>
                  )}

                  {req.kind === "text" ? (
                    <div className="mt-2.5 flex gap-2">
                      <Input
                        value={drafts[req.key] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [req.key]: e.target.value }))
                        }
                        onBlur={() => !locked && saveText(req)}
                        disabled={locked || busy}
                        placeholder={`Enter ${req.label.toLowerCase()}`}
                        className="h-9 border-[#2a2a35] bg-[#0f0f16] font-mono text-sm tracking-wide text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-[#4a4a58]"
                      />
                      {!locked && (
                        <Button
                          type="button"
                          onClick={() => saveText(req)}
                          disabled={
                            busy ||
                            !(drafts[req.key] || "").trim() ||
                            (drafts[req.key] || "").trim() ===
                              (answer?.textValue || "")
                          }
                          className="h-9 shrink-0 bg-[#2a2a35] text-white hover:bg-[#3a3a45] disabled:opacity-40"
                        >
                          {done &&
                          (drafts[req.key] || "").trim() ===
                            (answer?.textValue || "") ? (
                            <>
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                              Saved
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2.5">
                      <input
                        ref={(el) => {
                          fileInputs.current[req.key] = el;
                        }}
                        type="file"
                        accept={ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) handleFile(req, file);
                        }}
                      />

                      {answer?.filename && (
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2",
                            needsRedo
                              ? "border-rose-500/30 bg-rose-500/5"
                              : "border-[#2a2a35] bg-[#0f0f16]",
                          )}
                        >
                          <a
                            href={answer.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex min-w-0 flex-1 items-center gap-2 text-xs hover:text-white",
                              needsRedo
                                ? "text-[#9a9aad] line-through decoration-rose-400/50"
                                : "text-[#c7c7da]",
                              !answer.viewUrl && "pointer-events-none opacity-60",
                            )}
                          >
                            <FileText
                              className={cn(
                                "h-4 w-4 shrink-0",
                                needsRedo ? "text-rose-400" : "text-brand-2",
                              )}
                            />
                            <span className="truncate">{answer.filename}</span>
                            {answer.size ? (
                              <span className="shrink-0 text-[#5a5a68]">
                                {prettySize(answer.size)}
                              </span>
                            ) : null}
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                          {!locked && (
                            <div className="flex shrink-0 items-center gap-1">
                              {/* The prominent re-upload lives below when this
                                  row needs redoing, so don't double it up. */}
                              {!needsRedo && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    fileInputs.current[req.key]?.click()
                                  }
                                  disabled={busy || !record.storageConfigured}
                                  className="h-7 px-2 text-xs text-[#9a9aad] hover:bg-[#1a1a22] hover:text-white"
                                >
                                  Replace
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeAnswer(answer.id, req.key)}
                                disabled={busy}
                                className="h-7 px-2 text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dropzone. Shown when nothing is uploaded yet AND when
                          the reviewer sent this one back — a rejected document
                          the founder can only "Replace" through a small ghost
                          link is the reason re-uploading felt impossible. */}
                      {(!answer?.filename || needsRedo) && (
                        <button
                          type="button"
                          onClick={() => fileInputs.current[req.key]?.click()}
                          disabled={busy || locked || !record.storageConfigured}
                          className={cn(
                            "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs transition-colors",
                            !answer?.filename && "mt-0",
                            dragging
                              ? "border-brand-2 bg-brand-2/10 text-brand-2"
                              : needsRedo
                                ? "border-rose-400/50 bg-rose-500/5 text-rose-200 hover:border-rose-400 hover:bg-rose-500/10"
                                : "border-[#2f2f3b] text-[#7a7a8c] hover:border-brand-2/50 hover:text-[#c7c7da]",
                            (busy || locked || !record.storageConfigured) &&
                              "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>
                            {needsRedo ? (
                              <>
                                Upload a replacement — drop it here or{" "}
                                <span className="underline">browse</span>
                              </>
                            ) : (
                              <>
                                Drop a file here or{" "}
                                <span className="text-brand-2">browse</span>
                              </>
                            )}
                          </span>
                          <span
                            className={cn(
                              needsRedo ? "text-rose-300/60" : "text-[#4a4a58]",
                            )}
                          >
                            · PDF or image, up to {MAX_MB}MB
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {record.status !== "verified" && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p
            className={cn(
              "text-xs",
              record.missing.length && packetRejected
                ? "text-rose-300"
                : "text-[#6a6a7a]",
            )}
          >
            {record.missing.length
              ? `${packetRejected ? "Re-upload" : "Still needed"}: ${record.missing.join(", ")}`
              : record.status === "submitted"
                ? "Everything's in. Sit tight."
                : blanketRedo
                  ? "Replace whatever your reviewer flagged, then send it back."
                  : "All set — send it for verification."}
          </p>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="h-9 bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] font-semibold text-brand-foreground hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {record.status === "submitted"
              ? "Submitted"
              : packetRejected
                ? "Resubmit for verification"
                : "Submit for verification"}
          </Button>
        </div>
      )}
    </div>
  );
}
