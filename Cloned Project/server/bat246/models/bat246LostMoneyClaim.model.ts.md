# `server/bat246/models/bat246LostMoneyClaim.model.ts`

> Mongoose model for a "Lost Money" claim: the long public questionnaire where someone describes money they lost in an earlier scheme and asks to be repaid.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 66

## Purpose
The Lost Money site is a BAT246 sub-site served on separate lost-money domains through host rewrites in `middleware.ts`. People who lost money in past schemes apply through the public form at `/games/bat246/lostmoney/index/register`. An admin reviews each claim and sets its status. Separately, through `POST /paid/add`, the admin can add the person to the Paid List (`bat246LostMoneyPaid.model.ts`), which is repaid from a 3% cut of BAT246 sales. This model stores the raw applications.

## How it works
Only a few fields are required, because claimants may be recalling events from many years ago:
- `companyName`, `firstName`, `lastName`, `mobileNumber` (all trimmed).

Everything else is an optional free-text String defaulting to `""`, grouped roughly as:
- **Loss details:**
  - `registrationFees`;
  - `totalLoss`, the claimant's reported loss in USD. It becomes the "Reported Loss" on the admin Paid List;
  - `lossDescription`, `managementNames`, `shareholderNames`, `reasonJoined`, `teamsCopy`, `timeline`;
  - `teamsCopyImages`: up to 5 image URLs uploaded through `/uploads/public`.
- **Claimant location:** `city`, `country` (current); `cityAtLoss`, `countryAtLoss`.
- **Sponsor:** `sponsorName`, `sponsorPhone`, `sponsorCity`, `sponsorCountry`.
- **Scheme participation:** `productBought`, `productCost`, `knownPeople`, `productChosenOrReceived`, `paymentMethod`, `teammates`, `meetingsHosted`, `priorEarnings`, `reasonForLoss`, `localManagement`, `profitCentersOnCount`, `profitCentersCount`, `venuesAttended`, `peopleIntroducedCount`, `peopleIntroducedSaleCost`, `boardsProfitedCount`, `boardsProfitedAmount`, `boardsLostCount`, `bestPart`, `worstPart`.
- **Personal:** `ageAtLoss`, `ageNow`, `idNumberAtLoss`.
- **System fields:**
  - `userId` (→ `User`, default `null`): set only if the claimant was logged in;
  - `status`: `pending | approved | rejected`, default `pending`;
  - `createdAt` and `updatedAt` (`timestamps: true`).

Numbers are stored as strings because they are typed free-form.

## Exports
- `Bat246LostMoneyClaim` - Mongoose model registered as `"bat246LostMoneyClaims"`.

## Interfaces
- **Database:** collection `bat246lostmoneyclaims`.
- **Endpoints using it** (in `server/bat246/routes/bat246LostMoney.routes.ts`, mounted at `/bat246/lostmoney`):
  - `POST /backend/bat246/lostmoney/claims`: public submission, with `softAuth`.
  - `GET /backend/bat246/lostmoney/claims`: admin list (`requireAuth` + `requireAlanK`).
  - `POST /backend/bat246/lostmoney/claims/:id/status`: admin sets `pending`, `approved` or `rejected`. It only updates `status` and does not create a Paid List row.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246LostMoney.routes.ts` (only importer).

## Notes
- The collection holds personal data (phone numbers, an ID number, city and country history). Keep it behind the admin-only routes.
- `Bat246LostMoneyPaid.claimId` links back to the claim when the admin passes `claimId` to `POST /paid/add`.
