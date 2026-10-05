// Condition evaluation for admin notification rules. Pure and synchronous.
//
// Pure on purpose: every database read happens BEFORE this runs (the emitter
// hydrates the payload), so evaluation can be unit-tested exhaustively and
// reused as-is for a dry run over past events.
//
// FAIL CLOSED. An unknown field, an unknown operator, or a malformed node
// evaluates to false. A rule that cannot be evaluated must never fire — the
// cost of a missed email is small; the cost of mailing on a condition nobody
// actually wrote is not.

import type { ConditionNode } from "../../models/adminNotificationRule.model";
import type { AdminEventDescriptor, EventFieldType } from "../../config/adminNotificationEvents";

/**
 * A user as the evaluator sees it. Hydrated by the emitter, so `inDownlineOf`
 * is a set lookup over the denormalised `User.ancestors[]` path rather than a
 * graph walk at evaluation time.
 */
export interface EvalUser {
  id: string;
  email?: string | null;
  name?: string | null;
  ancestors: string[];
  referredBy: string | null;
  typeFlags: Record<string, boolean>;
}

export type EvalPayload = Record<string, unknown>;

export function evaluate(
  node: ConditionNode | undefined | null,
  payload: EvalPayload,
  event: AdminEventDescriptor,
): boolean {
  // No conditions = "fire on every event". An empty `all` is vacuously true,
  // which is exactly what the builder saves when no condition is added.
  if (node == null) return true;
  if (typeof node !== "object") return false;

  if ("all" in node) {
    return Array.isArray(node.all) && node.all.every((n) => evaluate(n, payload, event));
  }
  if ("any" in node) {
    // An empty `any` is vacuously FALSE — "any of nothing" matches nothing.
    return Array.isArray(node.any) && node.any.some((n) => evaluate(n, payload, event));
  }
  if ("not" in node) {
    return node.not != null && !evaluate(node.not, payload, event);
  }
  if ("field" in node && "op" in node) {
    const field = event.fields.find((f) => f.key === node.field);
    if (!field) return false;
    return evalLeaf(field.type, node.op, payload[node.field], node.value);
  }
  return false;
}

function evalLeaf(type: EventFieldType, op: string, actual: unknown, expected: unknown): boolean {
  switch (type) {
    case "user":
      return evalUser(op, actual as EvalUser | null | undefined, expected);
    case "number":
      return evalNumber(op, actual, expected);
    case "boolean":
      if (op === "isTrue") return actual === true;
      if (op === "isFalse") return actual === false;
      return false;
    case "string":
    case "enum":
      return evalString(op, actual, expected);
    default:
      return false;
  }
}

function evalUser(op: string, user: EvalUser | null | undefined, expected: unknown): boolean {
  if (!user) return false;
  const target = expected == null ? "" : String(expected);
  switch (op) {
    case "inDownlineOf":
      return target !== "" && user.ancestors.includes(target);
    case "isDirectOf":
      return target !== "" && user.referredBy === target;
    case "is":
      return target !== "" && user.id === target;
    case "hasTypeFlag":
      return target !== "" && user.typeFlags?.[target] === true;
    default:
      return false;
  }
}

function evalNumber(op: string, actual: unknown, expected: unknown): boolean {
  const a = typeof actual === "number" ? actual : Number.NaN;
  const e = Number(expected);
  if (Number.isNaN(a) || Number.isNaN(e)) return false;
  switch (op) {
    case "eq":
      return a === e;
    case "gt":
      return a > e;
    case "gte":
      return a >= e;
    case "lt":
      return a < e;
    case "lte":
      return a <= e;
    default:
      return false;
  }
}

/** Case-insensitive. `in` accepts an array or a comma-separated string — the
 *  builder's value box is a plain text input. */
function evalString(op: string, actual: unknown, expected: unknown): boolean {
  if (actual == null) return false;
  const a = String(actual).trim().toLowerCase();
  switch (op) {
    case "equals":
      return expected != null && a === String(expected).trim().toLowerCase();
    case "contains": {
      const needle = expected == null ? "" : String(expected).trim().toLowerCase();
      return needle !== "" && a.includes(needle);
    }
    case "in": {
      const list = Array.isArray(expected)
        ? expected.map((v) => String(v))
        : String(expected ?? "").split(",");
      return list.map((v) => v.trim().toLowerCase()).filter(Boolean).includes(a);
    }
    default:
      return false;
  }
}
