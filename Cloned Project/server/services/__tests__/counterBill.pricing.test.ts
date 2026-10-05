/**
 * Counter-bill pricing — the figures a seller shows a customer before they pay.
 *
 * These go straight onto an invoice someone pays, so the rules are asserted
 * rather than reasoned about: add-ons are priced from the product (never the
 * client), service charge is a share of the repriced items, charges are never
 * discounted or taxed, and an amount-only bill is exactly the typed amount.
 */
import { Types } from "mongoose";

const ORG = new Types.ObjectId().toString();
const SELLER = new Types.ObjectId().toString();
const BILL = new Types.ObjectId().toString();
const BAO = new Types.ObjectId().toString();
const RISOTTO = new Types.ObjectId().toString();

const products = [
  {
    _id: new Types.ObjectId(BAO),
    orgId: new Types.ObjectId(ORG),
    title: "Butter Chicken Bao",
    price: 380,
    currency: "INR",
    status: "active",
    requiresShipping: false,
    taxable: true,
    gstInclusive: false,
    itemDetails: {
      addOns: [
        { label: "Extra cheese", price: 60 },
        { label: "Truffle oil", price: 90, enabled: false },
      ],
    },
  },
  {
    _id: new Types.ObjectId(RISOTTO),
    orgId: new Types.ObjectId(ORG),
    title: "Truffle Mushroom Risotto",
    price: 520,
    currency: "INR",
    status: "active",
    requiresShipping: false,
    taxable: true,
    gstInclusive: false,
  },
];

jest.mock("../../models/storeProduct.model", () => ({
  StoreProduct: {
    find: () => ({ lean: async () => products }),
  },
}));
jest.mock("../../models/productVariant.model", () => ({
  ProductVariant: { find: () => ({ lean: async () => [] }) },
}));
jest.mock("../../models/store.model", () => ({
  Store: {
    find: () => ({
      lean: async () => [
        { _id: new Types.ObjectId(), orgId: new Types.ObjectId(ORG), name: "Bao House", currency: "INR" },
      ],
    }),
  },
}));
jest.mock("../../models/user.model", () => ({
  User: {
    aggregate: async () => [
      { _id: new Types.ObjectId(SELLER), orgId: new Types.ObjectId(ORG), joinedAt: new Date(0) },
    ],
  },
}));
jest.mock("../../models/invoice.model", () => ({
  Invoice: { create: jest.fn(async (doc: any) => ({ ...doc, _id: new Types.ObjectId() })) },
}));
// An Indian buyer, so GST applies to taxable lines.
jest.mock("../../utils/gstBuyerRegion", () => ({
  resolveBuyerGstRegion: async () => ({ inIndia: true, country: "India", source: "test" }),
  gstSkippedMetadata: () => ({}),
}));

import { createEcommerceInvoice, EcommerceError } from "../ecommerceInvoice";
import {
  makeAttachCode,
  normaliseAttachCode,
  toInvoiceInputs,
  totalsFromInvoice,
} from "../counterBill";

const bill = (over: Record<string, any> = {}) =>
  ({
    _id: new Types.ObjectId(BILL),
    orgId: new Types.ObjectId(ORG),
    mode: "itemised",
    lines: [
      { productId: new Types.ObjectId(RISOTTO), title: "Risotto", unitPrice: 52000, quantity: 1, addOns: [] },
      {
        productId: new Types.ObjectId(BAO),
        title: "Bao",
        unitPrice: 38000,
        quantity: 2,
        addOns: [{ label: "Extra cheese", price: 6000 }],
      },
    ],
    serviceChargePct: 5,
    packaging: 2000,
    ...over,
  }) as any;

const dryRun = async (b: any) => {
  const { items, customLines } = toInvoiceInputs(b);
  const r = await createEcommerceInvoice({
    userId: SELLER,
    customerEmail: "seller@example.com",
    items,
    customLines,
    displayCurrency: "INR",
    requireShippingAddress: false,
    dryRun: true,
  });
  return r.invoice as any;
};

describe("counter bill pricing", () => {
  it("prices add-ons from the product and folds them into the unit price", async () => {
    const inv = await dryRun(bill({ serviceChargePct: 0, packaging: 0 }));
    const bao = inv.lineItems.find((l: any) => String(l.itemId) === BAO);
    expect(bao.itemName).toBe("Butter Chicken Bao + Extra cheese");
    expect(bao.addOns).toEqual([{ label: "Extra cheese", price: 6000 }]);
    // (380 + 60) × 100 paise, pre-tax (exclusive product)
    expect(bao.unitPrice).toBe(44000);
    expect(bao.totalPrice).toBe(88000);
  });

  it("ignores the client's add-on price and rejects add-ons the product doesn't offer", async () => {
    const tampered = bill({
      lines: [
        {
          productId: new Types.ObjectId(BAO),
          title: "Bao",
          unitPrice: 1,
          quantity: 1,
          addOns: [{ label: "Extra cheese", price: 1 }],
        },
      ],
      serviceChargePct: 0,
      packaging: 0,
    });
    const inv = await dryRun(tampered);
    expect(inv.lineItems[0].unitPrice).toBe(44000);

    const disabled = bill({
      lines: [
        { productId: new Types.ObjectId(BAO), title: "Bao", unitPrice: 0, quantity: 1, addOns: [{ label: "Truffle oil", price: 0 }] },
      ],
    });
    await expect(dryRun(disabled)).rejects.toMatchObject({ code: "ADDON_NOT_FOUND" });
  });

  it("adds service charge on the items and packaging, untaxed, and reads the summary back", async () => {
    const inv = await dryRun(bill());
    // items: 520 + 2 × 440 = 1400 → 140000 paise
    const t = totalsFromInvoice(inv);
    expect(t.itemTotal).toBe(140000);
    expect(t.serviceCharge).toBe(7000); // 5% of the items
    expect(t.packaging).toBe(2000);
    // GST only on the product lines (18% of 140000)
    expect(t.tax).toBe(25200);
    expect(t.discount).toBe(0);
    expect(t.total).toBe(140000 + 7000 + 2000 + 25200);

    const charges = inv.lineItems.filter((l: any) => l.lineKind === "charge");
    expect(charges.map((c: any) => c.itemName)).toEqual(["Service charge (5%)", "Packaging"]);
    // Charges carry the bill as their itemId and the store's seller, so the
    // seller is credited for them at fulfilment.
    for (const c of charges) {
      expect(String(c.itemId)).toBe(BILL);
      expect(String(c.sellerId)).toBe(SELLER);
      expect(String(c.organizationId)).toBe(ORG);
    }
    expect(inv.metadata.requiresShipping).toBe(false);
  });

  it("bills an amount-only bill for exactly the typed amount", async () => {
    const inv = await dryRun(
      bill({ mode: "amount", amount: 50000, amountLabel: "Haircut", serviceChargePct: 5, packaging: 0 })
    );
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.lineItems[0]).toMatchObject({ itemName: "Haircut", lineKind: "custom", totalPrice: 50000 });
    expect(inv.tax).toBe(0);
    expect(inv.totalAmount).toBe(50000);
  });

  it("refuses custom lines on a non-INR cart", async () => {
    const { items, customLines } = toInvoiceInputs(bill({ mode: "amount", amount: 100 }));
    await expect(
      createEcommerceInvoice({
        userId: SELLER,
        customerEmail: "s@example.com",
        items,
        customLines,
        displayCurrency: "USD",
        requireShippingAddress: false,
        dryRun: true,
      })
    ).rejects.toBeInstanceOf(EcommerceError);
  });

  it("keeps a plain line and an add-on line of the same product apart", async () => {
    const inv = await dryRun(
      bill({
        lines: [
          { productId: new Types.ObjectId(BAO), title: "Bao", unitPrice: 0, quantity: 1, addOns: [] },
          { productId: new Types.ObjectId(BAO), title: "Bao", unitPrice: 0, quantity: 1, addOns: [{ label: "extra CHEESE", price: 0 }] },
        ],
        serviceChargePct: 0,
        packaging: 0,
      })
    );
    expect(inv.lineItems.map((l: any) => l.unitPrice).sort()).toEqual([38000, 44000]);
  });
});

describe("attach codes", () => {
  it("are 7 unambiguous characters and survive a round trip", () => {
    for (let i = 0; i < 200; i++) {
      const code = makeAttachCode();
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{7}$/);
      expect(normaliseAttachCode(` ${code.toLowerCase()} `)).toBe(code);
    }
  });

  it("reject anything that isn't one", () => {
    expect(normaliseAttachCode("ABC")).toBeNull();
    expect(normaliseAttachCode("ABCDEF0")).toBeNull(); // 0 is not in the alphabet
    expect(normaliseAttachCode("")).toBeNull();
  });
});
