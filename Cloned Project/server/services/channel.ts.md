# `server/services/channel.ts`

> Module exporting `createChannel`, `addUserToChannel`, `removeUserFromChannel`, `getUserChannels` and 12 more.

**Kind:** backend service · **Lines:** 531

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createChannel` | function | `async createChannel(orgId: string, createdBy: string, data: { title: string; description?: string; price?: number…)` — Create a new channel in an organization's store | 45 |
| `addUserToChannel` | function | `async addUserToChannel(userId: string, channelId: string, orgId: string, opts: { source?: FreeInvoiceSource } = {}): Promise<void>` — Add user to a channel (create membership) | 75 |
| `removeUserFromChannel` | function | `async removeUserFromChannel(userId: string, channelId: string): Promise<void>` — Remove user from a channel | 128 |
| `getUserChannels` | function | `async getUserChannels(userId: string, orgId: string)` — Get channels a user is subscribed to in an organization | 139 |
| `getStoreChannels` | function | `async getStoreChannels(orgId: string)` — Get all channels in a store | 157 |
| `getChannelById` | function | `async getChannelById(channelId: string)` — Get a specific channel by ID | 167 |
| `autoJoinMembersChannel` | function | `async autoJoinMembersChannel(userId: string, orgId: string): Promise<void>` — Auto-join user to the default Members channel when they join an org. | 175 |
| `autoJoinDefaultChannel` | function | `async autoJoinDefaultChannel(userId: string, orgId: string): Promise<void>` — Auto-join user to the founder-designated default community for an org. | 229 |
| `autoJoinMandatoryChannels` | function | `async autoJoinMandatoryChannels(userId: string, orgId: string): Promise<{ joined: number; skipped: number }>` — Auto-enrol a user into every community the founder marked mandatory. | 271 |
| `setChannelMandatory` | function | `async setChannelMandatory(channelId: string, orgId: string, mandatory: boolean): Promise<{ success: boolean; error?: string }>` — Turn the "mandatory on join" flag on or off for a community. | 337 |
| `clearMandatoryIfPaid` | function | `async clearMandatoryIfPaid(channelId: string): Promise<boolean>` — Clear the mandatory flag when a community stops being free. | 377 |
| `setDefaultChannel` | function | `async setDefaultChannel(channelId: string, orgId: string): Promise<{ success: boolean; error?: string }>` — Set a channel as the default community for an org. | 402 |
| `clearDefaultChannel` | function | `async clearDefaultChannel(orgId: string): Promise<void>` — Clear any default community designation for an org. | 446 |
| `autoJoinEmployeesChannel` | const | `= autoJoinMembersChannel` | 475 |
| `isUserMemberOfChannel` | function | `async isUserMemberOfChannel(userId: string, channelId: string): Promise<boolean>` — Check if user is member of a channel | 480 |
| `getChannelMembers` | function | `async getChannelMembers(channelId: string)` — Get channel members | 496 |
| `getUserSubscriptions` | function | `async getUserSubscriptions(userId: string, orgId: string)` — Get user's subscriptions in an organization (for compatibility with frontend) | 508 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findById`, `find`, `findOne`; **writes:** `create`, `updateOne`, `updateMany`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`, `find`; **writes:** `findOneAndUpdate`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/user.model.ts` — `User`
  - `server/services/freeInvoice.ts` — `mintFreeItemInvoiceInBackground`, `FreeInvoiceSource`
- **Packages:** none

## Used by

- `server/routes/affiliate.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/downlines.ts`
- `server/routes/feed.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/productCheckout.ts`
- `server/routes/profile.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/services/init.ts`
- `server/services/itemReserveLicense.ts`
