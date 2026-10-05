// Shared "thank-you page" schema used by Product and Course (and any
// other sellable that wants the same post-purchase experience). Kept in
// one place so the on-disk shape and validation stay in lockstep across
// items — a divergence between product and course would silently break
// the shared FE renderer.
//
// The paired normaliser lives at services/thankYouPage.ts. Do NOT
// import that from a model file (introduces a services→models cycle).

import { Schema } from "mongoose";

export interface IThankYouPageSection {
  heading: string;
  buttonLabel: string;
  buttonUrl: string;
}

/**
 * Founder-configurable page shown to a buyer on the invoice `success` step
 * (the moment their payment goes through — never on refreshes of an already-
 * paid invoice). Two modes:
 *   - autoRedirect: true  → buyer's tab redirects to `redirectUrl` in a new
 *     window right after payment.
 *   - autoRedirect: false → renders `title`, `message`, and up to 5
 *     hyperlink-button sections on top of the standard HQ header.
 */
export interface IThankYouPage {
  autoRedirect: boolean;
  redirectUrl?: string;
  title?: string;
  message?: string;
  sections?: IThankYouPageSection[];
}

export const ThankYouPageSectionSchema = new Schema<IThankYouPageSection>(
  {
    heading: { type: String, required: true, trim: true, maxlength: 60 },
    buttonLabel: { type: String, required: true, trim: true, maxlength: 40 },
    buttonUrl: { type: String, required: true, trim: true },
  },
  { _id: false },
);

export const ThankYouPageSchema = new Schema<IThankYouPage>(
  {
    autoRedirect: { type: Boolean, default: false },
    redirectUrl: { type: String, trim: true },
    title: { type: String, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 400 },
    sections: { type: [ThankYouPageSectionSchema], default: undefined },
  },
  { _id: false },
);
