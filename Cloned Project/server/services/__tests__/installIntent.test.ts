jest.mock("../../models/installIntent.model", () => ({
  InstallIntent: { find: jest.fn(), findOneAndUpdate: jest.fn() },
}));

import { InstallIntent } from "../../models/installIntent.model";
import { claimIntent, Fingerprint } from "../installIntent";

const find = InstallIntent.find as unknown as jest.Mock;
const findOneAndUpdate = InstallIntent.findOneAndUpdate as unknown as jest.Mock;

/** `find(...).sort().limit().lean()` resolving to `rows`. */
function rowsFor(rows: any[]) {
  return { sort: () => ({ limit: () => ({ lean: async () => rows }) }) };
}

/** The claim redeems whatever row it was handed. */
function redeemAsIs() {
  findOneAndUpdate.mockImplementation((q: any, update: any) => ({
    lean: async () => ({ _id: q._id, link: `link-of-${q._id}`, ...update.$set }),
  }));
}

const PHONE: Fingerprint = {
  platform: "ios",
  app: "nc",
  ipHash: "jio-cgnat",
  userAgent: "NetworkChains/42 CFNetwork Darwin/25",
  osVersion: "26.0",
  screen: "390x844",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
};

function row(id: string, over: Record<string, unknown> = {}) {
  return {
    _id: id,
    link: `/register/aff_${id}`,
    screen: "390x844",
    timezone: "Asia/Kolkata",
    osVersion: "18.6", // iOS 26 Safari's frozen UA — must not disqualify
    locale: "en-IN",
    ...over,
  };
}

describe("install-intent claim", () => {
  beforeEach(() => {
    find.mockReset();
    findOneAndUpdate.mockReset();
    redeemAsIs();
  });

  test("claims this device's row", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine01")]));
    expect(await claimIntent(PHONE)).toBe("link-of-mine01");
  });

  test("GarageIRL claims only rows parked for GarageIRL", async () => {
    find.mockReturnValueOnce(rowsFor([row("irl001", { link: "/s/cafe-x?ref=table-4" })]));
    expect(await claimIntent({ ...PHONE, app: "pay" })).toBe("link-of-irl001");
    expect(find.mock.calls[0][0].app).toBe("pay");
  });

  test("a lone stranger's row on the same IP is not handed over", async () => {
    // Different phone model, same carrier NAT — previously won at score 0.
    find.mockReturnValueOnce(rowsFor([row("them01", { screen: "430x932" })]));
    expect(await claimIntent(PHONE)).toBeNull();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("a different timezone is a different device", async () => {
    find.mockReturnValueOnce(rowsFor([row("them02", { timezone: "Europe/London" })]));
    expect(await claimIntent(PHONE)).toBeNull();
  });

  test("the stranger is skipped, this device's row still wins", async () => {
    find.mockReturnValueOnce(
      rowsFor([row("them03", { screen: "430x932" }), row("mine02")]),
    );
    expect(await claimIntent(PHONE)).toBe("link-of-mine02");
  });

  test("landscape and portrait are the same screen", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine03", { screen: "844x390" })]));
    expect(await claimIntent(PHONE)).toBe("link-of-mine03");
  });

  test("a side that reports nothing stays claimable", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine04", { screen: null, timezone: null })]));
    expect(await claimIntent(PHONE)).toBe("link-of-mine04");
  });

  test("screen is not enforced on Android (the app's window excludes the bars)", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine05", { screen: "412x915" })]));
    expect(await claimIntent({ ...PHONE, platform: "android", screen: "412x869" })).toBe(
      "link-of-mine05",
    );
  });

  test("the claim records who redeemed it, and a re-claim asks for exactly that", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine06")]));
    await claimIntent(PHONE);
    const key = findOneAndUpdate.mock.calls[0][1].$set.claimerKey;
    expect(key).toMatch(/^[0-9a-f]{64}$/);

    find.mockReturnValueOnce(rowsFor([])); // nothing unclaimed left
    find.mockReturnValueOnce(rowsFor([row("mine06")]));
    await claimIntent(PHONE, { reclaim: true });
    expect(find.mock.calls[2][0].claimerKey).toBe(key);
  });

  test("another phone on the network re-claims under a different key", async () => {
    find.mockReturnValueOnce(rowsFor([row("mine07")]));
    await claimIntent(PHONE);
    const mine = findOneAndUpdate.mock.calls[0][1].$set.claimerKey;

    find.mockReturnValueOnce(rowsFor([]));
    find.mockReturnValueOnce(rowsFor([]));
    await claimIntent(
      { ...PHONE, screen: "430x932", userAgent: "NetworkChains/42 CFNetwork Darwin/24" },
      { reclaim: true },
    );
    expect(find.mock.calls[2][0].claimerKey).not.toBe(mine);
  });
});
