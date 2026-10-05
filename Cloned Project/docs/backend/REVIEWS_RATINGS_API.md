# Reviews & Ratings API

Polymorphic ratings + written reviews. One system serves communities
(channels), courses, products, workshops, services and calls — adding a new
reviewable thing does not mean a new model or new endpoints.

Base path: `/reviews`

---

## Data model

| Collection | Purpose |
|---|---|
| `Review` | One row per (target, user). The review itself. |
| `RatingSummary` | Denormalized aggregate per target — average, per-star counts, verified/owner tallies. Rebuilt in full on every write. |
| `ReviewVote` | One row per (review, user) — the Helpful / Unhelpful vote. |

**Target types:** `channel` (a community) · `course` · `product` · `workshop` ·
`service` · `call` · `office` (the organization itself)

**Review statuses:** `published` (counts toward the average) · `pending` ·
`hidden` (excluded from public lists and from the average)

### Consistency

Every write — create, edit, delete, moderate — runs in a MongoDB transaction
that also rebuilds the target's `RatingSummary` from source. Two concurrent
reviews of the same target contend on the one summary document, so the second
transaction hits a write conflict and is retried by `withTransaction`. That is
what serializes them. Because the rebuild is a full recompute rather than an
increment, a drifted row self-heals on the next write, and
`scripts/rebuild-rating-summaries.ts` can repair any row at any time.

---

## Who is allowed to review

Access is enforced **server-side per target type**. The endpoint never assumes
the client only showed the form to eligible users.

| Target | Gate |
|---|---|
| `channel` | Active `ChannelMembership`. Free and auto-joined communities count — membership is the gate, not payment. |
| `course` | `CourseEnrollment` with status `enrolled` or `completed` |
| `product` | A `ProductOrder` containing the product with `paymentStatus: "paid"`, not cancelled or refunded. Payment status is the gate — not order status — because an order can be `confirmed` with payment still pending (COD), and the fulfilment statuses don't apply to digital products. |
| `workshop` | `WorkshopRegistration` with status `registered` or `attended` |
| `service` | `ServiceOpt` with status `completed` |
| `call` | Any `CallPurchase` |
| `office` | Membership of that org — `User.organizations.organization`, or the legacy `User.organization`. The target id *is* the org id. Never a verified purchase: there is nothing to buy. |

**Founders are handled per target type:**

| | A founder of the owning org… |
|---|---|
| `office` | **Cannot review it at all.** `403`. An office is its founder's own house; a self-authored rating under a "Founder" byline is exactly what an office rating exists to avoid. Enforced in `assertCanReview`, reported as `canReview: false, reason: "owner"` by the eligibility endpoint. |
| everything else | **Bypasses the access gate** — it's their own community/course/product. The review is stored with `isOwnerReview: true`, **excluded from the public average and count**, and tallied separately as `ownerReviewCount`. |

The block list is `OWNER_CANNOT_REVIEW` / `ownerMayReview()` in
`services/review.ts`; `REVIEW_AVERAGE_EXCLUDES_OWNER` governs the softer rule
for everything else. Changing the latter requires a summary rebuild — see
Operations below.

`isVerifiedPurchase` is a **signal, not a gate** — true when access traced to a
payment. Use it for a "Verified purchase" badge or the `verifiedOnly` filter.

---

## Endpoints

Reads use soft auth: they work for signed-out guests (public channel pages,
Discover) and additionally return `isMine` / `viewerVote` when a token is
present. Writes require auth.

### `POST /reviews/summaries`

Batched summaries for a grid — the Discover cards fetch every rating in one
round trip. Ids with no reviews come back zeroed, so the caller can map 1:1.

```jsonc
// request
{ "targetType": "channel", "targetIds": ["652f…01", "652f…02"] }

// response
{
  "success": true,
  "summaries": {
    "652f…01": { "average": 4.8, "count": 128, "distribution": {...}, ... },
    "652f…02": { "average": 0,   "count": 0,   ... }
  }
}
```

Max 200 ids per request.

### `GET /reviews/targets/:targetType/:targetId`

The reviews list **and** the full summary in one response — a detail panel
renders from a single request.

Query params: `page`, `limit` (max 100), `sort`, `rating`, `verifiedOnly`,
`includeHidden`.

- `sort` — `recent` (default) · `helpful` · `highest` · `lowest`
- `rating` — 1-5, powers the "5 Stars / 4 Stars" filter chips
- `verifiedOnly` — `true`/`false`
- `includeHidden` — founders only; silently ignored for everyone else

```jsonc
{
  "success": true,
  "reviews": [
    {
      "_id": "…",
      "rating": 5,
      "title": "Best platform for early stage UI resources",
      "body": "Absolutely fantastic community…",
      "images": ["https://…/screenshot.png"],
      "reviewerName": "Shorupan Pirakaspathy",
      "reviewerRole": "Founder",
      "reviewerAvatar": "https://…",
      "isVerifiedPurchase": true,
      "isOwnerReview": false,
      "helpfulCount": 12,
      "notHelpfulCount": 1,
      "status": "published",
      "createdAt": "2026-08-07T09:00:00.000Z",
      "editedAt": null,
      "isMine": false,
      "viewerVote": null          // "helpful" | "unhelpful" | null
    }
  ],
  "total": 142,
  "page": 1,
  "totalPages": 8,
  "summary": { /* see below */ }
}
```

### `GET /reviews/targets/:targetType/:targetId/summary`

Just the numbers — for a card or a header that doesn't list reviews.

```jsonc
{
  "success": true,
  "summary": {
    "targetType": "channel",
    "targetId": "652f…01",
    "average": 4.8,                                    // big number
    "count": 142,                                      // "142 total reviews"
    "distribution":        { "1": 2, "2": 1, "3": 6, "4": 17, "5": 116 },
    "distributionPercent": { "1": 1.4, "2": 0.7, "3": 4.2, "4": 12, "5": 81.7 },
    "verifiedCount": 130,
    "ownerReviewCount": 0,
    "lastReviewAt": "2026-08-07T09:00:00.000Z"
  }
}
```

`distributionPercent` is derived on read from the counts, so the bars can never
disagree with the numbers beside them. Values are 0-100 to 1dp and sum to ~100
(±0.5 from rounding).

### `GET /reviews/targets/:targetType/:targetId/mine`

The caller's own review, or `null`. Drives "Write a review" vs "Edit yours".

### `POST /reviews/targets/:targetType/:targetId`

```jsonc
{
  "rating": 5,                    // required, whole number 1-5
  "body": "…",                    // required, ≤500 chars — whitespace not counted
  "title": "…",                   // optional, ≤140 chars (review headline)
  "images": ["https://…"]         // optional, ≤6 already-uploaded URLs
}
```

`201` with the created review. `409` if the user already reviewed this target
(one review per user per target, enforced by a unique index). `403` if they
lack access.

Images are URLs already uploaded through the existing upload route — this
endpoint never receives binary data and rejects non-http(s) URLs.

### `PATCH /reviews/:reviewId`

Edit your own review. Any subset of `{ rating, body, title, images }`. Stamps
`editedAt` and refreshes the reviewer's denormalized name/avatar snapshot.

### `DELETE /reviews/:reviewId`

Removes the review outright, rating included. Author deletes their own; a
founder can remove any review on their own content. Cascades the review's votes
and recomputes the summary.

The app only offers this to the author — a founder moderating content uses the
narrower take-down below, so that removing what someone wrote can't quietly
raise the average.

### `DELETE /reviews/:reviewId/comment`

Take down the **comment text and every attached screenshot**, keeping the star
rating. Author or founder of the owning org.

```jsonc
{ "success": true, "review": { "body": "", "images": [], "rating": 2,
                               "commentRemovedAt": "2026-08-10T…" } }
```

This is the founder's moderation tool. The rating, the reviewer and the
review's contribution to the summary are all untouched — a 2-star review whose
comment is removed is still a 2-star review — so no recompute is needed and
none happens. `commentRemovedAt` lets a client render "comment removed" rather
than an unexplained blank.

`status` is deliberately **not** touched: a take-down is not a visibility
decision. Founder take-downs additionally stamp `moderatedBy` / `moderatedAt`.

A founder can remove words; they can never change them. `PATCH /reviews/:id`
remains author-only.

### `PUT /reviews/:reviewId/vote`

Drives `Was this helpful? [Helpful (12)] [Unhelpful]`.

```jsonc
{ "vote": "helpful" }    // or "unhelpful", or null to clear
```

```jsonc
{ "success": true, "helpfulCount": 13, "notHelpfulCount": 1, "viewerVote": "helpful" }
```

Idempotent in every direction — voting the same way twice leaves the counter
alone, switching helpful→unhelpful moves both counters in one round trip, and
`null` clears (what tapping the already-active button does).

### `GET /reviews/moderation?orgId=…`

Founder-only queue across the whole org. Optional `status`, `targetType`,
`page`, `limit`.

Each row is a review plus what it hangs off, so the founder can tell one from
another without a lookup per row:

```jsonc
{
  "_id": "…",
  "targetType": "product",
  "targetId": "652f…07",
  "targetName": "Notion Templates Pack",   // null if the target was deleted
  "targetLabel": "product",                // the type's human label
  "rating": 2,
  "body": "…",
  "reviewerName": "…",
  "status": "published"
}
```

Names are resolved with one query per target type present on the page, not one
per review.

### `PATCH /reviews/:reviewId/moderate`

```jsonc
{ "status": "hidden", "note": "off-topic" }
```

Founders control a review's **visibility, never its wording**. Hiding removes
it from public lists and from the average (the summary is recomputed).

Note the difference from `DELETE /reviews/:reviewId/comment`: hiding pulls the
whole review — rating included — out of the average, whereas a comment take-down
keeps the rating counting and only removes what was written.

---

## Content safety

Review bodies and titles are stored as plain text. `utils/plainText.ts` strips
markup, control characters, zero-width characters and bidi overrides at the
write boundary, collapses whitespace, and caps consecutive newlines. This is
defence in depth — output escaping is still the renderer's job.

---

## Operations

```bash
# Report current summaries without writing
npx ts-node src/scripts/rebuild-rating-summaries.ts

# Rebuild every RatingSummary from the Review collection
npx ts-node src/scripts/rebuild-rating-summaries.ts --apply

# …and recount every review's Helpful/Unhelpful tallies from ReviewVote
npx ts-node src/scripts/rebuild-rating-summaries.ts --apply --votes
```

Run it after importing reviews out of band, and **after changing
`REVIEW_AVERAGE_EXCLUDES_OWNER`** — that flag changes what counts toward every
average, so every summary needs recomputing.

Indexes are created by Mongoose on boot; no manual migration is required to
start using the system.

---

## Relationship to the existing rating fields

`Channel.rating` / `ratingCount` / `reviews[]` (and the same fields on Course,
Product, Workshop) are **founder-authored marketing content**, typed into the
create/edit form. This system does not read or write them.

`RatingSummary` is the source of truth for real user-submitted ratings. The old
fields remain usable as a manual override — e.g. show the founder-set number
until `RatingSummary.count > 0`. Decide per surface; nothing is migrated
automatically.

`ServiceReview` (the older Services-only collection) is untouched and still
serves `/services/:serviceId/reviews`. The `service` target type here is the
forward path; migrating those rows is a separate decision.
