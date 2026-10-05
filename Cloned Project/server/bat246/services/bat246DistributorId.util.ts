import { Types } from "mongoose";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246Config } from "../models/bat246Config.model";
import { User } from "../../models/user.model";

export function splitDistributorName(rawName: string | null | undefined): { firstName: string; lastName: string } {
  const name = (rawName ?? "").trim();
  if (!name) return { firstName: "", lastName: "" };

  if (name.includes(" ")) {
    const parts = name.split(/\s+/).filter(Boolean);
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
  }
  if (name.includes("-")) {
    const parts = name.split("-").filter(Boolean);
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
  }
  // Single word, no separator — no real last name available.
  return { firstName: name, lastName: name };
}

export function buildDistributorId(seq: number, firstName: string, lastName: string): string {
  const firstInitial = (firstName.charAt(0) || "X").toUpperCase();
  const lastInitial = (lastName.charAt(0) || "X").toUpperCase();
  return `${seq}${firstInitial}${lastInitial}`;
}

// Builds the userSnapshot sub-document (see bat246Distributor.model.ts) from
// a live user doc. Every field defaults to null so a partial/lean user
// projection (as long as it includes the fields it needs) never throws.
export function buildUserSnapshot(user: any) {
  return {
    name:           user?.name ?? null,
    email:          user?.email ?? null,
    phone:          user?.phone ?? null,
    profilePicture: user?.profilePicture ?? null,
    country:        user?.country ?? null,
    state:          user?.state ?? null,
    city:           user?.city ?? null,
    postalCode:     user?.postalCode ?? null,
  };
}

// Assigns a permanent distributorId (e.g. "1001B1") the first time a distributor
// becomes qualified. Idempotent — no-ops if already assigned.
//
// Also the one guaranteed place userSnapshot gets its first write: this
// runs exactly once per distributor, exactly when they qualify, and the
// User doc is certain to still exist at that moment (they just completed
// qualification themselves). listDistributors refreshes it opportunistically
// after this, but this is the write that can't be skipped or missed.
export async function assignDistributorId(userId: Types.ObjectId | string): Promise<void> {
  const dist = await Bat246Distributor.findOne({ userId }).select("distributorId").lean() as any;
  if (!dist || dist.distributorId) return;

  const user = await User.findById(userId)
    .select("name email phone profilePicture country state city postalCode")
    .lean() as any;
  const { firstName, lastName } = splitDistributorName(user?.name);

  const config = await Bat246Config.findOneAndUpdate(
    {},
    { $inc: { distributorIdCounter: 1 } },
    { new: true, upsert: true }
  );
  const distributorId = buildDistributorId(config!.distributorIdCounter, firstName, lastName);

  await Bat246Distributor.updateOne(
    { userId, distributorId: null },
    { $set: { firstName, lastName, distributorId, userSnapshot: buildUserSnapshot(user) } }
  );
}
