import { Schema, model } from "mongoose";

// One photo attached to a testimonial: the hosted URL (uploaded via
// /uploads/public) plus an optional caption shown alongside it on the
// public site and in the admin moderation views.
//
// Was `images: [String]` until 2026-08-28 — every existing document was
// migrated in place (see scripts/migrate-testimonial-image-captions.ts)
// to this {url, caption} shape before this schema change went live, so
// there should be no plain-string entries left in the collection.
const TestimonialImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    caption: { type: String, default: "", trim: true },
  },
  { _id: false }
);

// Public testimonials on the Lost Money site — submitted by anyone, only
// shown once an admin (Alan K) approves them.
const Bat246LostMoneyTestimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    images: { type: [TestimonialImageSchema], default: [] }, // up to 10 photos
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    // Approved but temporarily hidden from the public site without deleting
    // it — admin can unhide later to bring it back live.
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Bat246LostMoneyTestimonial = model("bat246LostMoneyTestimonials", Bat246LostMoneyTestimonialSchema);
