import {
  resolveBuyerGstRegion,
  resolveOrgGstRegion,
  isBuyerInIndia,
} from "../gstBuyerRegion";

// resolveBuyerGstRegion only touches the DB when neither `buyerUser` nor an
// address is supplied AND `buyerUserId` is passed. Every case below supplies
// the data directly, so no Mongo connection is needed.

const IN_ADDR = { country: "India", state: "Karnataka", city: "Bengaluru" };
const US_ADDR = { country: "United States", state: "CA", city: "San Jose" };

describe("resolveBuyerGstRegion — precedence", () => {
  it("shipping address wins over billing and profile", async () => {
    const r = await resolveBuyerGstRegion({
      shippingAddress: US_ADDR,
      billingAddress: IN_ADDR,
      buyerUser: { country: "India" },
      paymentCurrency: "INR",
    });
    expect(r.inIndia).toBe(false);
    expect(r.source).toBe("shipping");
    expect(r.country).toBe("United States");
  });

  it("billing address wins over profile when there is no shipping address", async () => {
    const r = await resolveBuyerGstRegion({
      billingAddress: IN_ADDR,
      buyerUser: { country: "United States" },
      paymentCurrency: "USD",
    });
    expect(r.inIndia).toBe(true);
    expect(r.source).toBe("billing");
  });

  it("falls back to the profile country when no address is given", async () => {
    const r = await resolveBuyerGstRegion({
      buyerUser: { country: "India" },
      paymentCurrency: "USD",
    });
    expect(r.inIndia).toBe(true);
    expect(r.source).toBe("profile");
  });

  it("a resolved country beats the payment currency", async () => {
    // The case that motivated the quote endpoint: an Indian buyer paying in
    // USD still owes GST.
    const r = await resolveBuyerGstRegion({
      buyerUser: { country: "India" },
      paymentCurrency: "USD",
    });
    expect(r.inIndia).toBe(true);
    expect(r.source).not.toBe("payment_currency");
  });
});

describe("resolveBuyerGstRegion — payment-currency fallback", () => {
  it.each([
    ["INR", true],
    ["inr", true],
    ["USD", false],
    ["", false],
    [null, false],
  ])("currency %p resolves inIndia=%p", async (currency, expected) => {
    const r = await resolveBuyerGstRegion({
      buyerUser: null,
      paymentCurrency: currency as any,
    });
    expect(r.inIndia).toBe(expected);
    expect(r.source).toBe("payment_currency");
    expect(r.country).toBeNull();
  });

  it("ignores an address whose country is blank", async () => {
    const r = await resolveBuyerGstRegion({
      shippingAddress: { country: "   ", city: "Nowhere" },
      paymentCurrency: "INR",
    });
    expect(r.source).toBe("payment_currency");
    expect(r.inIndia).toBe(true);
  });

  it("attributes the source past a blank shipping country", async () => {
    // A whitespace country is truthy but is skipped by resolveBuyerAddress,
    // so the source must report where the country actually came from.
    const r = await resolveBuyerGstRegion({
      shippingAddress: { country: "  " },
      buyerUser: { country: "India" },
      paymentCurrency: "USD",
    });
    expect(r.inIndia).toBe(true);
    expect(r.source).toBe("profile");
    expect(r.country).toBe("India");
  });

  it("guest with no profile and no address is not India when paying USD", async () => {
    // The majority path on channel/course/workshop checkouts.
    const r = await resolveBuyerGstRegion({
      buyerUser: { country: undefined },
      paymentCurrency: "USD",
    });
    expect(r.inIndia).toBe(false);
    expect(r.source).toBe("payment_currency");
  });
});

describe("resolveOrgGstRegion — office / add-ons / conference rooms", () => {
  // No orgId supplied, so no DB read: these exercise the fallback chain that
  // runs when the org has no country of its own.

  it("falls back to the subscriber's profile when no org is given", async () => {
    const r = await resolveOrgGstRegion({
      subscriberUserId: undefined,
      paymentCurrency: "INR",
    });
    expect(r.inIndia).toBe(true);
    expect(r.source).toBe("payment_currency");
  });

  it("a USD-priced plan with no resolvable org or user is not India", async () => {
    // Office plans are USD, so an org we cannot place resolves to no-GST.
    const r = await resolveOrgGstRegion({ paymentCurrency: "USD" });
    expect(r.inIndia).toBe(false);
    expect(r.source).toBe("payment_currency");
  });

  it("never reports source 'org' when no org country was found", async () => {
    const r = await resolveOrgGstRegion({ paymentCurrency: "USD" });
    expect(r.source).not.toBe("org");
    expect(r.country).toBeNull();
  });
});

describe("isBuyerInIndia", () => {
  it("returns a bare boolean for commission sites", async () => {
    // No buyerUser passed and no DB available, so this exercises the
    // currency fallback path after the User lookup fails soft.
    await expect(isBuyerInIndia("000000000000000000000000", "INR")).resolves.toBe(
      true
    );
    await expect(isBuyerInIndia("000000000000000000000000", "USD")).resolves.toBe(
      false
    );
  });
});
