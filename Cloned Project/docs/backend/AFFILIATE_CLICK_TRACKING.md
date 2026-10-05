# Affiliate Click + Conversion Tracking — storefront integration

Two tiny calls the storefront makes so affiliate **clicks** and **conversions** are recorded.
Both are **public, no auth, no credentials, fire-and-forget** (always return `202`). They never
block navigation and never affect commission payout (payout stays on the existing
`referredBy` / CombPlan pipeline — this is analytics only).

**Base URL:** the roam-backend host (`https://test.garage.app`).

---

## When to call

Affiliate links land on storefront item pages with `?ref=<affiliateId>`:

| Storefront route         | `itemType` | `itemId` | `orgSlug` |
| ------------------------ | ---------- | -------- | --------- |
| `/digital/channel/{id}`  | `channel`  | `{id}`   | —         |
| `/digital/course/{id}`   | `course`   | `{id}`   | —         |
| `/digital/workshop/{id}` | `workshop` | `{id}`   | —         |
| `/digital/service/{id}`  | `service`  | `{id}`   | —         |
| `/digital/call/{id}`     | `call`     | `{id}`   | —         |
| `/digital/product/{id}`  | `product`  | `{id}`   | —         |
| `/product/{id}`          | `product`  | `{id}`   | —         |
| `/hq/{slug}`             | `office`   | —        | `{slug}`  |

- **Click:** on item-page mount, when the URL has `?ref`.
- **Conversion:** when a purchase made under that ref completes.

---

## 1. `POST /affiliate/click`

```jsonc
{
  "affiliateId": "aff_t1qrarx", // required — the ?ref value
  "itemType": "course", // required — from the table above
  "itemId": "69a5...", // required except office
  "orgSlug": "the-network-economy", // office pages only
  "sessionId": "<uuid>", // required — persist in sessionStorage
  "visitorId": "<uuid>", // persist in localStorage (unique visitors)
  "referrerUrl": "<document.referrer>",
}
// → 202 { "success": true }
```

Idempotent on `{sessionId, itemId}` — a stable `sessionId` collapses reloads to one click.

## 2. `POST /affiliate/conversion`

```jsonc
{
  "affiliateId": "aff_t1qrarx", // required
  "itemType": "course", // required
  "itemId": "69a5...", // required except office
  "orgSlug": "the-network-economy", // office only
  "sessionId": "<uuid>", // same id the click used (best for funnel linkage)
  "visitorId": "<uuid>",
  "orderId": "<order/payment id>", // strongly recommended — idempotency key
  "amount": 49.0,
  "currency": "USD",
}
// → 202 { "success": true }
```

Idempotent on `orderId` — safe to retry / fire from a webhook.

---

## Drop-in snippet

```js
const ROAM = "https://test.garage.app"; // confirmed prod host

const uuid = () => {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
  );
};
const pid = (store, key) => {
  let v = store.getItem(key);
  if (!v) {
    v = uuid();
    try {
      store.setItem(key, v);
    } catch {}
  }
  return v;
};
const ids = () => ({
  sessionId: pid(sessionStorage, "ga_click_sid"),
  visitorId: pid(localStorage, "ga_click_vid"),
});
const post = (path, body) =>
  fetch(`${ROAM}${path}`, {
    method: "POST",
    keepalive: true,
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});

// on item-page mount (ref from the URL ?ref=)
export function trackAffiliateClick({
  affiliateId,
  itemType,
  itemId,
  orgSlug,
}) {
  if (!affiliateId) return;
  post("/affiliate/click", {
    affiliateId,
    itemType,
    itemId,
    orgSlug,
    ...ids(),
    referrerUrl: document.referrer,
  });
}

// on successful purchase
export function trackAffiliateConversion(p) {
  if (!p.affiliateId) return;
  post("/affiliate/conversion", { ...p, ...ids() });
}
```

---

## Notes

- **Bots / prefetch** are filtered server-side (UA + `x-purpose: prefetch`) — no action needed.
- **CORS** is open and the calls send no credentials, so there's no preflight friction.
- Persist `sessionId`/`visitorId` exactly as shown so dedup + unique-visitor counts work.
- Items with no active commission plan are still recorded (they just won't credit a saved link).

## curl (quick test)

```bash
curl -s -X POST "$ROAM/affiliate/click" -H 'Content-Type: application/json' \
  -d '{"affiliateId":"aff_t1qrarx","itemType":"course","itemId":"<id>","sessionId":"test-sess-1"}'

curl -s -X POST "$ROAM/affiliate/conversion" -H 'Content-Type: application/json' \
  -d '{"affiliateId":"aff_t1qrarx","itemType":"course","itemId":"<id>","sessionId":"test-sess-1","orderId":"ord_123","amount":49,"currency":"USD"}'
```
