"use client";

// The organizer's registration form, rendered light for the checkout page.
//
// Standard field types write into the typed `attendee` record the checkout API
// expects; everything else answers into the free-form `answers` bag keyed by
// field key. The split matters: the server validates `answers` against the
// form config and drops anything it didn't ask for, so a custom question can
// only be stored if it came from the builder.

import React from "react";
import { ChevronDown } from "lucide-react";
import type {
  EventFormField,
  EventFormFieldType,
} from "@/components/dashboard/inlineApps/events/types";
import type { AttendeeInput } from "@/components/dashboard/inlineApps/events/api";
import { C, DEFAULT_ACCENT } from "./ui";

export type Attendee = AttendeeInput;

/** Consent fields answer with a boolean and render as a checkbox. */
export const CONSENT_TYPES: EventFormFieldType[] = [
  "terms",
  "marketing_opt_in",
  "photo_consent",
];

/** Standard fields write into the typed attendee record rather than `answers`. */
export const ATTENDEE_KEYS: Partial<Record<EventFormFieldType, keyof Attendee>> = {
  email: "email",
  phone: "phone",
  company: "company",
  job_title: "jobTitle",
  country: "country",
};

/**
 * First and last name are edited separately and joined into the one `name` the
 * registration stores. They cannot share an attendee key: two inputs bound to
 * `name` mirror each other keystroke for keystroke.
 */
export const NAME_PART: Partial<Record<EventFormFieldType, "first" | "last">> = {
  first_name: "first",
  last_name: "last",
};

export type NameParts = { first: string; last: string };

export const joinName = (parts: NameParts) =>
  [parts.first.trim(), parts.last.trim()].filter(Boolean).join(" ");

/** Wide fields take the whole row; the rest pair up two to a row. */
export function fieldSpansRow(field: EventFormField) {
  return (
    field.type === "long_text" ||
    field.type === "multi_select" ||
    CONSENT_TYPES.includes(field.type)
  );
}

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[#b6b7c2] focus:border-[#15151a]";

export function FormFieldInput({
  field,
  accent = DEFAULT_ACCENT,
  attendee,
  answers,
  nameParts,
  onAttendee,
  onNamePart,
  onAnswer,
  onCountryBlur,
}: {
  field: EventFormField;
  accent?: string;
  attendee: Attendee;
  answers: Record<string, unknown>;
  nameParts: NameParts;
  onAttendee: (patch: Partial<Attendee>) => void;
  onNamePart: (part: "first" | "last", value: string) => void;
  onAnswer: (value: unknown) => void;
  onCountryBlur: () => void;
}) {
  const style = { borderColor: C.border, color: C.ink } as React.CSSProperties;

  // ── Consent ────────────────────────────────────────────────────────────
  if (CONSENT_TYPES.includes(field.type)) {
    const checked = answers[field.key] === true;
    return (
      <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5">
        <span
          onClick={() => onAnswer(!checked)}
          className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors"
          style={
            checked
              ? { background: accent, borderColor: accent }
              : { borderColor: "#c9cad4" }
          }
        >
          {checked && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.8"
                stroke="#141418"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span onClick={() => onAnswer(!checked)} style={{ color: C.body }}>
          {field.label}
          {field.required && <span className="ml-1" style={{ color: C.red }}>*</span>}
        </span>
      </label>
    );
  }

  const labelEl = (
    <label
      className="mb-1.5 block text-[12px] font-medium"
      style={{ color: C.body }}
    >
      {field.label}
      {field.required && <span className="ml-1" style={{ color: C.red }}>*</span>}
    </label>
  );
  const helpEl = field.helpText ? (
    <p className="mt-1 text-[11px]" style={{ color: C.faint }}>
      {field.helpText}
    </p>
  ) : null;

  // ── Name ───────────────────────────────────────────────────────────────
  const namePart = NAME_PART[field.type];
  if (namePart) {
    return (
      <div>
        {labelEl}
        <input
          type="text"
          autoComplete={namePart === "first" ? "given-name" : "family-name"}
          value={nameParts[namePart]}
          onChange={(e) => onNamePart(namePart, e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
          style={style}
        />
        {helpEl}
      </div>
    );
  }

  // ── Standard ───────────────────────────────────────────────────────────
  const attendeeKey = ATTENDEE_KEYS[field.type];
  if (attendeeKey) {
    return (
      <div>
        {labelEl}
        <input
          type={field.type === "email" ? "email" : "text"}
          value={(attendee[attendeeKey] as string) || ""}
          onChange={(e) => onAttendee({ [attendeeKey]: e.target.value })}
          onBlur={field.type === "country" ? onCountryBlur : undefined}
          placeholder={field.placeholder}
          className={inputClass}
          style={style}
        />
        {helpEl}
      </div>
    );
  }

  // ── Custom ─────────────────────────────────────────────────────────────
  if (field.type === "long_text") {
    return (
      <div>
        {labelEl}
        <textarea
          rows={3}
          value={(answers[field.key] as string) || ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={field.placeholder}
          className={`${inputClass} resize-y`}
          style={style}
        />
        {helpEl}
      </div>
    );
  }

  if (field.type === "dropdown") {
    return (
      <div>
        {labelEl}
        <div className="relative">
          <select
            value={(answers[field.key] as string) || ""}
            onChange={(e) => onAnswer(e.target.value)}
            className={`${inputClass} appearance-none pr-9`}
            style={style}
          >
            <option value="">{field.placeholder || "Select…"}</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: C.faint }}
          />
        </div>
        {helpEl}
      </div>
    );
  }

  if (field.type === "multi_select") {
    const chosen = Array.isArray(answers[field.key])
      ? (answers[field.key] as string[])
      : [];
    return (
      <div>
        {labelEl}
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => {
            const on = chosen.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onAnswer(on ? chosen.filter((c) => c !== o) : [...chosen, o])
                }
                className="rounded-full border px-3 py-1.5 text-xs transition-colors"
                style={
                  on
                    ? { background: accent, borderColor: accent, color: "#141418" }
                    : { borderColor: C.border, color: C.body }
                }
              >
                {o}
              </button>
            );
          })}
        </div>
        {helpEl}
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <input
        value={(answers[field.key] as string) || ""}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder={field.placeholder}
        className={inputClass}
        style={style}
      />
      {helpEl}
    </div>
  );
}
