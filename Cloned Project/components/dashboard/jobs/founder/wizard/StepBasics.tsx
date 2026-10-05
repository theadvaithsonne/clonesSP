"use client";

// A3 · Step 1 — Basics: title, department, openings, employment type,
// workplace, locations, experience, joining and salary, with a live card.

import React from "react";
import { Plus } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { CURRENCIES, EMPLOYMENT_LABELS } from "../../constants";
import { Card, Chip, CustomSelect, GOLD, Label, SwitchControl, TextInput } from "../../ui";
import type { EmploymentType, WorkplaceType } from "../../types";
import type { StepProps } from "./JobWizard";
import { JobCardPreview } from "./JobPreviewModal";

export function StepHeading({ step, title, subtitle, right }: { step: number; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
          Step {step} of 6
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#7c7d94]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const JOINING_OPTIONS = ["Immediately", "Within 15 days", "Within 30 days", "Within 60 days", "Within 90 days", "Flexible"];

const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)));

export default function StepBasics({ job, detail, update }: StepProps) {
  // Country → State → City cascade (country-state-city), mirroring the location
  // picker in the user profile. A location is stored as a readable
  // "City, State, Country" string, omitting parts that weren't picked.
  const [country, setCountry] = React.useState(""); // ISO code
  const [stateCode, setStateCode] = React.useState(""); // ISO code
  const [city, setCity] = React.useState("");

  const countryOptions = React.useMemo<SearchableOption[]>(
    () =>
      Country.getAllCountries().map((c) => ({
        value: c.isoCode,
        label: c.name,
        keywords: c.isoCode,
      })),
    []
  );
  const stateOptions = React.useMemo<SearchableOption[]>(
    () =>
      country
        ? State.getStatesOfCountry(country).map((s) => ({ value: s.isoCode, label: s.name }))
        : [],
    [country]
  );
  const cityOptions = React.useMemo<SearchableOption[]>(
    () =>
      country && stateCode
        ? City.getCitiesOfState(country, stateCode).map((c) => ({ value: c.name, label: c.name }))
        : [],
    [country, stateCode]
  );

  const addLocation = () => {
    const countryName = country ? Country.getCountryByCode(country)?.name ?? "" : "";
    const stateName =
      country && stateCode ? State.getStateByCodeAndCountry(stateCode, country)?.name ?? "" : "";
    const label = [city, stateName, countryName].filter(Boolean).join(", ");
    if (!label || job.locations.includes(label)) return;
    update({ locations: [...job.locations, label] });
    // Keep country + state so adding another city in the same region is quick.
    setCity("");
  };

  const workplaceCards: Array<{ value: WorkplaceType; title: string; sub: string }> = [
    { value: "hybrid", title: "Hybrid", sub: job.officeDays ? `${job.officeDays} days in office` : "Part office, part remote" },
    { value: "remote", title: "Remote", sub: "Work from anywhere" },
    { value: "onsite", title: "On-site", sub: "Office based" },
  ];

  return (
    <div className="grid gap-8 px-8 py-6 xl:grid-cols-[minmax(0,48rem)_360px]">
      <div className="max-w-3xl space-y-6">
        <StepHeading step={1} title="Job basics" subtitle="Start with the essentials candidates scan first." />

        <TextInput
          label="Job title"
          required
          hint="Candidates often search for this exact title."
          value={job.title}
          maxLength={160}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. Senior Product Designer"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Department"
            value={job.department || ""}
            maxLength={80}
            onChange={(e) => update({ department: e.target.value })}
            placeholder="e.g. Design"
          />
          <TextInput
            label="Openings"
            type="number"
            min={1}
            max={500}
            value={job.openings}
            onChange={(e) => update({ openings: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })}
          />
        </div>

        <div>
          <Label>Employment type</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((t) => (
              <Chip key={t} active={job.employmentType === t} onClick={() => update({ employmentType: t })}>
                {EMPLOYMENT_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label>Workplace</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {workplaceCards.map((w) => {
              const active = job.workplace === w.value;
              return (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => update({ workplace: w.value })}
                  className="rounded-xl border px-4 py-3 text-left transition-colors"
                  style={
                    active
                      ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)" }
                      : { borderColor: "#262626", background: "#1A1A1A" }
                  }
                >
                  <div className="text-sm font-medium text-white">{w.title}</div>
                  <div className="mt-0.5 text-xs text-[#7c7d94]">{w.sub}</div>
                </button>
              );
            })}
          </div>
          {job.workplace === "hybrid" && (
            <div className="mt-3 flex items-center gap-3 text-sm text-[#c7c7da]">
              Days in office per week
              <input
                type="number"
                min={1}
                max={7}
                value={job.officeDays ?? ""}
                onChange={(e) => update({ officeDays: numOrNull(e.target.value) })}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-20 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white outline-none focus:border-brand"
              />
            </div>
          )}
        </div>

        <div>
          <Label hint={job.workplace === "remote" ? "Optional for remote roles" : undefined}>Location</Label>
          <div className="flex flex-wrap items-center gap-2">
            {job.locations.map((l) => (
              <Chip key={l} onRemove={() => update({ locations: job.locations.filter((x) => x !== l) })}>
                {l}
              </Chip>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <SearchableSelect
                  options={countryOptions}
                  value={country}
                  onSelect={(v) => {
                    setCountry(v);
                    setStateCode("");
                    setCity("");
                  }}
                  placeholder="Country"
                  emptyText="No countries"
                />
              </div>
              <div className="w-40">
                <SearchableSelect
                  options={stateOptions}
                  value={stateCode}
                  onSelect={(v) => {
                    setStateCode(v);
                    setCity("");
                  }}
                  placeholder={country ? "State" : "Pick country first"}
                  emptyText="No states for this country"
                />
              </div>
              <div className="w-40">
                <SearchableSelect
                  options={cityOptions}
                  value={city}
                  onSelect={setCity}
                  placeholder={stateCode ? "City (optional)" : "Pick state first"}
                  emptyText="No cities for this state"
                />
              </div>
              <button
                type="button"
                onClick={addLocation}
                disabled={!country}
                className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40"
                style={{ color: GOLD }}
              >
                <Plus className="h-3.5 w-3.5" /> Add location
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput
            label="Experience from (years)"
            type="number"
            min={0}
            max={60}
            value={job.experienceMin ?? ""}
            onChange={(e) => update({ experienceMin: numOrNull(e.target.value) })}
          />
          <TextInput
            label="To (years)"
            type="number"
            min={0}
            max={60}
            value={job.experienceMax ?? ""}
            onChange={(e) => update({ experienceMax: numOrNull(e.target.value) })}
          />
          <CustomSelect
            label="Joining"
            value={job.joining || ""}
            onChange={(v) => update({ joining: v })}
            placeholder="Select…"
            options={JOINING_OPTIONS.map((o) => ({ value: o, label: o }))}
          />
        </div>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white">Salary range</div>
              <div className="text-xs text-[#7c7d94]">Roles that show pay tend to get more applications.</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#c7c7da]">
              Show salary
              <SwitchControl checked={job.salary.show} onChange={(v) => update({ salary: { show: v } })} aria-label="Show salary" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <CustomSelect
              label="Currency"
              value={job.salary.currency || "USD"}
              onChange={(v) => update({ salary: { currency: v } })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <TextInput
              label="Minimum"
              type="number"
              min={0}
              value={job.salary.min ?? ""}
              onChange={(e) => update({ salary: { min: numOrNull(e.target.value) } })}
            />
            <TextInput
              label="Maximum"
              type="number"
              min={0}
              value={job.salary.max ?? ""}
              onChange={(e) => update({ salary: { max: numOrNull(e.target.value) } })}
            />
            <CustomSelect
              label="Per"
              value={job.salary.period || "year"}
              onChange={(v) => update({ salary: { period: v as "year" | "month" | "hour" } })}
              options={[
                { value: "year", label: "Year" },
                { value: "month", label: "Month" },
                { value: "hour", label: "Hour" },
              ]}
            />
          </div>
        </Card>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Live preview</h3>
          <span className="text-xs text-[#22c55e]">Updates live</span>
        </div>
        <JobCardPreview
          job={job}
          org={detail.org}
          footer={
            <>
              {job.status === "draft" ? "Draft" : "Live"} · {job.openings} opening{job.openings === 1 ? "" : "s"}
              {job.joining ? ` · Joining ${job.joining.toLowerCase()}` : ""}
            </>
          }
        />
        <p className="text-xs text-[#61627a]">This is how the role appears on Garage Jobs.</p>
      </aside>
    </div>
  );
}
