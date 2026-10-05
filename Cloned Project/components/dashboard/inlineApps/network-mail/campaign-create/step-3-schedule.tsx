"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  getNetworkMailOrgId,
  sendCampaignTestEmail,
} from "@/lib/network-mail-campaigns-api";
import { CampaignStepper } from "./campaign-stepper";
import { CampaignStepHeader } from "./campaign-create-dialog";
import { CampaignActionBar, ActionButton } from "./campaign-action-bar";
import { RETRY_WAIT_OPTIONS } from "./constants";
import { estimateSendMinutes, isWeekend } from "./utils";
import type { CampaignData, ScheduleData, ScheduleType } from "./types";

const SCHEDULE_OPTIONS: {
  id: ScheduleType;
  title: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    id: "now",
    title: "Send immediately",
    description: "Campaign will be sent as soon as you launch",
    icon: Zap,
  },
  {
    id: "scheduled",
    title: "Schedule for specific date/time",
    description: "Choose exactly when to send",
    icon: Calendar,
  },
];

function normalizeScheduleType(type?: ScheduleType): ScheduleType {
  if (type === "timezone" || type === "drip") return "scheduled";
  return type ?? "now";
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** IANA zone of the browser, e.g. "Asia/Kolkata". */
function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The picked date/time is always the user's LOCAL wall-clock time.
 * `new Date("2026-09-07T18:00:00")` (no trailing Z) is parsed in the browser's
 * own timezone, so DST and every IANA zone are handled without an offset table.
 */
function computeUtcDate(dateStr: string, timeStr: string): Date | null {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match || !dateStr) return null;
  let hours = parseInt(match[1], 10);
  if (match[3].toUpperCase() === "PM" && hours < 12) hours += 12;
  if (match[3].toUpperCase() === "AM" && hours === 12) hours = 0;
  const d = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${match[2]}:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function CampaignStep3Schedule({
  onNext,
  onBack,
  initialData,
  recipientCount,
  campaignName,
  campaignId,
  returnToReview,
  onReturnToReview,
}: {
  onNext: (data: ScheduleData) => void;
  onBack: () => void;
  initialData?: ScheduleData;
  recipientCount: number;
  campaignName?: string;
  campaignId?: string | null;
  returnToReview?: boolean;
  onReturnToReview?: () => void;
}) {
  const detectedTz = useMemo(() => localTimezone(), []);

  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    if (initialData) {
      return {
        ...initialData,
        type: normalizeScheduleType(initialData.type),
        timezone: initialData.timezone || detectedTz,
      };
    }
    return {
      type: "now",
      timezone: detectedTz,
      retry: { enabled: true, attempts: 2, waitTime: "15 min" },
    };
  });
  const [sendSettingsOpen, setSendSettingsOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(
    initialData?.scheduledDate ?? todayIso()
  );

  const initialParsedTime = useMemo(() => {
    if (!initialData?.scheduledTime) return null;
    const m = initialData.scheduledTime.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    return {
      hour: m[1],
      minute: m[2],
      ampm: m[3].toUpperCase() as "AM" | "PM",
    };
  }, [initialData?.scheduledTime]);

  const [hour, setHour] = useState(initialParsedTime?.hour ?? "10");
  const [minute, setMinute] = useState(initialParsedTime?.minute ?? "00");
  const [ampm, setAmpm] = useState<"AM" | "PM">(initialParsedTime?.ampm ?? "AM");

  const scheduledTime = `${hour}:${minute} ${ampm}`;

  const patch = (p: Partial<ScheduleData>) => setSchedule((s) => ({ ...s, ...p }));

  const selectedTz = detectedTz;

  const utcDate = useMemo(
    () => computeUtcDate(scheduledDate, scheduledTime),
    [scheduledDate, scheduledTime]
  );

  const { tzOffsetString, localTimeDisplay, utcTimeDisplay } = useMemo(() => {
    if (!utcDate) {
      return { tzOffsetString: "", localTimeDisplay: "", utcTimeDisplay: "" };
    }
    // Offset on the scheduled date, not today — correct across a DST boundary.
    const offsetMinutes = -utcDate.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMins = Math.abs(offsetMinutes);
    const tzOffsetString = `UTC${sign}${Math.floor(absMins / 60)}:${(absMins % 60)
      .toString()
      .padStart(2, "0")}`;

    const fmt: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };

    return {
      tzOffsetString,
      localTimeDisplay: utcDate.toLocaleString(undefined, fmt),
      utcTimeDisplay:
        utcDate.toLocaleString("en-US", { ...fmt, timeZone: "UTC" }) + " GMT",
    };
  }, [utcDate]);

  const weekendWarning =
    schedule.type === "scheduled" && scheduledDate && isWeekend(scheduledDate);

  const handleNext = () => {
    const payload: ScheduleData = {
      ...schedule,
      timezone: selectedTz,
    };
    if (schedule.type === "scheduled") {
      payload.scheduledDate = scheduledDate;
      payload.scheduledTime = scheduledTime;
      if (utcDate) {
        payload.startDateTime = utcDate.toISOString();
      }
    }
    onNext(payload);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <CampaignStepper
        currentStep={3}
        returnToReview={returnToReview}
        onReturnToReview={onReturnToReview}
      />

      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        <div className="space-y-5">
          <CampaignStepHeader
            step={3}
            title="Schedule"
            description="Choose when this campaign should be sent."
          />

          <div>
            <label className="block text-sm font-medium text-[#a8a8a8] mb-2">
              Send timing
            </label>
            <div className="grid gap-2">
              {SCHEDULE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = schedule.type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ type: opt.id })}
                    className={`text-left p-3 rounded-lg border flex gap-3 cursor-pointer transition-all ${
                      selected
                        ? "border-brand bg-brand/5"
                        : "border-white/8 hover:border-white/15"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 mt-0.5 ${
                        selected ? "text-brand" : "text-[#7a7a7a]"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{opt.title}</p>
                      <p className="text-xs text-[#7a7a7a]">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {schedule.type === "now" && (
              <div className="p-3 rounded-lg border border-amber-500/30 mt-2 bg-amber-500/10 text-sm text-amber-200">
                ⚡ Campaign will be sent to {recipientCount.toLocaleString()} recipients
                immediately after launch
                <p className="text-xs mt-2 text-amber-200/80">
                  Estimated send time: ~{estimateSendMinutes(recipientCount)} minutes
                </p>
              </div>
            )}

            {schedule.type === "scheduled" && (
              <div className="p-4 rounded-lg border border-white/8 space-y-3 mt-2">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#a8a8a8]">Select date</label>
                    <input
                      type="date"
                      min={todayIso()}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="mt-1 w-full h-9 px-3 rounded-lg border border-white/10 bg-transparent text-sm text-white outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#a8a8a8]">Select time</label>
                    <div className="mt-1 flex gap-1">
                      <select
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        className="h-9 px-2 rounded-lg border border-white/10 bg-transparent text-sm text-white outline-none cursor-pointer"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={String(h)} className="bg-[#1a1a1a]">
                            {h}
                          </option>
                        ))}
                      </select>
                      <select
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        className="h-9 px-2 rounded-lg border border-white/10 bg-transparent text-sm text-white outline-none cursor-pointer"
                      >
                        {MINUTES.map((m) => (
                          <option key={m} value={m} className="bg-[#1a1a1a]">
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ampm}
                        onChange={(e) => setAmpm(e.target.value as "AM" | "PM")}
                        className="h-9 px-2 rounded-lg border border-white/10 bg-transparent text-sm text-white outline-none cursor-pointer"
                      >
                        <option value="AM" className="bg-[#1a1a1a]">
                          AM
                        </option>
                        <option value="PM" className="bg-[#1a1a1a]">
                          PM
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-brand/10 border border-brand/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-brand font-medium uppercase tracking-wider">
                      Scheduled Time (your local time)
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {scheduledTime}
                    </span>
                  </div>

                  {utcDate && (
                    <>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-xs text-[#a8a8a8]">Your timezone</span>
                        <span className="text-xs font-mono text-white bg-white/10 px-2 py-0.5 rounded">
                          {selectedTz} ({tzOffsetString})
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#a8a8a8]">Universal Time (GMT)</span>
                        <span className="text-xs font-mono text-[#a8a8a8]">
                          {utcTimeDisplay}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-brand/20 pt-2">
                        <span className="text-sm font-semibold text-brand">
                          Sends on
                        </span>
                        <span className="text-sm font-bold text-white">
                          {localTimeDisplay}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#7a7a7a]">
                  Mail will send at {scheduledTime} in your local time.
                </p>
                <p className="text-xs text-brand">
                  📊 Best send time: Tuesday 10:00 AM (based on your audience)
                </p>
                {weekendWarning && (
                  <p className="text-xs text-amber-400">
                    ⚠ Sending on weekend — open rates may be lower
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSendSettingsOpen((o) => !o)}
              className="mt-2 text-xs text-[#a8a8a8] cursor-pointer flex items-center gap-1"
            >
              <Clock className="h-3.5 w-3.5" />
              Send settings {sendSettingsOpen ? "▲" : "▼"}
            </button>
            {sendSettingsOpen && (
              <div className="p-4 rounded-lg border mt-2 border-white/8 space-y-3 text-sm">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.retry?.enabled}
                    onChange={(e) =>
                      patch({
                        retry: {
                          ...schedule.retry!,
                          enabled: e.target.checked,
                          attempts: schedule.retry?.attempts ?? 2,
                          waitTime: schedule.retry?.waitTime ?? "15 min",
                        },
                      })
                    }
                  />
                  Retry failed sends
                </label>
                {schedule.retry?.enabled && (
                  <div className="flex gap-2">
                    <select
                      value={schedule.retry.attempts}
                      onChange={(e) =>
                        patch({
                          retry: {
                            ...schedule.retry!,
                            attempts: Number(e.target.value),
                          },
                        })
                      }
                      className="h-8 px-2 rounded border border-white/10 bg-transparent text-xs text-white outline-none"
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n} className="bg-[#1a1a1a]">
                          {n} times
                        </option>
                      ))}
                    </select>
                    <select
                      value={schedule.retry.waitTime}
                      onChange={(e) =>
                        patch({
                          retry: { ...schedule.retry!, waitTime: e.target.value },
                        })
                      }
                      className="h-8 px-2 rounded border border-white/10 bg-transparent text-xs text-white outline-none"
                    >
                      {RETRY_WAIT_OPTIONS.map((w) => (
                        <option key={w} value={w} className="bg-[#1a1a1a]">
                          wait {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Test email address"
                    className="flex-1 h-8 px-2 rounded border border-white/10 bg-transparent text-xs text-white outline-none"
                  />
                  <ActionButton
                    variant="secondary"
                    className="!h-8 !text-xs"
                    disabled={sendingTest || !testEmail.trim()}
                    onClick={async () => {
                      const orgId = getNetworkMailOrgId();
                      const to = testEmail.trim();
                      if (!orgId || !to) return;
                      if (!campaignId) {
                        toast.error("Save the campaign first (complete steps 1 and 2)");
                        return;
                      }
                      setSendingTest(true);
                      try {
                        const res = await sendCampaignTestEmail(orgId, campaignId, { to });
                        if (res.senderNotice) {
                          toast.message(res.senderNotice);
                          toast.success(
                            `Test email sent to ${to} via ${res.actualFromEmail || "default sender"}`,
                          );
                        } else {
                          toast.success(`Test email sent to ${to}`);
                        }
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed to send test email",
                        );
                      } finally {
                        setSendingTest(false);
                      }
                    }}
                  >
                    {sendingTest ? "Sending…" : "Send test"}
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CampaignActionBar
        left={<ActionButton variant="secondary" onClick={onBack}>Back</ActionButton>}
        right={
          <ActionButton variant="primary" onClick={handleNext}>
            Next: Review & Launch
          </ActionButton>
        }
      />
    </div>
  );
}
