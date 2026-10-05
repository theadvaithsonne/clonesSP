// src/models/eventRegistrationForm.model.ts
//
// The registration form an organizer builds for one event.
//
// Standard fields (name, email, phone, company, job title, country) already
// exist on `eventRegistration.attendee` — they are represented here so the
// organizer can reorder them, relabel them and toggle whether they're
// required, but their answers still land in the typed attendee subdocument.
// Custom and consent fields have nowhere typed to go, so their answers are
// stored as `eventRegistration.answers` keyed by field key.
//
// One form per event: a second form would mean two sources of truth for what
// a buyer was asked, and no way to read a registration back consistently.

import { Schema, model, Document, Types } from "mongoose";

/** Everything the field library can drop onto the canvas. */
export const FORM_FIELD_TYPES = [
  // Standard — answers map onto `attendee`.
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "job_title",
  "country",
  // Custom — answers land in `answers`.
  "short_text",
  "long_text",
  "dropdown",
  "multi_select",
  // Consent — answers land in `answers` as booleans.
  "terms",
  "marketing_opt_in",
  "photo_consent",
] as const;

export type EventFormFieldType = (typeof FORM_FIELD_TYPES)[number];

/**
 * A single "show this field if …" rule.
 *
 * Only ticket type is supported as a source today, because it is the one
 * thing known before the form is filled in. `values` holds tier ids.
 */
export interface IEventFormCondition {
  source: "ticket_type";
  operator: "is" | "is_not";
  values: string[];
}

export interface IEventFormField {
  /** Stable key. Answers are stored against this, so it must never change. */
  key: string;
  type: EventFormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  /** Print this answer on the attendee badge. */
  showOnBadge: boolean;
  /** Optional Deals field to copy the answer into, e.g. `deal.track_interest`. */
  mapToDealsField?: string;
  /** Choices for dropdown / multi_select. */
  options: string[];
  /** All rules must pass for the field to show. Empty means always shown. */
  conditions: IEventFormCondition[];
  order: number;
}

export interface IEventRegistrationForm extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  title: string;
  description?: string;
  fields: IEventFormField[];
  createdAt: Date;
  updatedAt: Date;
}

const ConditionSchema = new Schema<IEventFormCondition>(
  {
    source: { type: String, enum: ["ticket_type"], default: "ticket_type" },
    operator: { type: String, enum: ["is", "is_not"], default: "is" },
    values: [{ type: String }],
  },
  { _id: false }
);

const FieldSchema = new Schema<IEventFormField>(
  {
    key: { type: String, required: true, trim: true },
    type: { type: String, enum: FORM_FIELD_TYPES, required: true },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    placeholder: { type: String, trim: true, maxlength: 200 },
    helpText: { type: String, trim: true, maxlength: 300 },
    required: { type: Boolean, default: false },
    showOnBadge: { type: Boolean, default: false },
    mapToDealsField: { type: String, trim: true, maxlength: 120 },
    options: [{ type: String, trim: true, maxlength: 200 }],
    conditions: { type: [ConditionSchema], default: [] },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const EventRegistrationFormSchema = new Schema<IEventRegistrationForm>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      unique: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 200, default: "" },
    description: { type: String, trim: true, maxlength: 500 },
    fields: { type: [FieldSchema], default: [] },
  },
  { timestamps: true, collection: "event_registration_forms" }
);

export const EventRegistrationForm = model<IEventRegistrationForm>(
  "EventRegistrationForm",
  EventRegistrationFormSchema
);

/**
 * Which attendee property a standard field writes to. Custom and consent
 * fields return null — their answers go to `answers`.
 */
export const ATTENDEE_FIELD_MAP: Partial<
  Record<EventFormFieldType, "name" | "email" | "phone" | "company" | "jobTitle" | "country">
> = {
  first_name: "name",
  last_name: "name",
  email: "email",
  phone: "phone",
  company: "company",
  job_title: "jobTitle",
  country: "country",
};

/**
 * The form every event starts with: exactly the fields the checkout already
 * collected before the builder existed, so an organizer who never opens it
 * sees no change.
 */
export function defaultFormFields(): IEventFormField[] {
  const base: Array<[EventFormFieldType, string, string, boolean]> = [
    ["first_name", "First name", "Enter first name", true],
    ["last_name", "Last name", "Enter last name", true],
    ["email", "Email address", "you@example.com", true],
    ["phone", "Phone number", "Enter mobile number", false],
    ["company", "Company / Organization", "Company name", false],
    ["job_title", "Job title", "Your role", false],
  ];
  return base.map(([type, label, placeholder, required], order) => ({
    key: type,
    type,
    label,
    placeholder,
    required,
    showOnBadge: type === "first_name" || type === "last_name" || type === "company",
    options: [],
    conditions: [],
    order,
  }));
}
