import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Garage University onboarding profile — one document per Garage user,
 * holding the answers from the Garage University app's /onboarding flow:
 *
 *   step 1  interests, goal
 *   step 2  topics
 *   step 3  status, details (country, state, college, degree, graduationYear,
 *           company, jobTitle, currentRole, targetRole, experience,
 *           otherStatus), idCard
 *   step 4  Quick Profile Builder: photo, headline, location, workModes, resume
 *
 * Its own collection, prefixed `garageuniversity_` so Garage University data
 * stays apart from the shared Garage collections. What a request may write
 * (types, size limits) is checked in services/garageUniversityOnboarding.service.ts
 * before it gets here; the values themselves are the app's call.
 */

export const GARAGE_UNIVERSITY_ONBOARDING_COLLECTION = "garageuniversity_onboarding_profiles";

/** An uploaded file (resume, ID card): its link, name and size in bytes. */
export interface IOnboardingFile {
  url: string;
  name: string;
  size: number;
}

export interface IGarageUniversityOnboarding extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** The organisation the profile belongs to — the Garage University org, sent by the app when creating it. Never changes. */
  orgId: Types.ObjectId | null;
  /** Copied from the Garage account, for reading the collection on its own. */
  email: string;
  name: string;
  /** The step the app shows next. */
  step: number;
  interests: string[];
  goal: string;
  topics: string[];
  status: string | null;
  details: Map<string, string>;
  idCard: IOnboardingFile | null;
  photo: string | null;
  headline: string;
  location: string;
  workModes: string[];
  resume: IOnboardingFile | null;
  /** Set once the last step is finished; a finished profile stays finished. */
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingFileSchema = new Schema<IOnboardingFile>(
  {
    url: { type: String, required: true, maxlength: 2048 },
    name: { type: String, required: true, maxlength: 255 },
    size: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const GarageUniversityOnboardingSchema = new Schema<IGarageUniversityOnboarding>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Set once, on create; `immutable` makes Mongoose drop any later change to it.
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, immutable: true },
    email: { type: String, default: "" },
    name: { type: String, default: "" },
    step: { type: Number, default: 0, min: 0, max: 100 },
    // step 1
    interests: { type: [String], default: [] },
    goal: { type: String, default: "", maxlength: 1000 },
    // step 2
    topics: { type: [String], default: [] },
    // step 3
    status: { type: String, default: null, maxlength: 1000 },
    details: { type: Map, of: String, default: {} },
    idCard: { type: OnboardingFileSchema, default: null },
    // step 4: Quick Profile Builder
    photo: { type: String, default: null, maxlength: 2048 },
    headline: { type: String, default: "", maxlength: 1000 },
    location: { type: String, default: "", maxlength: 1000 },
    workModes: { type: [String], default: [] },
    resume: { type: OnboardingFileSchema, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  // `minimize: false` keeps an empty `details` as {} rather than dropping it.
  { timestamps: true, minimize: false, collection: GARAGE_UNIVERSITY_ONBOARDING_COLLECTION }
);

// One profile per user. Prod runs with autoIndex off, so the service also
// builds this on first use (and `npm run indexes:sync` picks it up).
GarageUniversityOnboardingSchema.index({ userId: 1 }, { unique: true, name: "userId_unique" });

export const GarageUniversityOnboarding =
  (mongoose.models.GarageUniversityOnboarding as mongoose.Model<IGarageUniversityOnboarding>) ||
  mongoose.model<IGarageUniversityOnboarding>("GarageUniversityOnboarding", GarageUniversityOnboardingSchema);
