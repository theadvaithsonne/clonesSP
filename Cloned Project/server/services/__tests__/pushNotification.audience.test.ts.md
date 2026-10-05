# `server/services/__tests__/pushNotification.audience.test.ts`

> Which device tokens each kind of push is allowed to reach.

**Kind:** test · **Lines:** 170

<!-- docgen:auto -->

## Purpose
Which device tokens each kind of push is allowed to reach.

This is the whole contract between the two apps that register here: a knock
belongs to garage-chat alone, an office message belongs to garage-chat AND
NetworkChains (the same thread is open in both), and wallet money belongs to
every app. Getting the filter wrong is silent — the push simply doesn't
arrive — so it is asserted rather than reasoned about.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (10)

- **chat-only pushes**
  - a knock reaches garage-chat tokens only
- **message pushes**
  - a DM reaches garage-chat and NetworkChains
  - a group message reaches garage-chat and NetworkChains
  - a mention reaches garage-chat and NetworkChains
  - sends the group push to every member except its sender
- **wallet money pushes**
  - a commission is not restricted by app
  - a transfer is not restricted by app
- **every audience**
  - only ever looks at active tokens for the one user
- **feed pushes**
  - a feed engagement reaches NetworkChains only
  - does not notify you about your own post

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/pushNotification.ts` — `sendCommissionEarnedPushNotification`, `sendDMPushNotification`, `sendGroupPushNotification`, `sendKnockPushNotification`, `sendMentionPushNotification`, `sendFeedEngagementPushNotification`, `sendTransferReceivedPushNotification`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
