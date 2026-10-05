"use client";

// A13 · Schedule interview: round, interviewers, up to six time slots (sent as
// a fixed time, or offered for the candidate to pick), duration, mode. Video
// interviews get a Garage meeting link created automatically.

import React from "react";
import { Plus, Video, X } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import {
  Avatar,
  Button,
  Chip,
  CustomSelect,
  Label,
  Modal,
  TextArea,
  TextInput,
  Toggle,
  errorMessage,
  fromLocalInput,
  toLocalInput,
  useLoad,
} from "../../ui";
import type { Stage, TeamMember } from "../../types";

function nextHalfHour(offsetDays = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(11, 0, 0, 0);
  return toLocalInput(d);
}

export default function ScheduleInterviewModal({
  open,
  applicationId,
  candidateName,
  jobTitle,
  stages,
  currentStageId,
  team,
  onClose,
  onDone,
}: {
  open: boolean;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  stages: Stage[];
  currentStageId: string;
  team: TeamMember[];
  onClose: () => void;
  onDone: () => void;
}) {
  const members = useLoad(() => (open ? jobsApi.getOfficeMembers() : Promise.resolve([])), [open]);
  const interviewStages = stages.filter((s) => s.category === "interview");
  const [stageId, setStageId] = React.useState("");
  const [interviewers, setInterviewers] = React.useState<string[]>([]);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [candidatePicks, setCandidatePicks] = React.useState(false);
  const [duration, setDuration] = React.useState("45");
  const [mode, setMode] = React.useState<"video" | "in_person" | "phone">("video");
  const [location, setLocation] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const current = stages.find((s) => s.id === currentStageId);
    setStageId(current?.category === "interview" ? current.id : interviewStages[0]?.id || "");
    setInterviewers(team.filter((t) => t.role !== "recruiter").slice(0, 1).map((t) => t.userId));
    setSlots([nextHalfHour(1)]);
    setCandidatePicks(false);
    setDuration("45");
    setMode("video");
    setLocation("");
    setMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const people = members.data || [];
  const nameOf = (id: string) => people.find((m) => m._id === id)?.name || "Member";
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  const submit = async () => {
    const iso = slots.map((s) => fromLocalInput(s)).filter(Boolean) as string[];
    if (!interviewers.length) return toast.error("Pick at least one interviewer.");
    if (!iso.length) return toast.error("Add a time.");
    if (iso.some((t) => new Date(t) <= new Date())) return toast.error("Interview times must be in the future.");
    setBusy(true);
    try {
      await jobsApi.scheduleInterview(applicationId, {
        stageId: stageId || undefined,
        interviewerIds: interviewers,
        mode,
        durationMin: Number(duration),
        slots: candidatePicks ? iso : iso.slice(0, 1),
        candidatePicks,
        location: mode === "in_person" ? location || undefined : undefined,
        message: message || undefined,
        timezone,
      });
      toast.success(candidatePicks ? `${iso.length} slots sent to ${candidateName}` : `Invite sent to ${candidateName}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't schedule the interview."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule interview"
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Send invite
          </Button>
        </>
      }
    >
      <p className="-mt-2 text-sm text-[#7c7d94]">
        {candidateName} · {jobTitle}
      </p>
      {interviewStages.length > 0 && (
        <CustomSelect
          label="Round"
          value={stageId}
          onChange={setStageId}
          options={interviewStages.map((s) => ({ value: s.id, label: s.name }))}
        />
      )}
      <div>
        <Label>Interviewers</Label>
        <div className="flex flex-wrap items-center gap-2">
          {interviewers.map((id) => (
            <Chip key={id} onRemove={() => setInterviewers(interviewers.filter((x) => x !== id))}>
              {nameOf(id)}
            </Chip>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && setInterviewers([...interviewers, e.target.value])}
            className="rounded-lg border border-[#262626] bg-[#1A1A1A] px-2 py-1 text-xs text-[#c7c7da] outline-none [&>option]:bg-[#1A1A1A]"
          >
            <option value="">+ Add interviewer</option>
            {people
              .filter((m) => !interviewers.includes(m._id))
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                  {team.some((t) => t.userId === m._id) ? " · hiring team" : ""}
                </option>
              ))}
          </select>
        </div>
        {!!interviewers.length && (
          <div className="mt-2 flex -space-x-2">
            {interviewers.map((id) => (
              <Avatar key={id} name={nameOf(id)} src={people.find((m) => m._id === id)?.profilePicture} size={24} />
            ))}
          </div>
        )}
      </div>

      <Toggle
        checked={candidatePicks}
        onChange={setCandidatePicks}
        label="Let the candidate pick a slot"
        description={candidatePicks ? `They choose from the ${slots.length} time${slots.length === 1 ? "" : "s"} you offer.` : "Send one fixed time."}
      />

      <div>
        <Label hint={timezone ? `Your time zone · ${timezone}` : undefined}>{candidatePicks ? "Time slots (up to 6)" : "Date & time"}</Label>
        <div className="space-y-2">
          {(candidatePicks ? slots : slots.slice(0, 1)).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={s}
                onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}
                className="flex-1 rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
              />
              {candidatePicks && slots.length > 1 && (
                <button type="button" onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="text-[#61627a] hover:text-[#f87171]" aria-label="Remove slot">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {candidatePicks && slots.length < 6 && (
            <button
              type="button"
              onClick={() => setSlots([...slots, slots[slots.length - 1] || nextHalfHour(1)])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand"
            >
              <Plus className="h-3.5 w-3.5" /> Add slot
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CustomSelect
          label="Duration"
          value={duration}
          onChange={setDuration}
          options={["30", "45", "60", "90"].map((d) => ({ value: d, label: `${d} min` }))}
        />
        <div>
          <Label>Mode</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["video", "Video"],
                ["in_person", "In person"],
                ["phone", "Phone"],
              ] as const
            ).map(([v, l]) => (
              <Chip key={v} active={mode === v} onClick={() => setMode(v)}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      {mode === "video" && (
        <p className="flex items-center gap-2 text-xs text-[#7c7d94]">
          <Video className="h-3.5 w-3.5" /> A Garage meeting link is created automatically and added to the invite.
        </p>
      )}
      {mode === "in_person" && (
        <TextInput label="Location" value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} placeholder="Office address, floor, room" />
      )}
      <TextArea label="Message to the candidate" rows={3} value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} placeholder="Optional — what to prepare, who they'll meet" />
    </Modal>
  );
}
