import { Types } from "mongoose";
import { z } from "zod";
import {
  GarageUniversityOnboarding,
  IOnboardingFile,
} from "../models/garageUniversityOnboarding.model";
import { User } from "../models/user.model";

/**
 * Garage University onboarding profiles: checking what a client sends, and
 * reading / creating / editing the signed-in user's own profile. Ported from
 * the standalone Garage University backend so the app's answers keep the same
 * shape and limits.
 *
 * Every function is keyed by the caller's userId (from requireAuth) — there
 * is no way to address someone else's profile.
 */

// ── Limits ──────────────────────────────────────────────────────────────
// Generous, well above anything the onboarding form produces, so they only
// stop abuse. The values themselves are the app's call.

export const ONBOARDING_LIMITS = {
  /** goal, headline, location, status */
  TEXT_MAX: 1000,
  /** interests, topics, workModes */
  LIST_MAX_ITEMS: 50,
  LIST_ITEM_MAX: 200,
  /** details: an open map of strings */
  DETAILS_MAX_KEYS: 30,
  DETAILS_KEY_MAX: 50,
  DETAILS_VALUE_MAX: 1000,
  /** photo, resume.url, idCard.url */
  URL_MAX: 2048,
  /** resume.name, idCard.name */
  FILE_NAME_MAX: 255,
  /** resume.size, idCard.size — bytes; the files themselves live in S3 */
  FILE_SIZE_MAX: 100 * 1024 * 1024,
  STEP_MAX: 100,
} as const;

const L = ONBOARDING_LIMITS;

/** Fields a client may send. Everything else (userId, email, timestamps…) is the server's. */
export const ONBOARDING_WRITABLE_FIELDS = [
  "orgId",
  "step",
  "interests",
  "goal",
  "topics",
  "status",
  "details",
  "idCard",
  "photo",
  "headline",
  "location",
  "workModes",
  "resume",
  "completed",
] as const;

// ── Errors ──────────────────────────────────────────────────────────────

/** An error the API reports as-is: `{ success: false, error, code, ...extra }` with `status`. */
export class OnboardingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

const notFound = () => new OnboardingError(404, "ONBOARDING_NOT_FOUND", "Onboarding profile not found");
const alreadyExists = () =>
  new OnboardingError(409, "ONBOARDING_EXISTS", "Onboarding profile already exists — use PATCH to change it");

// ── Validation ──────────────────────────────────────────────────────────

const text = (max: number) =>
  z.string({ error: "must be a string" }).max(max, `can be at most ${max} characters`);

const textList = z
  .array(text(L.LIST_ITEM_MAX), { error: "must be an array of strings" })
  .max(L.LIST_MAX_ITEMS, `can have at most ${L.LIST_MAX_ITEMS} items`);

/** Photo and file links end up in an <img> or <a>, so only https — never `javascript:`. */
const httpsUrl = text(L.URL_MAX).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "must be a valid https URL");

const file = z
  .object(
    {
      url: httpsUrl,
      name: text(L.FILE_NAME_MAX),
      size: z
        .number({ error: "must be a number of bytes" })
        .int("must be a whole number of bytes")
        .min(0, "can't be negative")
        .max(L.FILE_SIZE_MAX, `can be at most ${L.FILE_SIZE_MAX} bytes`),
    },
    { error: "must be an object with url, name and size, or null" }
  )
  .strict()
  .nullable();

// Each key becomes a `details.<key>` update path, which can't be empty, hold a "." or start with "$".
const detailKey = z
  .string()
  .min(1, "keys can't be empty")
  .max(L.DETAILS_KEY_MAX, `keys can be at most ${L.DETAILS_KEY_MAX} characters`)
  .refine((key) => !key.includes(".") && !key.startsWith("$"), "keys can't contain '.' or start with '$'");

const details = z
  .record(detailKey, text(L.DETAILS_VALUE_MAX), { error: "must be an object of strings" })
  .refine((value) => Object.keys(value).length <= L.DETAILS_MAX_KEYS, `can have at most ${L.DETAILS_MAX_KEYS} keys`);

const onboardingPatchSchema = z
  .object({
    /** The organisation the profile belongs to (the Garage University app sends its own). Create only. */
    orgId: z.string({ error: "must be a string" }).regex(/^[a-f0-9]{24}$/i, "must be a valid organisation id"),
    step: z
      .number({ error: "must be a number" })
      .int("must be a whole number")
      .min(0, `must be from 0 to ${L.STEP_MAX}`)
      .max(L.STEP_MAX, `must be from 0 to ${L.STEP_MAX}`),
    // step 1 and 2
    interests: textList,
    goal: text(L.TEXT_MAX),
    topics: textList,
    // step 3
    status: text(L.TEXT_MAX).nullable(),
    details,
    idCard: file,
    // step 4: Quick Profile Builder
    photo: httpsUrl.nullable(),
    headline: text(L.TEXT_MAX),
    location: text(L.TEXT_MAX),
    workModes: textList,
    resume: file,
    completed: z.literal(true, { error: "can only be set to true" }),
  })
  .partial();

export type OnboardingPatch = z.infer<typeof onboardingPatchSchema>;

/** "interests[2]", "details.country", "resume.url". */
const fieldPath = (path: PropertyKey[]) =>
  path.reduce<string>(
    (out, key) => (typeof key === "number" ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)),
    ""
  );

/**
 * Check a POST / PATCH body and return the values to store, exactly as sent.
 * Only the keys present come back (so PATCH changes only what was sent).
 * Throws a 400 OnboardingError for a body that isn't an object, an unknown or
 * read-only field, or a value of the wrong type or over its limit.
 */
export function parseOnboardingPatch(body: unknown): OnboardingPatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OnboardingError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  const unknown = Object.keys(body).filter((key) => !(ONBOARDING_WRITABLE_FIELDS as readonly string[]).includes(key));
  if (unknown.length) {
    throw new OnboardingError(400, "UNKNOWN_FIELD", `Unknown or read-only fields: ${unknown.join(", ")}`, {
      fields: unknown,
    });
  }

  const result = onboardingPatchSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = fieldPath(issue.path) || "body";
    throw new OnboardingError(400, "INVALID_FIELD", `${field} ${issue.message}`, { field });
  }
  return result.data;
}

// ── Responses ───────────────────────────────────────────────────────────

export interface OnboardingResponse {
  id: string;
  userId: string;
  orgId: string | null;
  email: string;
  name: string;
  step: number;
  interests: string[];
  goal: string;
  topics: string[];
  status: string | null;
  details: Record<string, string>;
  idCard: IOnboardingFile | null;
  photo: string | null;
  headline: string;
  location: string;
  workModes: string[];
  resume: IOnboardingFile | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : null);

const fileOut = (value: any): IOnboardingFile | null =>
  value && typeof value === "object" ? { url: value.url, name: value.name, size: value.size } : null;

/** A stored profile as the API returns it. */
export function toOnboardingResponse(doc: any): OnboardingResponse {
  const detailsOut: Record<string, string> =
    doc.details instanceof Map ? Object.fromEntries(doc.details) : { ...(doc.details || {}) };
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    orgId: doc.orgId ? String(doc.orgId) : null,
    email: doc.email || "",
    name: doc.name || "",
    step: typeof doc.step === "number" ? doc.step : 0,
    interests: doc.interests || [],
    goal: doc.goal || "",
    topics: doc.topics || [],
    status: doc.status ?? null,
    details: detailsOut,
    idCard: fileOut(doc.idCard),
    photo: doc.photo ?? null,
    headline: doc.headline || "",
    location: doc.location || "",
    workModes: doc.workModes || [],
    resume: fileOut(doc.resume),
    completed: doc.completed === true,
    completedAt: iso(doc.completedAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

// ── Indexes ─────────────────────────────────────────────────────────────

let indexesReady: Promise<void> | null = null;

/**
 * Build the unique userId index once per process. Prod connects with
 * autoIndex off, so without this the index would wait for a manual
 * `indexes:sync`. A failure (e.g. missing privileges) is logged and not
 * retried — the writes below stay correct without it, just less race-proof.
 */
export function ensureOnboardingIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = GarageUniversityOnboarding.createIndexes()
      .then(() => undefined)
      .catch((err: any) => {
        console.warn("[GU onboarding] Couldn't build the onboarding indexes:", err?.message || err);
      });
  }
  return indexesReady;
}

// ── Read / create / edit ────────────────────────────────────────────────

export interface OnboardingCaller {
  userId: string;
  email?: string;
}

/** Profiles are addressed by the account's id; a malformed one can't have a profile. */
function userObjectId(userId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(userId)) throw notFound();
  return new Types.ObjectId(userId);
}

/**
 * The caller's profile, or null when they haven't started onboarding — a
 * normal state for a new user, not an error.
 */
export async function getOnboarding(userId: string): Promise<OnboardingResponse | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const doc = await GarageUniversityOnboarding.findOne({ userId: new Types.ObjectId(userId) }).lean();
  return doc ? toOnboardingResponse(doc) : null;
}

/**
 * Create the caller's profile, optionally with answers. One per user: an
 * atomic upsert that only inserts, so a second create is a 409 — even before
 * the unique index exists, and even when two requests race.
 */
export async function createOnboarding(caller: OnboardingCaller, body: unknown): Promise<OnboardingResponse> {
  const patch = parseOnboardingPatch(body ?? {});
  const userId = userObjectId(caller.userId);
  await ensureOnboardingIndexes();

  const account = await User.findById(userId).select("name email").lean<{ name?: string; email?: string }>();
  const now = new Date();
  const { details: detailsIn, completed, orgId, ...answers } = patch;
  const doc = {
    userId,
    orgId: orgId ? new Types.ObjectId(orgId) : null,
    email: account?.email || caller.email || "",
    name: account?.name || "",
    step: 0,
    interests: [],
    goal: "",
    topics: [],
    status: null,
    idCard: null,
    photo: null,
    headline: "",
    location: "",
    workModes: [],
    resume: null,
    ...answers,
    details: { ...(detailsIn || {}) },
    completed: completed === true,
    completedAt: completed === true ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  // Returns the document as it was before: null means we just inserted it.
  const before = await GarageUniversityOnboarding.findOneAndUpdate(
    { userId },
    { $setOnInsert: doc },
    { upsert: true, new: false, timestamps: false, setDefaultsOnInsert: false }
  ).lean();
  if (before) throw alreadyExists();

  const created = await GarageUniversityOnboarding.findOne({ userId }).lean();
  if (!created) throw new Error("Onboarding profile missing right after it was created");
  return toOnboardingResponse(created);
}

/**
 * Change any answers. `details` merge key by key, so saving one detail keeps
 * the rest. `completed: true` finishes onboarding (the app decides when); a
 * finished profile can still be edited but not un-finished.
 */
export async function updateOnboarding(caller: OnboardingCaller, body: unknown): Promise<OnboardingResponse> {
  const patch = parseOnboardingPatch(body);
  // The organisation is fixed when the profile is created.
  if (patch.orgId !== undefined) {
    throw new OnboardingError(400, "READ_ONLY_FIELD", "orgId is set when the profile is created and can't be changed", {
      fields: ["orgId"],
    });
  }
  if (Object.keys(patch).length === 0) {
    throw new OnboardingError(400, "EMPTY_UPDATE", "Nothing to update — send at least one field");
  }
  const userId = userObjectId(caller.userId);
  await ensureOnboardingIndexes();

  const current = await GarageUniversityOnboarding.findOne({ userId }).select("completed").lean();
  if (!current) throw notFound();

  const { details: detailsIn, completed, ...answers } = patch;
  const set: Record<string, unknown> = { ...answers };
  for (const [key, value] of Object.entries(detailsIn || {})) set[`details.${key}`] = value;
  if (completed === true && !current.completed) {
    set.completed = true;
    set.completedAt = new Date();
  }
  // Keep the copied email in step with the account.
  if (caller.email) set.email = caller.email;

  const doc = await GarageUniversityOnboarding.findOneAndUpdate(
    { userId },
    { $set: set },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) throw notFound();
  return toOnboardingResponse(doc);
}
