import { Types } from "mongoose";
import { Bat246Distributor } from "../models/bat246Distributor.model";

// Slot origin flag: explicit value first, then Country of Birth (Complete Profile), then residence.
export function pickCountryOrigin(
  explicitOrigin: string | null | undefined,
  countryOfBirth: string | null | undefined,
  residence: string | null | undefined
): string | null {
  return explicitOrigin || countryOfBirth?.trim() || residence || null;
}

export async function resolveCountryOrigin(
  userId: Types.ObjectId | string,
  explicitOrigin?: string | null,
  residence?: string | null
): Promise<string | null> {
  if (explicitOrigin) return explicitOrigin;
  const dist = (await Bat246Distributor.findOne({ userId: new Types.ObjectId(String(userId)) })
    .select("countryOfBirth")
    .lean()) as any;
  return pickCountryOrigin(null, dist?.countryOfBirth, residence);
}
