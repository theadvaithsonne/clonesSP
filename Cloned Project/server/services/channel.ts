import { Channel } from "../models/channel.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { User } from "../models/user.model";
import {
  mintFreeItemInvoiceInBackground,
  FreeInvoiceSource,
} from "./freeInvoice";

/**
 * Mint a `$0 paid` invoice for a FREE channel join so it shows up in the same
 * surfaces an explicit `/checkout/channel/:id` on a free channel would (member
 * lists filtered by invoice, "community customers" analytics, etc.).
 *
 * Thin wrapper over the shared helper — `metadata.type` stays
 * "channel_auto_join" so the existing reports that group on it are unaffected.
 * Best-effort; the membership row is the source of truth and must already be
 * written by the caller.
 */
async function mintFreeChannelJoinInvoice(
  userId: string,
  channel: { _id: any; storeId: any; createdBy: any; title: string; description?: string; coverImage?: string; currency?: string },
  orgId: string,
  source: FreeInvoiceSource = "subscribe",
): Promise<void> {
  // Backgrounded: auto-join fires during signup, invite-accept and every
  // bundled purchase — none of those should wait on invoice bookkeeping.
  mintFreeItemInvoiceInBackground({
    userId,
    orgId,
    sellerId: String(channel.createdBy),
    itemType: "channel",
    itemId: String(channel._id),
    itemName: channel.title,
    itemDescription: channel.description,
    itemImage: channel.coverImage,
    currency: channel.currency,
    metadataType: "channel_auto_join",
    source,
  });
}

/**
 * Create a new channel in an organization's store
 */
export async function createChannel(
  orgId: string,
  createdBy: string,
  data: {
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    coverImage?: string;
    isFree?: boolean;
    isSubscription?: boolean;
    subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
    subscriptionInterval?: number;
    allowPayWhatYouWant?: boolean;
  }
) {
  return await Channel.create({
    ...data,
    price: data.price || 0,
    currency: data.currency || "USD",
    isFree: data.isFree !== false,
    isActive: true,
    storeId: orgId,
    createdBy,
  });
}

/**
 * Add user to a channel (create membership)
 */
export async function addUserToChannel(
  userId: string,
  channelId: string,
  orgId: string,
  opts: { source?: FreeInvoiceSource } = {},
): Promise<void> {
  const existing = await ChannelMembership.findOne({ userId, channelId }).lean();

  // Upsert rather than bail on an existing row. The checkout routes that now
  // funnel through here used findOneAndUpdate({...}, {status:"active"}, {upsert}),
  // which REACTIVATES someone who had left the community and came back. An
  // early return would have silently dropped that.
  await ChannelMembership.findOneAndUpdate(
    { userId, channelId },
    {
      userId,
      channelId,
      orgId,
      status: "active",
      role: "member",
      ...(existing ? {} : { joinedAt: new Date() }),
    },
    { upsert: true, new: true },
  );

  if (existing) {
    console.log(`User ${userId} membership on channel ${channelId} is active`);
  } else {
    console.log(`✅ Added user ${userId} to channel ${channelId}`);
  }

  // Free joins get the same $0 paper trail a free channel checkout produces.
  // Paid channels must never be granted here — callers filter to free ones
  // (see the Channel.find({$or:[{isFree:true},{price:{$in:[null,0]}}]}) guard
  // at each bundled-join site); this second check is defence in depth so a
  // mistaken caller cannot record a paid community as given away.
  const channel = await Channel.findById(channelId)
    .select("_id storeId createdBy title description coverImage currency isFree price")
    .lean<any>();
  if (!channel) return;
  const isFree = channel.isFree === true || !channel.price || channel.price <= 0;
  if (!isFree) {
    console.warn(
      `[Channel] addUserToChannel granted PAID channel ${channelId} to ${userId} — no free invoice minted`,
    );
    return;
  }
  await mintFreeChannelJoinInvoice(userId, channel, orgId, opts.source ?? "bundled");
}

/**
 * Remove user from a channel
 */
export async function removeUserFromChannel(
  userId: string,
  channelId: string
): Promise<void> {
  await ChannelMembership.deleteOne({ userId, channelId });
  console.log(`✅ Removed user ${userId} from channel ${channelId}`);
}

/**
 * Get channels a user is subscribed to in an organization
 */
export async function getUserChannels(userId: string, orgId: string) {
  const memberships = await ChannelMembership.find({
    userId,
    orgId,
    status: "active",
  }).lean();

  const channelIds = memberships.map((m) => m.channelId);

  return await Channel.find({
    _id: { $in: channelIds },
    isActive: true,
  }).lean();
}

/**
 * Get all channels in a store
 */
export async function getStoreChannels(orgId: string) {
  return await Channel.find({
    storeId: orgId,
    isActive: true,
  }).lean();
}

/**
 * Get a specific channel by ID
 */
export async function getChannelById(channelId: string) {
  return await Channel.findById(channelId).lean();
}

/**
 * Auto-join user to the default Members channel when they join an org.
 * Falls back to Employees channel for existing organizations that don't have Members channel.
 */
export async function autoJoinMembersChannel(
  userId: string,
  orgId: string
): Promise<void> {
  // If a founder has designated a custom default community, skip joining
  // Members/Employees — autoJoinDefaultChannel() will handle it instead.
  const founderDefault = await Channel.findOne({
    storeId: orgId,
    isDefault: true,
    isActive: true,
  }).lean();

  if (founderDefault) {
    console.log(
      `⏭️ Skipping Members/Employees auto-join — founder default "${founderDefault.title}" exists for org ${orgId}`
    );
    return;
  }

  // First try "Members" channel (new orgs)
  let channel = await Channel.findOne({
    storeId: orgId,
    title: "Members",
  }).lean();

  // Fallback to "Employees" channel (existing orgs)
  if (!channel) {
    channel = await Channel.findOne({
      storeId: orgId,
      title: "Employees",
    }).lean();
  }

  if (!channel) {
    console.log(`⚠️ Members/Employees channel not found for org: ${orgId}`);
    return;
  }

  // addUserToChannel mints the $0 auto-join invoice itself now, and the mint
  // is idempotent per (user, channel), so the previous wasAlreadyMember
  // pre-check is gone. That check also relied on addUserToChannel returning
  // early for an existing row, which is no longer true — it upserts so a
  // rejoin reactivates.
  await addUserToChannel(userId, channel._id.toString(), orgId, {
    source: "subscribe",
  });
}

/**
 * Auto-join user to the founder-designated default community for an org.
 * This is separate from "Members" — a founder can tag one of their custom
 * communities as the default so every new joiner lands there too.
 * Safe to call even when no default exists (no-op).
 */
export async function autoJoinDefaultChannel(
  userId: string,
  orgId: string
): Promise<void> {
  const defaultChannel = await Channel.findOne({
    storeId: orgId,
    isDefault: true,
    isActive: true,
  }).lean();

  if (!defaultChannel) {
    // No founder-designated default — nothing to do
    return;
  }

  // addUserToChannel mints the $0 auto-join invoice itself now (idempotently),
  // so the wasAlreadyMember pre-check that used to gate it is gone.
  await addUserToChannel(userId, defaultChannel._id.toString(), orgId, {
    source: "subscribe",
  });
  console.log(
    `✅ Auto-joined user ${userId} to default community "${defaultChannel.title}" in org ${orgId}`
  );
}

/**
 * Auto-enrol a user into every community the founder marked mandatory.
 *
 * Runs alongside `autoJoinDefaultChannel` on every path where someone joins an
 * org. Unlike the default community — one per org, DB-enforced — a founder can
 * mandate any number of free communities.
 *
 * Free-only is re-checked HERE, not just at toggle time. A channel could have
 * been priced after the flag was set (by a direct DB write, or a code path that
 * skipped `setChannelPrice`), and auto-enrolling someone into a paid community
 * hands them something they never bought. Cheaper to skip and log than to
 * refund.
 *
 * Never throws: joining an org must not fail because one community is
 * misconfigured. Each channel is attempted independently so one bad row cannot
 * cost the user the rest.
 */
export async function autoJoinMandatoryChannels(
  userId: string,
  orgId: string
): Promise<{ joined: number; skipped: number }> {
  let joined = 0;
  let skipped = 0;

  try {
    const channels = await Channel.find({
      storeId: orgId,
      mandatoryOnJoin: true,
      isActive: true,
    })
      .select("_id title isFree price isDefault")
      .lean();

    for (const ch of channels as any[]) {
      // The default community is already handled by autoJoinDefaultChannel —
      // joining twice is harmless (addUserToChannel is idempotent) but it would
      // double-log and double-count.
      if (ch.isDefault) continue;

      if (!ch.isFree && (ch.price || 0) > 0) {
        skipped++;
        console.warn(
          `[channel] Skipping mandatory auto-join for PAID channel "${ch.title}" (${ch._id}) in org ${orgId} — the flag should have been cleared when it was priced`
        );
        continue;
      }

      try {
        await addUserToChannel(userId, ch._id.toString(), orgId, {
          source: "subscribe",
        });
        joined++;
      } catch (err: any) {
        skipped++;
        console.error(
          `[channel] Mandatory auto-join failed for user ${userId} -> channel ${ch._id}:`,
          err?.message
        );
      }
    }

    if (joined > 0) {
      console.log(
        `✅ Auto-joined user ${userId} to ${joined} mandatory communit${joined === 1 ? "y" : "ies"} in org ${orgId}`
      );
    }
  } catch (err: any) {
    console.error(
      `[channel] autoJoinMandatoryChannels failed for user ${userId} in org ${orgId}:`,
      err?.message
    );
  }

  return { joined, skipped };
}

/**
 * Turn the "mandatory on join" flag on or off for a community.
 *
 * Free-only, for the same reason the default community is: auto-enrolment
 * gives the community away, so a paid one would be revenue handed out for
 * nothing. No unique index here — any number of communities may be mandated.
 */
export async function setChannelMandatory(
  channelId: string,
  orgId: string,
  mandatory: boolean
): Promise<{ success: boolean; error?: string }> {
  const channel = await Channel.findOne({
    _id: channelId,
    storeId: orgId,
    isActive: true,
  }).lean();

  if (!channel) {
    return { success: false, error: "Community not found" };
  }

  if (mandatory && !(channel as any).isFree && ((channel as any).price || 0) > 0) {
    return {
      success: false,
      error: "Only free communities can be made mandatory on join",
    };
  }

  await Channel.updateOne(
    { _id: channelId, storeId: orgId },
    { $set: { mandatoryOnJoin: mandatory } }
  );

  console.log(
    `✅ ${mandatory ? "Set" : "Cleared"} mandatory-on-join for "${(channel as any).title}" in org ${orgId}`
  );
  return { success: true };
}

/**
 * Clear the mandatory flag when a community stops being free.
 *
 * Called from the channel update path. Returns true when it actually cleared
 * something, so the caller can tell the founder why their toggle turned itself
 * off rather than leaving them to discover it.
 */
export async function clearMandatoryIfPaid(
  channelId: string
): Promise<boolean> {
  const res = await Channel.updateOne(
    {
      _id: channelId,
      mandatoryOnJoin: true,
      $or: [{ isFree: false }, { price: { $gt: 0 } }],
    },
    { $set: { mandatoryOnJoin: false } }
  );
  if (res.modifiedCount > 0) {
    console.log(
      `[channel] Cleared mandatoryOnJoin for ${channelId} — it is no longer free`
    );
    return true;
  }
  return false;
}

/**
 * Set a channel as the default community for an org.
 * Atomically unsets any previous default first (only one allowed per org).
 * Only free channels can be set as default (paid channels are skipped).
 */
export async function setDefaultChannel(
  channelId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify channel exists and belongs to this org
  const channel = await Channel.findOne({
    _id: channelId,
    storeId: orgId,
    isActive: true,
  }).lean();

  if (!channel) {
    return { success: false, error: "Channel not found" };
  }

  // Only allow free channels to be set as default
  if (!channel.isFree && channel.price > 0) {
    return {
      success: false,
      error: "Only free communities can be set as default",
    };
  }

  // Unset any existing default for this org
  await Channel.updateMany(
    { storeId: orgId, isDefault: true },
    { $set: { isDefault: false } }
  );

  // Set the new default
  await Channel.updateOne(
    { _id: channelId, storeId: orgId },
    { $set: { isDefault: true } }
  );

  console.log(
    `✅ Set channel "${channel.title}" as default community for org ${orgId}`
  );
  return { success: true };
}

/**
 * Clear any default community designation for an org.
 */
export async function clearDefaultChannel(
  orgId: string
): Promise<void> {
  await Channel.updateMany(
    { storeId: orgId, isDefault: true },
    { $set: { isDefault: false } }
  );
  console.log(`✅ Cleared default community for org ${orgId}`);
}

// OLD: Keep as alias for backward compatibility with existing code
// export async function autoJoinEmployeesChannel(
//   userId: string,
//   orgId: string
// ): Promise<void> {
//   const employeesChannel = await Channel.findOne({
//     storeId: orgId,
//     title: "Employees",
//   }).lean();
//
//   if (!employeesChannel) {
//     console.log(`⚠️ Employees channel not found for org: ${orgId}`);
//     return;
//   }
//
//   await addUserToChannel(userId, employeesChannel._id.toString(), orgId);
// }

// Alias for backward compatibility - points to new function
export const autoJoinEmployeesChannel = autoJoinMembersChannel;

/**
 * Check if user is member of a channel
 */
export async function isUserMemberOfChannel(
  userId: string,
  channelId: string
): Promise<boolean> {
  const membership = await ChannelMembership.findOne({
    userId,
    channelId,
    status: "active",
  }).lean();

  return !!membership;
}

/**
 * Get channel members
 */
export async function getChannelMembers(channelId: string) {
  return await ChannelMembership.find({
    channelId,
    status: "active",
  })
    .populate("userId", "name email profilePicture")
    .lean();
}

/**
 * Get user's subscriptions in an organization (for compatibility with frontend)
 */
export async function getUserSubscriptions(userId: string, orgId: string) {
  const memberships = await ChannelMembership.find({
    userId,
    orgId,
    status: "active",
  })
    .populate("channelId")
    .lean();

  return memberships.map((m) => ({
    _id: m._id,
    channelId: m.channelId,
    joinedAt: m.joinedAt,
    status: m.status,
    subscriptionStatus: m.subscriptionStatus,
  }));
}

// `subscribeToChannel` was removed here: it had no callers anywhere in the
// codebase and wrote membership directly, so it would have granted free
// community access without minting the $0 invoice every other path now does.
// Use `addUserToChannel` (free joins, mints the invoice) or
// `subscribeToPaidChannel` in services/feed.ts (paid) instead.
