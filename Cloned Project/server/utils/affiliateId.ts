import crypto from "crypto";
import { User } from "../models/user.model";

/**
 * Generate a unique affiliate ID in format: aff_xxxxxxxx
 * Example: aff_ti6de6kr
 */
export async function generateAffiliateId(): Promise<string> {
  const maxRetries = 5;

  for (let i = 0; i < maxRetries; i++) {
    // Generate 6 random bytes and convert to base36 for alphanumeric
    const randomBytes = crypto.randomBytes(6);
    const randomStr = randomBytes
      .toString("base64")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .substring(0, 8);

    const affiliateId = `aff_${randomStr}`;

    // Check uniqueness
    const existing = await User.findOne({ affiliateId }).lean();
    if (!existing) {
      return affiliateId;
    }
  }

  throw new Error("Failed to generate unique affiliate ID after 5 retries");
}

/**
 * Validate affiliate ID format
 * Valid format: aff_xxxxxxxx (aff_ prefix + 8 alphanumeric chars)
 */
export function isValidAffiliateId(id: string): boolean {
  return /^aff_[a-z0-9]{6,10}$/i.test(id);
}
