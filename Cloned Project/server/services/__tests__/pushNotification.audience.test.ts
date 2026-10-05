/**
 * Which device tokens each kind of push is allowed to reach.
 *
 * This is the whole contract between the two apps that register here: a knock
 * belongs to garage-chat alone, an office message belongs to garage-chat AND
 * NetworkChains (the same thread is open in both), and wallet money belongs to
 * every app. Getting the filter wrong is silent — the push simply doesn't
 * arrive — so it is asserted rather than reasoned about.
 */

const find = jest.fn();

jest.mock("../../models/deviceToken.model", () => ({
  DeviceToken: {
    find: (...args: any[]) => find(...args),
    findOneAndUpdate: jest.fn(),
  },
}));

// Blocks and mutes are a different concern than audience routing, and both hit
// Mongo. Unmocked they made every send here either throw (`new ObjectId("sender")`
// on a non-ObjectId test id) or hang for the full 5s jest timeout — which is why
// this suite was red before these mocks existed.
jest.mock("../../models/chatBlock.model", () => ({
  hasBlocked: jest.fn(async () => false),
  blockersOf: jest.fn(async () => []),
}));

jest.mock("../../models/chatMute.model", () => ({
  // Returns a Set, not an array — callers do `muted.has(id)`.
  mutedUserIds: jest.fn(async () => new Set<string>()),
}));

// No network, and no token means sendPushToUser returns before touching Expo.
jest.mock("expo-server-sdk", () => ({
  __esModule: true,
  default: class {
    chunkPushNotifications() {
      return [];
    }
    sendPushNotificationsAsync() {
      return Promise.resolve([]);
    }
  },
}));

import {
  sendCommissionEarnedPushNotification,
  sendDMPushNotification,
  sendGroupPushNotification,
  sendKnockPushNotification,
  sendMentionPushNotification,
  sendFeedEngagementPushNotification,
  sendTransferReceivedPushNotification,
} from "../pushNotification";

beforeEach(() => {
  find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
});

/** The `app` clause the send under test queried with. */
const appFilter = () => find.mock.calls[0][0].app;

const USER = "507f1f77bcf86cd799439011";

describe("chat-only pushes", () => {
  it("a knock reaches garage-chat tokens only", async () => {
    await sendKnockPushNotification(USER, "knocker", "Knocker");
    // null matches rows written before `app` existed — they are garage-chat.
    expect(appFilter()).toEqual({ $in: [null, "garage-chat"] });
  });
});

describe("message pushes", () => {
  it("a DM reaches garage-chat and NetworkChains", async () => {
    await sendDMPushNotification(USER, "sender", "Sender", "hi", "dm:a:b", "m1");
    expect(appFilter()).toEqual({ $in: [null, "garage-chat", "networkchain"] });
  });

  it("a group message reaches garage-chat and NetworkChains", async () => {
    await sendGroupPushNotification(
      [USER, "sender"],
      "sender",
      "Sender",
      "g1",
      "Group",
      "hi",
      "m1"
    );
    expect(appFilter()).toEqual({ $in: [null, "garage-chat", "networkchain"] });
  });

  it("a mention reaches garage-chat and NetworkChains", async () => {
    await sendMentionPushNotification(
      USER,
      "sender",
      "Sender",
      "g1",
      "Group",
      "hi",
      "m1"
    );
    expect(appFilter()).toEqual({ $in: [null, "garage-chat", "networkchain"] });
  });

  it("sends the group push to every member except its sender", async () => {
    await sendGroupPushNotification(
      ["member", "sender"],
      "sender",
      "Sender",
      "g1",
      "Group",
      "hi",
      "m1"
    );
    expect(find.mock.calls.map((c) => c[0].userId)).toEqual(["member"]);
  });
});

describe("wallet money pushes", () => {
  it("a commission is not restricted by app", async () => {
    await sendCommissionEarnedPushNotification(USER, {
      amount: 450,
      currency: "usd",
    });
    expect(appFilter()).toBeUndefined();
  });

  it("a transfer is not restricted by app", async () => {
    await sendTransferReceivedPushNotification(USER, {
      amount: 25,
      currency: "usd",
    });
    expect(appFilter()).toBeUndefined();
  });
});

describe("every audience", () => {
  it("only ever looks at active tokens for the one user", async () => {
    await sendDMPushNotification(USER, "sender", "Sender", "hi", "dm:a:b", "m1");
    expect(find.mock.calls[0][0]).toMatchObject({ userId: USER, isActive: true });
  });
});

describe("feed pushes", () => {
  const AUTHOR = "507f1f77bcf86cd799439012";

  it("a feed engagement reaches NetworkChains only", async () => {
    await sendFeedEngagementPushNotification(
      USER,
      { id: AUTHOR, name: "Actor" },
      { id: "post1" },
      { kind: "repost" }
    );
    // No `null`: a row with no `app` is a garage-chat install, and garage-chat
    // has no feed to open. This is the one audience that excludes them.
    expect(appFilter()).toEqual({ $in: ["networkchain"] });
  });

  it("does not notify you about your own post", async () => {
    await sendFeedEngagementPushNotification(
      USER,
      { id: USER, name: "Me" },
      { id: "post1" },
      { kind: "reaction", reactionType: "like" }
    );
    expect(find).not.toHaveBeenCalled();
  });
});
