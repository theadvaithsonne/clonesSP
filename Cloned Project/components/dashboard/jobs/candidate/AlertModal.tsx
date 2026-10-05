"use client";

// Create or edit a job alert: what to match (same criteria as Discover) and
// how often to email. Matching runs on the server with the same rules as the
// Discover search, so an alert finds exactly what that search shows.

import React from "react";
import { toast } from "sonner";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "../constants";
import { Button, Chip, Label, Modal, TextInput, errorMessage } from "../ui";
import type { EmploymentType, WorkplaceType } from "../types";
import * as candidateApi from "./candidateApi";
import type { AlertCriteria, AlertFrequency, JobAlert } from "./candidateTypes";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function frequencyLabel(alert: Pick<JobAlert, "frequency" | "weekday">): string {
  if (alert.frequency === "instant") return "Instant";
  if (alert.frequency === "daily") return "Daily";
  return `Weekly · ${WEEKDAYS[typeof alert.weekday === "number" ? alert.weekday : 1]}`;
}

export function criteriaSummary(c: AlertCriteria): string {
  const bits = [
    c.q,
    c.location,
    ...(c.workplace || []).map((w) => WORKPLACE_LABELS[w]),
    ...(c.employmentType || []).map((e) => EMPLOYMENT_LABELS[e]),
    c.department,
    typeof c.experience === "number" ? `${c.experience}+ yrs experience` : "",
    c.salaryMin ? `pays ${c.salaryMin.toLocaleString()}+` : "",
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Every new role on Garage Jobs";
}

export default function AlertModal({
  open,
  onClose,
  initial,
  alert,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Prefill for a new alert (e.g. the current Discover search). */
  initial?: AlertCriteria;
  /** Editing an existing alert. */
  alert?: JobAlert | null;
  onSaved: (alert: JobAlert) => void;
}) {
  const [name, setName] = React.useState("");
  const [q, setQ] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [workplace, setWorkplace] = React.useState<WorkplaceType[]>([]);
  const [employmentType, setEmploymentType] = React.useState<EmploymentType[]>([]);
  const [experience, setExperience] = React.useState("");
  const [salaryMin, setSalaryMin] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [frequency, setFrequency] = React.useState<AlertFrequency>("daily");
  const [weekday, setWeekday] = React.useState(1);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const c = alert?.criteria || initial || {};
    setName(alert?.name || "");
    setQ(c.q || "");
    setLocation(c.location || "");
    setWorkplace(c.workplace || []);
    setEmploymentType(c.employmentType || []);
    setExperience(typeof c.experience === "number" ? String(c.experience) : "");
    setSalaryMin(c.salaryMin ? String(c.salaryMin) : "");
    setDepartment(c.department || "");
    setFrequency(alert?.frequency || "daily");
    setWeekday(typeof alert?.weekday === "number" ? alert.weekday : 1);
  }, [open, alert, initial]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    const criteria: AlertCriteria = {
      q: q.trim() || undefined,
      location: location.trim() || undefined,
      workplace: workplace.length ? workplace : undefined,
      employmentType: employmentType.length ? employmentType : undefined,
      experience: experience.trim() === "" ? undefined : Math.max(0, Number(experience) || 0),
      salaryMin: salaryMin.trim() === "" ? undefined : Math.max(0, Number(salaryMin) || 0) || undefined,
      department: department.trim() || undefined,
    };
    setBusy(true);
    try {
      const payload = {
        name: name.trim() || undefined,
        criteria,
        frequency,
        ...(frequency === "weekly" ? { weekday } : {}),
      };
      const res = alert ? await candidateApi.updateAlert(alert._id, { ...payload, name: name.trim() }) : await candidateApi.createAlert(payload);
      toast.success(alert ? "Alert updated" : "Alert created — we'll email you when a matching role goes live");
      onSaved(res.alert);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the alert."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={alert ? "Edit job alert" : "Create job alert"}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {alert ? "Save alert" : "Create alert"}
          </Button>
        </>
      }
    >
      <TextInput label="Name" hint="Optional" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product design roles in Bengaluru" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Title, skill or company" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} />
        <TextInput label="Location" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} hint="Remote roles always match" />
      </div>
      <div>
        <Label>Workplace</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WORKPLACE_LABELS) as WorkplaceType[]).map((w) => (
            <Chip key={w} active={workplace.includes(w)} onClick={() => setWorkplace(toggle(workplace, w))}>
              {WORKPLACE_LABELS[w]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <Label>Job type</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((t) => (
            <Chip key={t} active={employmentType.includes(t)} onClick={() => setEmploymentType(toggle(employmentType, t))}>
              {EMPLOYMENT_LABELS[t]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput label="My experience (yrs)" type="number" min={0} max={60} value={experience} onChange={(e) => setExperience(e.target.value)} />
        <TextInput label="Minimum pay" type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} hint="Job's currency" />
        <TextInput label="Department" value={department} maxLength={80} onChange={(e) => setDepartment(e.target.value)} />
      </div>
      <div>
        <Label>How often</Label>
        <div className="flex flex-wrap gap-2">
          {(["instant", "daily", "weekly"] as AlertFrequency[]).map((f) => (
            <Chip key={f} active={frequency === f} onClick={() => setFrequency(f)}>
              {f === "instant" ? "Instant" : f === "daily" ? "Daily" : "Weekly"}
            </Chip>
          ))}
        </div>
        {frequency === "weekly" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <Chip key={d} active={weekday === i} onClick={() => setWeekday(i)}>
                {d.slice(0, 3)}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-[#7c7d94]">Alerts arrive by email, only when new roles match. You can pause or delete them any time.</p>
    </Modal>
  );
}
