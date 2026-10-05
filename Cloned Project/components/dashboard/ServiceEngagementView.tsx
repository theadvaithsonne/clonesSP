"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Download,
  Eye,
  FileText,
  ExternalLink,
  Hourglass,
  Loader2,
  Upload,
  Lock,
  MessageCircle,
  Send,
  Shield,
  X,
} from "lucide-react";
import { formatFileSize } from "./ServiceMediaCarousel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getServiceMilestoneMessages,
  postServiceMilestoneMessage,
  getTeamMembers,
  type Service,
  type ServiceOpt,
  type MilestoneProgress,
  addMilestoneAttachments,
  removeMilestoneAttachment,
  type ServiceMilestoneMessage,
  type ServiceMilestoneAttachment,
  type TeamMember,
} from "@/lib/feed-api";
import { getToken } from "@/lib/auth";
import { EngagementActivityPanel } from "./service-taskroom/EngagementActivityPanel";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

const MAX_CLIENT_FILES = 10;
const MAX_CLIENT_FILE_MB = 25;

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("garage_org_id");
}

type MilestoneState =
  | "approved"
  | "awaiting_payment"
  | "review_pending"
  | "in_progress"
  | "up_next"
  | "locked";

const STATE_META: Record<
  MilestoneState,
  { label: string; pill: string; bar: string }
> = {
  approved: {
    label: "Approved",
    pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    bar: "bg-emerald-500",
  },
  review_pending: {
    label: "Review pending",
    pill: "bg-brand/10 text-brand border-brand/20",
    bar: "bg-brand",
  },
  awaiting_payment: {
    label: "Needs payment",
    pill: "bg-brand/10 text-brand border-brand/20",
    bar: "bg-brand",
  },
  in_progress: {
    label: "In progress",
    pill: "bg-brand/10 text-brand border-brand/20",
    bar: "bg-brand",
  },
  up_next: {
    label: "Up next",
    pill: "bg-brand/5 text-brand border-brand/20",
    bar: "bg-[#2a2a35]",
  },
  locked: {
    label: "Locked",
    pill: "bg-[#1F1F1F] text-[#9fa0b8] border-[#2a2a35]",
    bar: "bg-[#2a2a35]",
  },
};

/**
 * Derive the client-facing state of one milestone from the progress record.
 * Payment semantics are read-only here — nothing in this view changes how
 * milestone payments are computed on the backend.
 *
 * A milestone is only "locked" when its predecessor is still open. The next
 * milestone in line is "up next": the founder can start it, and whether money
 * is due before or after that work is decided by its payment timing.
 */
function milestoneState(
  progress: MilestoneProgress,
  index: number,
  list: MilestoneProgress[],
): MilestoneState {
  const awaitingPayment =
    progress.paymentRequired && progress.paymentStatus === "pending";

  if (progress.status === "completed") {
    return awaitingPayment ? "review_pending" : "approved";
  }
  if (awaitingPayment) return "awaiting_payment";
  if (progress.status === "in_progress") return "in_progress";

  const previous = index > 0 ? list[index - 1] : null;
  if (!previous || previous.status === "completed") return "up_next";
  return "locked";
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ServiceEngagementView({
  optIn,
  service,
  formatCurrency,
  onPayMilestone,
  payingMilestoneId,
  isFounder = false,
}: {
  optIn: ServiceOpt;
  service: Service | null;
  formatCurrency: (value: number, currency?: string) => string;
  onPayMilestone: (milestoneId: string) => void;
  payingMilestoneId: string | null;
  /** Founders get the retry control and the "Go to Taskroom" jump. */
  isFounder?: boolean;
}) {
  const progressList = useMemo(
    () => [...(optIn.milestonesProgress || [])].sort((a, b) => a.order - b.order),
    [optIn.milestonesProgress],
  );

  const stateById = useMemo(() => {
    const map = new Map<string, MilestoneState>();
    progressList.forEach((m, i) => map.set(m.milestoneId, milestoneState(m, i, progressList)));
    return map;
  }, [progressList]);

  const stateOf = useCallback(
    (m: MilestoneProgress): MilestoneState => stateById.get(m.milestoneId) || "locked",
    [stateById],
  );

  // First milestone that needs the client's attention, else the first open one
  const defaultMilestoneId = useMemo(() => {
    const actionable = progressList.find((m) => {
      const state = stateById.get(m.milestoneId);
      return state === "awaiting_payment" || state === "review_pending" || state === "in_progress";
    });
    return (
      actionable?.milestoneId ||
      progressList.find((m) => m.status !== "completed")?.milestoneId ||
      progressList[0]?.milestoneId ||
      ""
    );
  }, [progressList, stateById]);

  const [selectedId, setSelectedId] = useState(defaultMilestoneId);
  useEffect(() => setSelectedId(defaultMilestoneId), [defaultMilestoneId]);

  const [founder, setFounder] = useState<TeamMember | null>(null);
  const [messages, setMessages] = useState<ServiceMilestoneMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [openingTaskroom, setOpeningTaskroom] = useState(false);
  const navigateToServiceRoom = useTaskroomWorkspacetore(
    (state) => state.navigateToServiceRoom,
  );

  // "Provision a Taskroom for every client" (taskroomConfig.enabled) is what
  // gives this engagement a room of its own, so the deep link only shows when
  // it is on. Founder-only because GET /services/opt-ins/:id/taskroom answers
  // 403 to everyone else — opening it to clients is a backend change.
  const taskroomLinkEnabled = Boolean(
    service?.taskroomConfig?.enabled && isFounder,
  );

  // The engagement timeline. The milestone discussion below is not gated by
  // this — it is the client's channel to the founder, not a log.
  const activityEnabled = Boolean(
    service?.taskroomConfig?.clientAccess?.showActivityLogs || isFounder,
  );
  const [showActivity, setShowActivity] = useState(false);

  // Founder-only: jump into the full Taskroom workspace for this engagement.
  const openTaskroom = useCallback(async () => {
    if (!isFounder) return;
    setOpeningTaskroom(true);
    try {
      const { getEngagementTaskroom } = await import("@/lib/feed-api");
      const { taskroom } = await getEngagementTaskroom(optIn._id);

      if (!taskroom?.roomId) {
        toast.error(
          taskroom?.status === "failed"
            ? "The engagement room could not be created yet"
            : "The engagement room is still being set up",
        );
        return;
      }

      const ok = await navigateToServiceRoom({
        roomId: taskroom.roomId,
        spaceId: taskroom.spaceId,
        workspaceId: taskroom.workspaceId,
      });

      if (!ok) {
        toast.error("Could not open the taskroom");
        return;
      }

      // Taskroom is popover-driven rather than routed, so the dashboard shell
      // is told to switch containers the same way its own nav does.
      window.dispatchEvent(
        new CustomEvent("service:open-taskroom", {
          detail: { roomId: taskroom.roomId },
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open the taskroom",
      );
    } finally {
      setOpeningTaskroom(false);
    }
  }, [isFounder, optIn._id, navigateToServiceRoom]);
  const replyRef = useRef<HTMLInputElement | null>(null);
  const clientFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingClientFile, setUploadingClientFile] = useState(false);
  // Keyed by milestone id — the parent holds `optIn` and does not refetch on
  // upload, so the freshly saved list is mirrored here.
  const [clientFileOverride, setClientFileOverride] = useState<
    Record<string, ServiceMilestoneAttachment[]>
  >({});

  const selected = progressList.find((m) => m.milestoneId === selectedId) || progressList[0];
  const selectedState = selected ? stateOf(selected) : "locked";
  const selectedDefinition = service?.milestones?.find(
    (m) => m._id === selected?.milestoneId,
  );

  // Files the founder attached to the milestone definition, plus anything
  // submitted when the milestone was completed.
  // Files shared WITH the client for the selected milestone: the founder's
  // brief on the milestone definition plus whatever they submitted on delivery.
  const sharedDocuments = (() => {
    if (selectedState === "locked") return [];
    const seen = new Set<string>();
    return [
      ...(selectedDefinition?.attachments || []),
      ...(selected?.attachments || []),
    ].filter((file) => {
      if (seen.has(file.url)) return false;
      seen.add(file.url);
      return true;
    });
  })();

  const selectedLocked = selectedState === "locked";

  // Files the client uploaded against the selected milestone
  const clientFiles =
    clientFileOverride[selected?.milestoneId || ""] ?? selected?.clientAttachments ?? [];

  const syncClientFiles = (updated: ServiceOpt) => {
    const next: Record<string, ServiceMilestoneAttachment[]> = {};
    for (const progress of updated.milestonesProgress || []) {
      next[progress.milestoneId] = progress.clientAttachments || [];
    }
    setClientFileOverride(next);
  };

  const handleClientUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0 || !selected) return;

    const room = MAX_CLIENT_FILES - clientFiles.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_CLIENT_FILES} files per milestone`);
      return;
    }

    setUploadingClientFile(true);
    try {
      const uploaded: ServiceMilestoneAttachment[] = [];
      for (const file of files.slice(0, room)) {
        if (file.size > MAX_CLIENT_FILE_MB * 1024 * 1024) {
          toast.error(`${file.name}: over ${MAX_CLIENT_FILE_MB}MB`);
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body,
          },
        );
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        uploaded.push({
          name: file.name,
          url: data.url,
          size: file.size,
          contentType: file.type || undefined,
        });
      }

      if (uploaded.length > 0) {
        const { optIn: updated } = await addMilestoneAttachments(
          optIn._id,
          selected.milestoneId,
          uploaded,
        );
        syncClientFiles(updated);
        toast.success("File shared with the founder");
      }
    } catch (error) {
      console.error("Error uploading milestone file:", error);
      toast.error(
        error instanceof Error && error.message ? error.message : "Failed to upload file",
      );
    } finally {
      setUploadingClientFile(false);
    }
  };

  const handleRemoveClientFile = async (url: string) => {
    if (!selected) return;
    try {
      const { optIn: updated } = await removeMilestoneAttachment(
        optIn._id,
        selected.milestoneId,
        url,
      );
      syncClientFiles(updated);
    } catch (error) {
      console.error("Error removing milestone file:", error);
      toast.error("Failed to remove file");
    }
  };

  // Features and deliverables live on the service, not on each milestone.
  const serviceIncludes = [
    ...(service?.features || []),
    ...(service?.deliverables || []),
  ];

  // Milestones only carry their own checklist when the founder filled one in;
  // otherwise show the service-wide list so the buyer still sees what they get.
  const milestoneChecklist = selectedDefinition?.deliverables?.length
    ? selectedDefinition.deliverables
    : serviceIncludes;

  const actionRequired = progressList.find((m) => stateOf(m) === "review_pending");
  const paymentRequired = progressList.find((m) => stateOf(m) === "awaiting_payment");

  // Founder behind the service, for attribution and the contact buttons
  useEffect(() => {
    const loadFounder = async () => {
      const orgId = getOrgId();
      if (!service?.createdBy || !orgId) return;
      try {
        const members = await getTeamMembers(orgId);
        const match = members?.find((m) => m._id === service.createdBy);
        if (match) setFounder(match);
      } catch (error) {
        console.error("Error loading service owner:", error);
      }
    };
    loadFounder();
  }, [service?.createdBy]);

  const loadMessages = useCallback(async () => {
    if (!selected?.milestoneId) return;
    setLoadingMessages(true);
    try {
      const data = await getServiceMilestoneMessages(optIn._id, selected.milestoneId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Error loading milestone messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, [optIn._id, selected?.milestoneId]);

  useEffect(() => {
    setMessages([]);
    loadMessages();
  }, [loadMessages]);

  const sendMessage = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || !selected?.milestoneId) return;
    setSending(true);
    try {
      const data = await postServiceMilestoneMessage(
        optIn._id,
        selected.milestoneId,
        body,
      );
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    } catch (error) {
      console.error("Error posting milestone message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const contactHref = service?.contactInfo?.whatsapp
    ? `https://wa.me/${service.contactInfo.whatsapp.replace(/[^\d]/g, "")}`
    : service?.contactInfo?.email
      ? `mailto:${service.contactInfo.email}`
      : founder?.email
        ? `mailto:${founder.email}`
        : null;

  const startIssue = () => {
    setDraft("Issue: ");
    replyRef.current?.focus();
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const currency = optIn.currency;
  const remaining = Math.max(
    (optIn.totalAmount || 0) - (optIn.amountPaid || 0) - (optIn.amountPending || 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Floating action overlay — never occupies page height */}
      {(actionRequired || paymentRequired) && !bannerDismissed && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-full border border-brand/30 bg-[#1a1608]/95 py-2 pl-4 pr-2 shadow-2xl backdrop-blur">
            <Hourglass className="h-4 w-4 shrink-0 text-brand" />
            <p className="min-w-0 text-xs text-[#c7c7da]">
              <span className="font-semibold uppercase tracking-wide text-brand">
                {actionRequired ? "Action required" : "Payment required"}
              </span>{" "}
              {actionRequired
                ? `Milestone ${actionRequired.order} is awaiting your approval`
                : `${formatCurrency(paymentRequired!.paymentAmount, currency)} due to unlock Milestone ${paymentRequired!.order}`}
            </p>
            <button
              type="button"
              onClick={() => {
                const target = actionRequired || paymentRequired;
                if (target) setSelectedId(target.milestoneId);
                if (!actionRequired && paymentRequired) {
                  onPayMilestone(paymentRequired.milestoneId);
                }
              }}
              className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
            >
              {actionRequired ? "Review now" : "Pay now"}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-1.5 text-[#9fa0b8] hover:bg-[#2a2a35] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header action: the engagement's Taskroom deep link. The engagement
          itself is milestone-only now — the board and files live in the
          Taskroom, which the button below opens directly. The activity log
          moved into the Engagement status card in the right rail. */}
      {taskroomLinkEnabled && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={openTaskroom}
            disabled={openingTaskroom}
            title="Open this engagement's room to update its tasks"
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-brand-foreground transition-all hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] active:scale-95 disabled:opacity-50"
          >
            {openingTaskroom ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            Go to Taskroom
          </button>
        </div>
      )}

      <EngagementActivityPanel
        optInId={optIn._id}
        open={showActivity}
        onClose={() => setShowActivity(false)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px] xl:gap-6 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        {/* Left: milestones stepper */}
        <div>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
            Milestones stepper
          </p>
          <div className="space-y-2">
            {progressList.map((milestone) => {
              const state = stateOf(milestone);
              const meta = STATE_META[state];
              const isSelected = milestone.milestoneId === selected?.milestoneId;

              return (
                <button
                  key={milestone.milestoneId}
                  type="button"
                  onClick={() => setSelectedId(milestone.milestoneId)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-l-2 border-l-brand border-[#2a2a35] bg-[#141414]"
                      : "border-transparent hover:bg-[#141414]",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        state === "approved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : state === "locked"
                            ? "bg-[#1F1F1F] text-[#6b6c85]"
                            : "bg-brand/15 text-brand",
                      )}
                    >
                      {state === "approved" ? (
                        <Check className="h-3 w-3" />
                      ) : state === "locked" ? (
                        <Lock className="h-2.5 w-2.5" />
                      ) : (
                        milestone.order
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-xs font-medium",
                            state === "locked" ? "text-[#6b6c85]" : "text-white",
                          )}
                        >
                          {milestone.order}. {milestone.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold",
                            state === "locked" ? "text-[#6b6c85]" : "text-white",
                          )}
                        >
                          {formatCurrency(milestone.paymentAmount, currency)}
                        </span>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1F1F1F]">
                        <div
                          className={cn("h-full rounded-full", meta.bar)}
                          style={{
                            width:
                              state === "approved"
                                ? "100%"
                                : state === "locked"
                                  ? "0%"
                                  : "45%",
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                          meta.pill,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: milestone workspace */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-6">
            {selectedState === "awaiting_payment" && selected?.status !== "completed" ? (
              // Locked until the advance payment lands
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1F1F1F] text-brand">
                  <Lock className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Work starts once this milestone is paid
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#9fa0b8]">
                  {founder?.name ? `${founder.name} is` : "The founder is"} ready to begin
                  Milestone {selected?.order}. Unlock it to start the work on{" "}
                  {selected?.title}.
                </p>
                <button
                  type="button"
                  onClick={() => selected && onPayMilestone(selected.milestoneId)}
                  disabled={payingMilestoneId === selected?.milestoneId}
                  className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
                >
                  {payingMilestoneId === selected?.milestoneId && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Submit Advance Payment (
                  {formatCurrency(selected?.paymentAmount || 0, currency)})
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Milestone {selected?.order}: {selected?.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#9fa0b8]">
                      {selected?.completedAt
                        ? `Submitted on ${formatDate(selected.completedAt)}`
                        : selected?.startedAt
                          ? `Started on ${formatDate(selected.startedAt)}`
                          : "Not started yet"}
                      {founder?.name ? ` by ${founder.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium",
                      STATE_META[selectedState].pill,
                    )}
                  >
                    {selectedState === "review_pending"
                      ? "In review"
                      : STATE_META[selectedState].label}
                  </span>
                </div>

                {(selectedState === "up_next" || selectedState === "locked") && (
                  <p className="mt-4 rounded-xl border border-[#2a2a35] bg-[#1F1F1F] p-3 text-xs text-[#9fa0b8]">
                    {selectedState === "locked"
                      ? "This milestone unlocks once the previous one is approved."
                      : selected?.paymentTiming === "advance"
                        ? "The founder can start this milestone once its advance payment is made. You will be asked to pay when it is requested."
                        : "Waiting for the founder to start this milestone. It is billed only after you approve the deliverables."}
                  </p>
                )}

                {selectedDefinition?.description && (
                  <p className="mt-4 text-sm leading-relaxed text-[#9fa0b8]">
                    {selectedDefinition.description}
                  </p>
                )}

                {milestoneChecklist.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                      {selectedDefinition?.deliverables?.length
                        ? "Deliverables checklist"
                        : "Service deliverables"}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {milestoneChecklist.map((item, idx) => (
                        <li key={`${item}-${idx}`} className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                              selected?.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-[#1F1F1F] text-[#6b6c85]",
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span className="text-sm text-[#c7c7da]">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 border-t border-[#2a2a35] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                      Your submissions
                    </p>
                    <input
                      ref={clientFileInputRef}
                      type="file"
                      multiple
                      onChange={handleClientUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => clientFileInputRef.current?.click()}
                      disabled={uploadingClientFile || selectedLocked}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#1F1F1F] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                    >
                      {uploadingClientFile ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload file
                    </button>
                  </div>

                  {selectedLocked ? (
                    <p className="mt-3 flex items-center gap-2 text-xs text-[#6b6c85]">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      Files unlock once the previous milestone is approved.
                    </p>
                  ) : clientFiles.length === 0 ? (
                    <p className="mt-3 text-xs text-[#6b6c85]">
                      Share briefs, assets or reference material with the founder for
                      this milestone.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {clientFiles.map((file, idx) => (
                        <div
                          key={`${file.url}-${idx}`}
                          className="flex items-center gap-3 rounded-xl border border-[#2a2a35] bg-[#1F1F1F] p-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#141414] text-[#9fa0b8]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-[#6b6c85]">
                              {formatFileSize(file.size)
                                ? `${formatFileSize(file.size)} · `
                                : ""}
                              {formatDate(file.uploadedAt)}
                            </p>
                          </div>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#141414] hover:text-white"
                            title="Preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveClientFile(file.url)}
                            className="rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#141414] hover:text-red-400"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>

          {/* Activity & discussion — scoped to the selected milestone */}
          <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-6">
            <h3 className="text-sm font-bold text-white">Activity &amp; Discussion</h3>

            <div className="mt-4 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-[#6b6c85]">
                  No messages on this milestone yet. Ask a question or leave a note for
                  the founder.
                </p>
              ) : (
                messages.map((message) => {
                  const author =
                    typeof message.userId === "object" ? message.userId : null;
                  const isFounderAuthor = message.authorRole === "founder";
                  return (
                    <div key={message._id} className="flex items-start gap-3">
                      {author?.profilePicture ? (
                        <img
                          src={author.profilePicture}
                          alt={author.name}
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-[10px] font-semibold text-[#c7c7da]">
                          {author?.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "font-semibold",
                              isFounderAuthor ? "text-brand" : "text-white",
                            )}
                          >
                            {author?.name || "Member"}
                            {isFounderAuthor ? " (Founder)" : " (You)"}
                          </span>
                          <span className="text-[10px] text-[#6b6c85]">
                            {formatDateTime(message.createdAt)}
                          </span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[#c7c7da]">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#2a2a35] bg-[#1F1F1F] p-2">
              <input
                ref={replyRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Write a reply or note..."
                className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-[#6b6c85]"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={sending || !draft.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: escrow actions and summary */}
        <div className="space-y-4">
          {selected && selectedState === "review_pending" ? (
            <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                Due on approval
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCurrency(selected.paymentAmount, currency)}
              </p>
              <p className="mt-2 text-xs text-[#9fa0b8]">
                Released to the founder once you approve the deliverables.
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-400">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Garage Pay Escrow secured. Funds are only transferred after your
                  explicit confirmation.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPayMilestone(selected.milestoneId)}
                disabled={payingMilestoneId === selected.milestoneId}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
              >
                {payingMilestoneId === selected.milestoneId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Approve &amp; Release Payment
              </button>
              <button
                type="button"
                onClick={startIssue}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-lg border border-[#2a2a35] bg-[#1F1F1F] text-sm font-medium text-white hover:bg-[#2a2a35]"
              >
                Request changes
              </button>
            </div>
          ) : selected && selectedState === "awaiting_payment" ? (
            <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                Upfront payment due
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCurrency(selected.paymentAmount, currency)}
              </p>
              <p className="mt-2 text-xs text-[#9fa0b8]">
                Payment requested to start this milestone and its deliverables.
              </p>
              <button
                type="button"
                onClick={() => onPayMilestone(selected.milestoneId)}
                disabled={payingMilestoneId === selected.milestoneId}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
              >
                {payingMilestoneId === selected.milestoneId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Pay {formatCurrency(selected.paymentAmount, currency)} to Start
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                Engagement status
              </p>
              <p className="mt-1 text-2xl font-bold text-white capitalize">
                {optIn.status.replace("_", " ")}
              </p>
              <p className="mt-2 text-xs text-[#9fa0b8]">
                {optIn.completedMilestones} of {optIn.totalMilestones} milestones
                approved · {optIn.progressPercentage}% complete
              </p>

              {/* The engagement timeline lives here rather than in a page
                  header — it reads as detail about the status above it. */}
              {activityEnabled && (
                <button
                  type="button"
                  onClick={() => setShowActivity(true)}
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#2a2a35] bg-[#1F1F1F] text-xs font-medium text-[#9fa0b8] transition-colors hover:border-[#3a3a45] hover:text-white"
                >
                  <Activity className="h-3.5 w-3.5" />
                  View activity
                </button>
              )}
            </div>
          )}

          {serviceIncludes.length > 0 && (
            <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                What&apos;s included
              </p>
              <ul className="mt-3 space-y-2">
                {serviceIncludes.map((item, idx) => (
                  <li key={`${item}-${idx}`} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-xs text-[#c7c7da]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
              Payment summary
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Paid to date</span>
                <span className="font-semibold text-white">
                  {formatCurrency(optIn.amountPaid || 0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Awaiting payment</span>
                <span className="font-semibold text-brand">
                  {formatCurrency(optIn.amountPending || 0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9fa0b8]">Remaining amount</span>
                <span className="font-semibold text-white">
                  {formatCurrency(remaining, currency)}
                </span>
              </div>
            </div>
          </div>

          {(sharedDocuments.length > 0 || selectedLocked) && (
            <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9fa0b8]">
                Shared documents
              </p>
              {selectedLocked && (
                <p className="mt-3 flex items-center gap-2 text-xs text-[#6b6c85]">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Locked until milestone {(selected?.order || 1) - 1} is approved.
                </p>
              )}
              <div className="mt-3 space-y-1">
                {sharedDocuments.map((file) => (
                  <a
                    key={file.url}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#1F1F1F]"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#6b6c85]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-white">{file.name}</span>
                      <span className="block truncate text-[10px] text-[#6b6c85]">
                        {formatFileSize(file.size) || "Shared by the founder"}
                      </span>
                    </span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-[#6b6c85] transition-colors group-hover:text-brand" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {contactHref ? (
            <a
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a35] bg-[#141414] text-sm font-medium text-white hover:bg-[#1F1F1F]"
            >
              <MessageCircle className="h-4 w-4" />
              Message Founder
            </a>
          ) : (
            <button
              type="button"
              onClick={() => toast.error("No contact details added for this service yet")}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a35] bg-[#141414] text-sm font-medium text-white hover:bg-[#1F1F1F]"
            >
              <MessageCircle className="h-4 w-4" />
              Message Founder
            </button>
          )}

          <button
            type="button"
            onClick={startIssue}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 text-sm font-medium text-rose-400 hover:bg-rose-500/10"
          >
            <AlertTriangle className="h-4 w-4" />
            Raise an Issue / Dispute
          </button>

          {service?.duration && (
            <p className="flex items-center gap-2 px-1 text-[11px] text-[#6b6c85]">
              <Clock className="h-3.5 w-3.5" />
              Delivery duration: {service.duration}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


