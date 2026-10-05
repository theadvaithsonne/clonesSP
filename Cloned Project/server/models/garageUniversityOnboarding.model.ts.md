# `server/models/garageUniversityOnboarding.model.ts`

> Mongoose model holding one Garage University onboarding profile per Garage user (the answers from the Garage University app's multi-step `/onboarding` flow).

**Kind:** Mongoose model · **Lines:** 103

## Purpose
Garage University is a separate app that uses this backend. Its onboarding wizard stores answers here, in its own collection prefixed `garageuniversity_` to keep that app's data apart from shared Garage collections. Validation of what a request may write (types, size limits) happens in `server/services/garageUniversityOnboarding.service.ts` before reaching the model; the values themselves are the app's business.

## How it works
Steps captured (from the header):
- Step 1: `interests[]`, `goal` (max 1000).
- Step 2: `topics[]`.
- Step 3: `status` (max 1000), `details` (a `Map<string,string>` for country, state, college, degree, graduationYear, company, jobTitle, currentRole, targetRole, experience, otherStatus), `idCard` (file).
- Step 4 (Quick Profile Builder): `photo` (URL, max 2048), `headline`, `location`, `workModes[]`, `resume` (file).

Other fields:
- `userId` (ref `User`, required) - one profile per user via unique index `userId_unique`.
- `orgId` (ref `Organization`, default null, `immutable: true`) - the Garage University organisation, set once on create; later changes are dropped by Mongoose.
- `email`, `name` - copied from the Garage account so the collection can be read alone.
- `step` (0-100) - the step the app shows next.
- `completed`, `completedAt` - set when the last step finishes; a finished profile stays finished.
- File sub-documents (`OnboardingFileSchema`): `url` (max 2048), `name` (max 255), `size` (bytes, >= 0).

Schema options: timestamps, `minimize: false` (keeps an empty `details` as `{}`), explicit collection name.

## Exports
- `GarageUniversityOnboarding` - model `"GarageUniversityOnboarding"` (guarded against re-registration).
- `GARAGE_UNIVERSITY_ONBOARDING_COLLECTION` - `"garageuniversity_onboarding_profiles"`.
- `IGarageUniversityOnboarding` - document interface.
- `IOnboardingFile` - `{ url, name, size }`.

## Interfaces
- **Database:** collection `garageuniversity_onboarding_profiles` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/garageUniversityOnboarding.service.ts` only.

## Notes
- Production runs with `autoIndex` off, so the comment says the service also builds the unique `userId` index on first use, and `npm run indexes:sync` picks it up.
- Resume and ID-card documents are personal data; only their URL, name and size are stored here, not the files themselves.
