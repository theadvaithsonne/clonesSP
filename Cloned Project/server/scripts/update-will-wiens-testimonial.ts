/**
 * One-off: replaces the message text and adds 4 captioned photos to
 * Wilhelm (Will) Wiens' testimonial on the Lost Money site, per the
 * founder's exact replacement text and photo captions given 2026-08-28.
 *
 * The 4 photos were already uploaded to S3 via POST /uploads/public
 * (the same public endpoint the testimonial submission form itself
 * uses) — this script only writes the resulting URLs + captions and the
 * new message onto the existing document. Nothing else on the
 * testimonial (name, approved, approvedAt, hidden) is touched.
 *
 * Run: npx ts-node src/scripts/update-will-wiens-testimonial.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Bat246LostMoneyTestimonial } from "../bat246/models/bat246LostMoneyTestimonial.model";

const TESTIMONIAL_ID = "6a8ec304490a4df4f62f6397"; // Wilhelm (Will) Wiens

const MESSAGE = `I first heard about Business in Motion (BiM) quite a few years ago. I think it was in 2008 or somewhere around that time when I lived and worked in Kelowna as a supervisor in the Multifamily Construction industry. I made a good salary but when I joined BiM the first few months I made quite a bit more on the side than with my full time job.

I was doing well and then after several months I was transferred to Calgary and I worked the BiM business there as well. It was the first such networking business I made money at, although not for a lack of trying. Like most MLM type businesses, after a while things slowed down and BIM came to an end.
I've stayed in touch with Alan over the years and watched him attempt a vastly improved Time Leverage System (TLS) which had tremendous promise, and I was all in on it. Unfortunately, the business got sabotaged by some individuals and it collapsed. The monies I lost, has been verified, through this "yourmoneyback.info" system, and now I am on an approved pay back plan, something unheard of in any industry!  I give Alan credit for doing such an honourable thing, especially after he lost everything, through no fault of his own.

Alan and I stayed in touch and watched him rebuild, not only his life but now his vastly improved TLS system, which I've learned, has been his life's passion. Having dabbled in many different such network businesses for most of my adult life, having only made money with the TLS system, I see tremendous opportunity with BAT 246, or B2 as he affectionately calls it.

I have become quite familiar with it. Let me tell you the things that make it so much better than any his earlier versions. The product alone has me sold. Since when can you buy a product at wholesale and then turn around and resell at at 3-5 times its value on the open market? Unheard of !! Usually MLM's have overpriced products in order to pay the recruiters in the MLM pay plan.

There are so many other bonuses, that it's hard to compare the earning potential to anything on the market today!

Those of you who are familiar with the TLS system, Alan has created such ingenious ways of preventing "stalled" situations, that the so called "slow teams" become the "best teams"!  And then he has totally "levelled the playing field", financially, making it possible for those with limited funds, to not only get started with less upfront money, but to thrive and move up, into an unheard of earning potential!

All in all, an opportunity you just don't want to miss out on! I look forward to making a lot of new friends, besides the money, which is simply a given!`;

const IMAGES = [
  {
    url: "https://nela-app.s3.us-east-1.amazonaws.com/public-onboarding/2026-08-28/1787922920188_uam0nyoyjwc_spain-balcony.png",
    caption: "Alan and I in Spain the day we discovered that HRI had been sabotaged 2 days before Christmas",
  },
  {
    url: "https://nela-app.s3.us-east-1.amazonaws.com/public-onboarding/2026-08-28/1787922928660_ssgmtr6o77b_hri-prelaunch.jpeg",
    caption: "Alan and I at a pre launch meeting for HRI",
  },
  {
    url: "https://nela-app.s3.us-east-1.amazonaws.com/public-onboarding/2026-08-28/1787922936305_altv9btn9f7_hri-relaunch-manila.jpeg",
    caption: "A few of us at the HRI relaunch meeting in Manila.",
  },
  {
    url: "https://nela-app.s3.us-east-1.amazonaws.com/public-onboarding/2026-08-28/1787922944380_kxzl0w44hhb_with-child.jpeg",
    caption:
      "I lived with Alan and his wife and child for a month in Manila, Philippines and 3 months in Malaga, Spain.",
  },
];

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI environment variable not set");

  await mongoose.connect(mongoUri);

  const before = await Bat246LostMoneyTestimonial.findById(TESTIMONIAL_ID).lean();
  if (!before) throw new Error(`No testimonial found with id ${TESTIMONIAL_ID}`);
  console.log(`Found testimonial for "${(before as any).name}" — updating message + images.`);

  const result = await Bat246LostMoneyTestimonial.updateOne(
    { _id: TESTIMONIAL_ID },
    { $set: { message: MESSAGE, images: IMAGES } }
  );
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);

  const after = await Bat246LostMoneyTestimonial.findById(TESTIMONIAL_ID).lean();
  console.log(`\nNew message length: ${(after as any)?.message.length} chars`);
  console.log(`New image count: ${(after as any)?.images.length}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
