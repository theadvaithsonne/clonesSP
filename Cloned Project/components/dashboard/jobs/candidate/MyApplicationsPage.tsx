"use client";

// B5 / F7 · My Applications — every application the member has made, with
// the stage they're at (as broad categories only), what happens next,
// interview slots to pick, offers to accept or decline, and drafts to finish.
// A rejection shows as "Not moving forward" with no detail — screening
// decisions stay private to the office.

import React from "react";
import { Briefcase, CalendarPlus, Check, Clock, FileText, PartyPopper, Video } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  GOLD,
  LoadingBlock,
  OrgLogo,
  PageHeader,
  RowMenu,
  TextArea,
  UnderlineTabs,
  errorMessage,
  formatDate,
  formatDateTime,
  meetingLink,
  formatMoney,
  useConfirm,
  useLoad,
} from "../ui";
import { BOARD_PAGES, type ApplicationsTab, useBoardNav, useBoardStore } from "./boardNav";
import * as candidateApi from "./candidateApi";
import type { MyApplication, MyInterview } from "./candidateTypes";
import { processLabel } from "./shared";

function bucket(a: MyApplication): ApplicationsTab {
  if (a.isDraft) return "drafts";
  if (a.status !== "active") return "closed";
  if (a.offer && (a.offer.status === "sent" || a.offer.status === "accepted")) return "offers";
  return "active";
}

function money(amount: number, currency: string) {
  return formatMoney(amount, currency || "USD");
}

/** Every live round — older backends only send the single `interview`. */
function interviewsOf(a: MyApplication): MyInterview[] {
  return a.interviews ?? (a.interview ? [a.interview] : []);
}

function googleCalendarUrl(a: MyApplication, iv: MyInterview): string | null {
  if (!iv.scheduledAt) return null;
  const start = new Date(iv.scheduledAt);
  const end = new Date(start.getTime() + (iv.durationMin || 45) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Interview · ${a.job?.title || "Job"} at ${a.org?.name || ""}`.trim(),
    dates: `${fmt(start)}/${fmt(end)}`,
    details: iv.meetingUrl ? `Join: ${meetingLink(iv.meetingUrl)}` : "Garage Jobs interview",
    ...(iv.location ? { location: iv.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function interviewLine(iv: MyInterview): React.ReactNode {
  if (iv.status !== "scheduled" || !iv.scheduledAt) return "Pick a time for your interview";
  const mode = iv.mode === "video" ? "Video call" : iv.mode === "phone" ? "Phone call" : "In person";
  return (
    <>
      Interview on {formatDateTime(iv.scheduledAt)} · {mode}
      {iv.mode === "video" && !iv.meetingUrl && " · Join link available 10 min before"}
      {iv.mode === "in_person" && iv.location ? ` · ${iv.location}` : ""}
    </>
  );
}

/** The application-level line — interviews get their own rows. */
function nextStepLine(a: MyApplication): React.ReactNode {
  if (a.offer?.status === "sent") return `Offer received${a.offer.expiresAt ? ` · review before ${formatDate(a.offer.expiresAt, { year: undefined })}` : ""}`;
  if (a.offer?.status === "accepted") return "You accepted the offer — the team will confirm your joining details.";
  switch (a.stageCategory) {
    case "applied":
      return "Application received";
    case "screening":
      return "The team is reviewing your application";
    case "assessment":
      return "Assessment stage";
    case "interview":
      return "Interview stage — you'll get an invite with the time";
    case "offer":
      return "Final stage";
    default:
      return "";
  }
}

export default function MyApplicationsPage() {
  const nav = useBoardNav();
  const tab = useBoardStore((s) => s.applicationsTab);
  const setStore = useBoardStore((s) => s.set);
  const { data, loading, error, reload } = useLoad(() => candidateApi.getMyApplications(), []);
  const [offerFor, setOfferFor] = React.useState<MyApplication | null>(null);
  const [picking, setPicking] = React.useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const apps = data?.applications || [];
  const counts = { active: 0, offers: 0, closed: 0, drafts: 0 } as Record<ApplicationsTab, number>;
  for (const a of apps) counts[bucket(a)]++;
  const visible = apps.filter((a) => bucket(a) === tab);
  const pendingOffer = apps.find((a) => a.offer?.status === "sent" && a.status === "active");

  const pick = async (interviewId: string, slot: string) => {
    setPicking(slot);
    try {
      await candidateApi.pickInterviewSlot(interviewId, slot);
      toast.success(`Booked for ${formatDateTime(slot)}`);
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't book that time."));
    } finally {
      setPicking(null);
    }
  };

  const withdraw = async (a: MyApplication) => {
    const ok = await confirm({
      title: a.isDraft ? "Delete this draft?" : `Withdraw your application for ${a.job?.title || "this job"}?`,
      message: a.isDraft
        ? "Your answers so far will be deleted."
        : "The team will see that you withdrew. You can't re-open this application.",
      confirmLabel: a.isDraft ? "Delete draft" : "Withdraw",
    });
    if (!ok) return;
    try {
      await candidateApi.withdrawApplication(a._id);
      toast.success(a.isDraft ? "Draft deleted" : "Application withdrawn");
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the application."));
    }
  };

  return (
    <>
      <PageHeader title="My applications" subtitle="Track every application — you'll see where you are, never the team's private notes.">
        <UnderlineTabs<ApplicationsTab>
          value={tab}
          onChange={(v) => setStore({ applicationsTab: v })}
          tabs={[
            { value: "active", label: "Active", count: counts.active },
            { value: "offers", label: "Offers", count: counts.offers },
            { value: "closed", label: "Closed", count: counts.closed },
            { value: "drafts", label: "Drafts", count: counts.drafts },
          ]}
        />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : (
          <div className="space-y-3">
            {pendingOffer && (
              <div
                className="flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4"
                style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.06)" }}
              >
                <PartyPopper className="h-5 w-5 text-[#4ade80]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">
                    {pendingOffer.org?.name} sent you an offer
                    {pendingOffer.offer?.expiresAt ? ` — expires ${formatDate(pendingOffer.offer.expiresAt, { year: undefined })}` : ""}
                  </div>
                  <div className="text-xs text-[#c7c7da]">
                    {pendingOffer.offer?.role} · {money(pendingOffer.offer!.ctc, pendingOffer.offer!.currency)} per year
                  </div>
                </div>
                <Button onClick={() => setOfferFor(pendingOffer)}>Review offer</Button>
              </div>
            )}

            {!visible.length ? (
              apps.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="h-10 w-10" />}
                  title="No applications yet"
                  description="When you apply for a role on Garage Jobs it shows up here, with every step of the process."
                  action={<Button onClick={() => nav.go(BOARD_PAGES.discover)}>Find jobs</Button>}
                />
              ) : (
                <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">Nothing here right now.</Card>
              )
            ) : (
              visible.map((a) => (
                <ApplicationCard
                  key={a._id}
                  app={a}
                  picking={picking}
                  onPick={pick}
                  onOffer={() => setOfferFor(a)}
                  onOpenJob={() => a.job && nav.openJob(a.job._id)}
                  onContinue={() => a.job && nav.openApply(a.job._id)}
                  onWithdraw={() => withdraw(a)}
                  onSimilar={() => nav.go(BOARD_PAGES.discover)}
                />
              ))
            )}
          </div>
        )}
      </div>
      <OfferDrawer
        app={offerFor}
        onClose={() => setOfferFor(null)}
        onDone={() => {
          setOfferFor(null);
          reload(true);
        }}
      />
      {confirmDialog}
    </>
  );
}

function ProgressTrack({ app }: { app: MyApplication }) {
  const steps = app.process.length ? app.process : [];
  const current = steps.indexOf(app.stageCategory);
  const reached = app.stageCategory === "hired" ? steps.length - 1 : current;
  return (
    <div className="flex items-center">
      {steps.map((c, i) => {
        const done = i <= reached;
        return (
          <React.Fragment key={c}>
            {i > 0 && <span className="h-px w-6 sm:w-10" style={{ background: i <= reached ? GOLD : "#2a2a35" }} />}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: done ? GOLD : "#2a2a35" }} />
              <span className={`text-[11px] ${i === current ? "text-white" : done ? "text-[#c7c7da]" : "text-[#61627a]"}`}>{processLabel(c)}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ApplicationCard({
  app,
  picking,
  onPick,
  onOffer,
  onOpenJob,
  onContinue,
  onWithdraw,
  onSimilar,
}: {
  app: MyApplication;
  picking: string | null;
  onPick: (interviewId: string, slot: string) => void;
  onOffer: () => void;
  onOpenJob: () => void;
  onContinue: () => void;
  onWithdraw: () => void;
  onSimilar: () => void;
}) {
  const org = app.org;
  const title = app.job?.title || "Job no longer available";

  if (app.isDraft) {
    const pct = app.draftProgress ? Math.round((app.draftProgress.page / Math.max(1, app.draftProgress.pages)) * 100) : 0;
    return (
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        <OrgLogo name={org?.name} src={org?.icon} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-[#7c7d94]">
            Draft application
            {app.draftProgress ? ` · ${app.draftProgress.page} of ${app.draftProgress.pages} pages done` : ""}
          </div>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[#1f1f28]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GOLD }} />
        </div>
        {app.job?.status === "live" ? (
          <Button onClick={onContinue}>Continue</Button>
        ) : (
          <span className="text-xs text-[#7c7d94]">This job has closed</span>
        )}
        <RowMenu items={[{ label: "Delete draft", danger: true, onClick: onWithdraw }]} />
      </Card>
    );
  }

  if (app.status === "rejected") {
    return (
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <OrgLogo name={org?.name} src={org?.icon} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="text-xs text-[#7c7d94]">
              {org?.name}
              {app.appliedAt ? ` · Applied ${formatDate(app.appliedAt)}` : ""}
            </div>
          </div>
          <span className="rounded-md bg-[#1f1f28] px-2 py-0.5 text-[11px] text-[#a1a1aa]">Not moving forward</span>
        </div>
        <div className="mt-3 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
          <p className="text-sm text-[#c7c7da]">
            {org?.name || "The team"} has decided not to move forward with your application. Thank you for the time you invested.
          </p>
          <p className="mt-1 text-xs text-[#61627a]">Screening decisions are private. No answer or evaluation detail is shared.</p>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={onSimilar}>
            Find similar roles
          </Button>
        </div>
      </Card>
    );
  }

  const ivs = interviewsOf(app);
  const statusPill =
    app.status === "withdrawn"
      ? { label: "Withdrawn", bg: "#1f1f28", fg: "#a1a1aa" }
      : app.status === "hired"
        ? { label: "Hired", bg: "rgba(34,197,94,0.12)", fg: "#4ade80" }
        : app.offer?.status === "sent"
          ? { label: "Offer", bg: "rgba(96,165,250,0.12)", fg: "#93c5fd" }
          : { label: processLabel(app.stageCategory), bg: "color-mix(in srgb, var(--brand) 12%, transparent)", fg: GOLD };

  return (
    <Card className="px-5 py-4" style={app.offer?.status === "sent" ? { borderColor: GOLD } : undefined}>
      <div className="flex flex-wrap items-start gap-4">
        <OrgLogo name={org?.name} src={org?.icon} size={40} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpenJob} className="truncate text-left text-sm font-semibold text-white hover:underline">
            {title}
          </button>
          <div className="text-xs text-[#7c7d94]">
            {org?.name}
            {app.appliedAt ? ` · Applied ${formatDate(app.appliedAt)}` : ""}
            {app.reference ? ` · ${app.reference}` : ""}
          </div>
        </div>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: statusPill.bg, color: statusPill.fg }}>
          {statusPill.label}
        </span>
        {app.status === "active" && <RowMenu items={[{ label: "Withdraw application", danger: true, onClick: onWithdraw }]} />}
      </div>

      {app.status !== "withdrawn" && app.process.length > 0 && (
        <div className="mt-4 overflow-x-auto pb-1">
          <ProgressTrack app={app} />
        </div>
      )}

      {app.status === "active" &&
        ivs.map((iv) => (
          <InterviewRow key={iv._id} app={app} iv={iv} picking={picking} onPick={(slot) => onPick(iv._id, slot)} />
        ))}

      {app.status === "active" && (!ivs.length || app.offer?.status === "sent" || app.offer?.status === "accepted") && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs" style={{ color: app.offer?.status === "sent" ? GOLD : "#7c7d94" }}>
            {nextStepLine(app)}
          </span>
          <div className="flex flex-wrap gap-2">
            {app.offer?.status === "sent" && <Button onClick={onOffer}>Review offer</Button>}
            {app.offer?.status === "accepted" && (
              <Button variant="secondary" onClick={onOffer}>
                View offer
              </Button>
            )}
          </div>
        </div>
      )}

      {app.status === "hired" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#4ade80]">
          <Check className="h-3.5 w-3.5" /> You were hired
          {app.offer?.joiningDate ? ` · joining ${formatDate(app.offer.joiningDate)}` : ""}
        </p>
      )}
      {app.status === "withdrawn" && <p className="mt-3 text-xs text-[#7c7d94]">You withdrew this application.</p>}
    </Card>
  );
}

function InterviewRow({
  app,
  iv,
  picking,
  onPick,
}: {
  app: MyApplication;
  iv: MyInterview;
  picking: string | null;
  onPick: (slot: string) => void;
}) {
  const calendar = googleCalendarUrl(app, iv);
  const openSlots = iv.slots.filter((s) => new Date(s).getTime() > Date.now());
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs" style={{ color: GOLD }}>
          {interviewLine(iv)}
        </span>
        <div className="flex flex-wrap gap-2">
          {iv.status === "scheduled" && iv.meetingUrl && (
            <Button onClick={() => window.open(meetingLink(iv.meetingUrl), "_blank", "noopener,noreferrer")}>
              <Video className="h-4 w-4" /> Join
            </Button>
          )}
          {calendar && (
            <Button variant="secondary" onClick={() => window.open(calendar, "_blank", "noopener,noreferrer")}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </Button>
          )}
        </div>
      </div>
      {iv.status === "awaiting_candidate" && iv.slots.length > 0 && (
        <div className="mt-3 rounded-xl border border-[#262626] bg-[#1A1A1A] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[#c7c7da]">
            <Clock className="h-3.5 w-3.5" /> Choose one ({iv.durationMin} min ·{" "}
            {iv.mode === "video" ? "video call" : iv.mode === "phone" ? "phone call" : "in person"})
          </div>
          <div className="flex flex-wrap gap-2">
            {openSlots.map((s) => (
              <Button key={s} variant="secondary" loading={picking === s} disabled={!!picking} onClick={() => onPick(s)}>
                {formatDateTime(s)}
              </Button>
            ))}
            {!openSlots.length && <span className="text-xs text-[#7c7d94]">These times have passed — the team will send new ones.</span>}
          </div>
        </div>
      )}
    </>
  );
}

function OfferDrawer({ app, onClose, onDone }: { app: MyApplication | null; onClose: () => void; onDone: () => void }) {
  const [declining, setDeclining] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<"accept" | "decline" | null>(null);
  React.useEffect(() => {
    setDeclining(false);
    setReason("");
  }, [app?._id]);

  const offer = app?.offer;
  const isPdf = !!offer?.letter?.url && /\.pdf($|\?)/i.test(offer.letter.url);

  const respond = async (accept: boolean) => {
    if (!offer) return;
    setBusy(accept ? "accept" : "decline");
    try {
      await candidateApi.respondToOffer(offer._id, accept, accept ? undefined : reason.trim() || undefined);
      toast.success(accept ? "Offer accepted — congratulations!" : "Offer declined");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your response."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      open={!!app && !!offer}
      onClose={onClose}
      width={620}
      title={offer?.status === "sent" ? "Offer received" : offer?.status === "accepted" ? "Offer accepted" : "Offer"}
      subtitle={app ? `${offer?.role || app.job?.title} · ${app.org?.name || ""}` : undefined}
      footer={
        offer?.status === "sent" ? (
          declining ? (
            <>
              <Button variant="secondary" onClick={() => setDeclining(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                loading={busy === "decline"}
                onClick={() => respond(false)}
              >
                Decline offer
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDeclining(true)}>
                Decline
              </Button>
              <Button loading={busy === "accept"} onClick={() => respond(true)}>
                Accept offer
              </Button>
            </>
          )
        ) : undefined
      }
    >
      {offer && (
        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[#7c7d94]">Annual CTC</div>
              <div className="mt-1 text-sm font-semibold text-white">{money(offer.ctc, offer.currency)}</div>
            </div>
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[#7c7d94]">Joining</div>
              <div className="mt-1 text-sm font-semibold text-white">{offer.joiningDate ? formatDate(offer.joiningDate) : "To be confirmed"}</div>
            </div>
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[#7c7d94]">Expires</div>
              <div className="mt-1 text-sm font-semibold text-white">{offer.expiresAt ? formatDate(offer.expiresAt) : "No expiry"}</div>
            </div>
          </div>
          {offer.message && (
            <div className="rounded-xl border border-[#262626] bg-[#141414] p-4 text-sm leading-6 text-[#c7c7da] whitespace-pre-line">{offer.message}</div>
          )}
          {offer.letter?.url && (
            <div className="space-y-2">
              <a
                href={offer.letter.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: GOLD }}
              >
                <FileText className="h-4 w-4" /> {offer.letter.name || "Offer letter"}
              </a>
              {isPdf && <iframe src={offer.letter.url} title="Offer letter" className="h-[440px] w-full rounded-xl border border-[#262626] bg-white" />}
            </div>
          )}
          {offer.status === "sent" && declining && (
            <TextArea
              label="Reason (optional)"
              rows={3}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Share a reason if you'd like — the team will see it."
            />
          )}
          {offer.status === "accepted" && (
            <p className="text-sm text-[#4ade80]">You accepted this offer. The team will confirm your joining date.</p>
          )}
        </div>
      )}
    </Drawer>
  );
}
