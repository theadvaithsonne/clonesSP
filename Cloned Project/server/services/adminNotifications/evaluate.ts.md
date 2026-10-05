# `server/services/adminNotifications/evaluate.ts`

> Condition evaluation for admin notification rules.

**Kind:** backend service · **Lines:** 136

<!-- docgen:auto -->

## Purpose
Condition evaluation for admin notification rules. Pure and synchronous.

Pure on purpose: every database read happens BEFORE this runs (the emitter
hydrates the payload), so evaluation can be unit-tested exhaustively and
reused as-is for a dry run over past events.

FAIL CLOSED. An unknown field, an unknown operator, or a malformed node
evaluates to false. A rule that cannot be evaluated must never fire — the
cost of a missed email is small; the cost of mailing on a condition nobody
actually wrote is not.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EvalUser` | interface | A user as the evaluator sees it. | 20 |
| `EvalPayload` | type |  | 29 |
| `evaluate` | function | `evaluate(node: ConditionNode \| undefined \| null, payload: EvalPayload, event: AdminEventDescriptor): boolean` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/adminNotificationRule.model.ts` — `ConditionNode`, `(types only)`
  - `server/config/adminNotificationEvents.ts` — `AdminEventDescriptor`, `EventFieldType`, `(types only)`
- **Packages:** none

## Used by

- `server/services/__tests__/adminNotificationEvaluate.test.ts`
- `server/services/adminNotifications/dispatch.ts`
- `server/services/adminNotifications/paymentEvents.ts`
