import { Schema, model, Types } from "mongoose";

// "Lost Money" claim application — public form at
// /games/bat246/lostmoney/index/register. Only company name + the
// claimant's first/last name and mobile number are truly mandatory (per
// the source spec); everything else is optional free text since claimants
// may be recalling events from many years ago and won't have every detail.
const Bat246LostMoneyClaimSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", default: null }, // set if submitted while logged in

    companyName: { type: String, required: true, trim: true },
    registrationFees: { type: String, default: "" },
    totalLoss: { type: String, default: "" }, // claimant-reported total loss (USD) — feeds the admin Paid List's "Reported Loss" column
    lossDescription: { type: String, default: "" },
    managementNames: { type: String, default: "" },
    shareholderNames: { type: String, default: "" },
    reasonJoined: { type: String, default: "" },
    teamsCopy: { type: String, default: "" },
    teamsCopyImages: { type: [String], default: [] }, // up to 5 image URLs, uploaded via /uploads/public
    timeline: { type: String, default: "" },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    city: { type: String, default: "" }, // current city
    country: { type: String, default: "" }, // current country
    cityAtLoss: { type: String, default: "" },
    countryAtLoss: { type: String, default: "" },

    sponsorName: { type: String, default: "" },
    sponsorPhone: { type: String, default: "" },
    sponsorCity: { type: String, default: "" },
    sponsorCountry: { type: String, default: "" },

    productBought: { type: String, default: "" },
    productCost: { type: String, default: "" },
    knownPeople: { type: String, default: "" },
    productChosenOrReceived: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    teammates: { type: String, default: "" },
    meetingsHosted: { type: String, default: "" },
    priorEarnings: { type: String, default: "" },
    reasonForLoss: { type: String, default: "" },
    localManagement: { type: String, default: "" },
    profitCentersOnCount: { type: String, default: "" },
    profitCentersCount: { type: String, default: "" },
    venuesAttended: { type: String, default: "" },
    peopleIntroducedCount: { type: String, default: "" },
    peopleIntroducedSaleCost: { type: String, default: "" },
    boardsProfitedCount: { type: String, default: "" },
    boardsProfitedAmount: { type: String, default: "" },
    boardsLostCount: { type: String, default: "" },
    bestPart: { type: String, default: "" },
    worstPart: { type: String, default: "" },
    ageAtLoss: { type: String, default: "" },
    ageNow: { type: String, default: "" },
    idNumberAtLoss: { type: String, default: "" },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

export const Bat246LostMoneyClaim = model("bat246LostMoneyClaims", Bat246LostMoneyClaimSchema);
