import { evaluate, EvalUser } from "../adminNotifications/evaluate";
import { findEvent } from "../../config/adminNotificationEvents";

const PAY = findEvent("payment.up25")!;

const SHORUPAN = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ANURAG = "bbbbbbbbbbbbbbbbbbbbbbbb";

function user(over: Partial<EvalUser> = {}): EvalUser {
  return {
    id: "cccccccccccccccccccccccc",
    email: "payer@example.com",
    ancestors: [],
    referredBy: null,
    typeFlags: {},
    ...over,
  };
}

describe("admin notification condition evaluator", () => {
  test("the three payment events are registered", () => {
    expect(findEvent("payment.up25")).toBeDefined();
    expect(findEvent("payment.up25.networkchain")).toBeDefined();
    expect(findEvent("payment.up25.networkchain.autodebit")).toBeDefined();
  });

  test("no conditions fires on every event", () => {
    expect(evaluate(undefined, {}, PAY)).toBe(true);
    expect(evaluate({ all: [] }, {}, PAY)).toBe(true);
  });

  test("an empty `any` matches nothing", () => {
    expect(evaluate({ any: [] }, {}, PAY)).toBe(false);
  });

  // The motivating example: in Shorupan's downline, but not in Anurag's —
  // including when Anurag's leg sits INSIDE Shorupan's subtree.
  test("include one downline, exclude a leg inside it", () => {
    const rule = {
      all: [
        { field: "user", op: "inDownlineOf", value: SHORUPAN },
        { not: { field: "user", op: "inDownlineOf", value: ANURAG } },
      ],
    };
    const underShorupanOnly = user({ ancestors: [SHORUPAN] });
    const underAnuragInsideShorupan = user({ ancestors: [SHORUPAN, ANURAG] });
    const underNeither = user({ ancestors: ["dddddddddddddddddddddddd"] });

    expect(evaluate(rule, { user: underShorupanOnly }, PAY)).toBe(true);
    expect(evaluate(rule, { user: underAnuragInsideShorupan }, PAY)).toBe(false);
    expect(evaluate(rule, { user: underNeither }, PAY)).toBe(false);
  });

  test("isDirectOf reads referredBy, not the whole ancestor path", () => {
    const leaf = { field: "user", op: "isDirectOf", value: SHORUPAN };
    expect(evaluate(leaf, { user: user({ referredBy: SHORUPAN, ancestors: [SHORUPAN] }) }, PAY)).toBe(true);
    expect(evaluate(leaf, { user: user({ referredBy: ANURAG, ancestors: [SHORUPAN, ANURAG] }) }, PAY)).toBe(false);
  });

  test("number operators", () => {
    const p = { amount: 25 };
    expect(evaluate({ field: "amount", op: "eq", value: 25 }, p, PAY)).toBe(true);
    expect(evaluate({ field: "amount", op: "gte", value: "25" }, p, PAY)).toBe(true);
    expect(evaluate({ field: "amount", op: "gt", value: 25 }, p, PAY)).toBe(false);
    expect(evaluate({ field: "amount", op: "lt", value: 100 }, p, PAY)).toBe(true);
  });

  test("string / enum operators are case-insensitive and `in` takes a comma list", () => {
    const p = { country: "India", autoDebitVia: "upi" };
    expect(evaluate({ field: "country", op: "equals", value: "india" }, p, PAY)).toBe(true);
    expect(evaluate({ field: "country", op: "contains", value: "ND" }, p, PAY)).toBe(true);
    expect(evaluate({ field: "autoDebitVia", op: "in", value: "card, upi" }, p, PAY)).toBe(true);
    expect(evaluate({ field: "autoDebitVia", op: "in", value: ["card"] }, p, PAY)).toBe(false);
  });

  test("boolean operators", () => {
    expect(evaluate({ field: "freeFirstMonth", op: "isTrue" }, { freeFirstMonth: true }, PAY)).toBe(true);
    expect(evaluate({ field: "freeFirstMonth", op: "isFalse" }, { freeFirstMonth: true }, PAY)).toBe(false);
    // Missing is neither true nor false — a condition on it should not pass.
    expect(evaluate({ field: "freeFirstMonth", op: "isFalse" }, {}, PAY)).toBe(false);
  });

  // Fail closed: a rule that cannot be evaluated must never fire.
  test("unknown field, unknown operator, missing user and junk nodes are false", () => {
    expect(evaluate({ field: "nope", op: "equals", value: "x" }, { nope: "x" }, PAY)).toBe(false);
    expect(evaluate({ field: "amount", op: "approximately", value: 25 }, { amount: 25 }, PAY)).toBe(false);
    expect(evaluate({ field: "user", op: "inDownlineOf", value: SHORUPAN }, { user: null }, PAY)).toBe(false);
    expect(evaluate({ field: "user", op: "inDownlineOf", value: "" }, { user: user({ ancestors: [""] }) }, PAY)).toBe(false);
    expect(evaluate({ banana: true } as any, {}, PAY)).toBe(false);
  });
});
