import { Schema, model } from "mongoose";

// Home-page gallery on the Lost Money site — admin-managed photo carousel
// shown next to Alan's opening message. Images are uploaded/removed only
// from the admin backoffice.
const Bat246LostMoneyGalleryImageSchema = new Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true }, // S3 key, used to delete the object on removal
    order: { type: Number, default: 0 }, // display sequence in the homepage carousel, set from the admin backoffice
  },
  { timestamps: true }
);

export const Bat246LostMoneyGalleryImage = model(
  "bat246LostMoneyGalleryImages",
  Bat246LostMoneyGalleryImageSchema
);
