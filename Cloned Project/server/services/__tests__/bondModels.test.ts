// Smoke test: the four bond schemas must compile at runtime and carry
// the indexes the payout engine's correctness depends on.
import { BondInstrument } from "../../models/bondInstrument.model";
import { BondHolding } from "../../models/bondHolding.model";
import { BondPayoutEvent } from "../../models/bondPayoutEvent.model";
import { BondLedgerEntry } from "../../models/bondLedgerEntry.model";

describe("bond models", () => {
  it("register against the expected collections", () => {
    expect(BondInstrument.collection.name).toBe("bond_instruments");
    expect(BondHolding.collection.name).toBe("bond_holdings");
    expect(BondPayoutEvent.collection.name).toBe("bond_payout_events");
    expect(BondLedgerEntry.collection.name).toBe("bond_ledger_entries");
  });

  it("enforces a UNIQUE dedupeKey on payout events", () => {
    // Without this index two concurrent setInterval ticks double-pay.
    const idx = BondPayoutEvent.schema.indexes();
    const dedupe = idx.find(([fields]) => (fields as any).dedupeKey === 1);
    expect(dedupe).toBeDefined();
    expect(dedupe?.[1]?.unique).toBe(true);
  });

  it("indexes the scheduler's hot query", () => {
    const idx = BondPayoutEvent.schema.indexes();
    const sched = idx.find(
      ([f]) => (f as any).status === 1 && (f as any).dueAt === 1,
    );
    expect(sched).toBeDefined();
  });

  it("validates a draft instrument with derived figures", async () => {
    const doc = new BondInstrument({
      orgId: "68f1fe05876fcc5fadb61951",
      createdBy: "6ab5674874d232b11fc497ac",
      name: "Test 90d daily",
      unitPriceAtomic: "100000",
      currency: "INR",
      durationDays: 90,
      payoutFrequency: "daily",
      ratePerPayoutPeriod: "1",
      totalUnits: 500,
      minUnits: 1,
      commissionBasis: "both",
      principalCommissionRate: "1",
      payoutCommissionRate: "1",
      derived: {
        payoutAmountPerUnitAtomic: "1000",
        payoutCount: 90,
        totalInterestPerUnitAtomic: "90000",
        principalCommissionPerUnitAtomic: "1000",
        payoutCommissionPerPayoutPerUnitAtomic: "10",
        totalCommissionPerUnitAtomic: "1900",
        totalOutflowPerUnitAtomic: "191900",
        sellerNetPerUnitAtomic: "-91900",
        totalRaiseAtomic: "50000000",
        totalInterestAtFullAtomic: "45000000",
        totalCommissionAtFullAtomic: "950000",
        totalOutflowAtFullAtomic: "95950000",
        sellerNetAtFullAtomic: "-45950000",
        annualisedRatePct: "360",
        stubDays: 0,
      },
    });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.status).toBe("draft");
    expect(doc.unitsSold).toBe(0);
  });

  it("rejects a currency outside the cryptobrand set", async () => {
    const doc = new BondHolding({
      instrumentId: "68f1fe05876fcc5fadb61951",
      buyerUserId: "6ab5674874d232b11fc497ac",
      orgId: "68f1fe05876fcc5fadb61951",
      units: 1,
      currency: "GBP",
      principalAtomic: "100000",
      payoutAmountPerUnitAtomic: "1000",
      payoutCount: 90,
    });
    await expect(doc.validate()).rejects.toThrow(/currency/i);
  });
});
