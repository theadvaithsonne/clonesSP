# Auction Features  

##  Overview 

Auction is a **global**  networking feature in Garage 2.0  — visible to all users across all organisations .
It appears in the sidebar under the **Networking** section, between Bat246 (when visible) and OfficeStream.


---

## Rules

1. Auctions are **global** — `GET /auctions` returns all auctions from all organisations. No orgId filter on fetch.
2. `organizationId` and `creatorOrgName` are stored on the document for display only — never used as filter.
3. Only the **creator** sees Edit/Cancel — frontend checks `auction.createdBy === userData.userId`.
4. Creator can **edit everything** — product, images, title, description, duration, minimum price.
5. `creatorOrgName` is resolved server-side via `Organization.findById(orgId).select('name')` in POST handler. `creatorName` and `creatorAvatar` come from client body (already in `userData` — no extra DB lookup).
6. **Garage product** → stores `productId` + denormalizes `productName` and full `images` array at creation.
7. **Outside product** → stores uploaded image URLs, title, description, optional video URL via `POST /upload`.
8. All mutations (create, edit, cancel) emit a socket event — no polling.
9. Socket room: `"auction:global"` — all clients join on page mount, leave on unmount.
10. Socket events: `auction:new`, `auction:update`, `auction:end`. Payload is always the **full auction document**. `auction:end` fires for both cancel and Phase 3 cron expiry.
11. Routes use `requireAuth` middleware.
12. `userId` and `orgId` from JWT via `req.user`.
13. Mongoose model: TypeScript interface + Schema + named export + `timestamps: true`.
14. `startTime` always set server-side to `new Date()`. `endTime = startTime + durationHours * 3600 * 1000`.
15. Cancel: `PATCH /auctions/:id/cancel` sets `status: "cancelled"` — never hard-deleted.
16. No auto-expiry in Phase 2. Frontend shows "Ended" label when `endTime < Date.now()`. Phase 3 adds cron.
17. Socket subscribed **before** initial fetch to prevent race condition.
18. `durationHours` allowed values: 1, 6, 24, 48 — enforced in Mongoose schema enum + backend validation.
19. `minPrice` min: 0 — enforced in schema + backend validation.
20. User data from `useAmIFounder()` — provides `userId`, `name`, `profilePicture`, `orgName`.
21. **"From Garage" product dropdown is cross-org** — uses `GET /auctions/my-products` which returns active products from *all* orgs the user belongs to (any role), not just the currently active office. `getProducts()` (which reads `localStorage garage_org_id`) is NOT used here.
23. **Ongoing Auctions renders as a responsive grid** — 1 col on mobile → 2 (sm) → 3 (lg) → 4 (xl). 8 cards per page (PAGE_SIZE = 8).
24. **Pagination** is client-side inside `OngoingAuctions.tsx` — numbered page buttons + Prev/Next arrows. Active page = yellow `#FBD10D` pill. Auto-adjusts when an auction is cancelled on the last page.
25. **Timer badge overlaid on image** — amber pill (`bg-amber-500/10 text-amber-400`) for active, muted gray for ended. Uses `backdrop-blur-sm` for legibility over any image.
26. **Start Auction tab button** uses native `<button>` with `bg-[#FBD10D] text-black` (project primary style) instead of the Radix `<Button>` component.
22. `AuctionProduct` type (`{ _id, name, images[], organizationId }`) is the lightweight shape returned by `/auctions/my-products` — separate from the full `Product` model.

---

## Collection: `auctions`

### Schema

```typescript
interface IAuction extends Document {
  createdBy: Types.ObjectId          // ref: "User"
  creatorName: string
  creatorAvatar?: string             // optional — user may have no profile picture
  creatorOrgName: string             // resolved server-side via org lookup
  organizationId: Types.ObjectId     // stored for reference only, NOT a filter
  productSource: "garage" | "outside"
  productId?: Types.ObjectId         // ref: "Product" — garage only
  productName: string
  productImages: string[]            // full Product.images (garage) or uploaded URLs
  productDescription?: string
  productVideoUrl?: string
  minPrice: number                   // min: 0
  currency: "INR" | "USD"
  durationHours: number              // enum: [1, 6, 24, 48]
  startTime: Date                    // server-side only
  endTime: Date                      // startTime + durationHours * 3600000
  status: "ongoing" | "ended" | "cancelled"
}
```

### Indexes

```typescript
AuctionSchema.index({ status: 1, createdAt: -1 });  // primary query
AuctionSchema.index({ createdBy: 1, status: 1 });   // creator's auctions
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auctions` | required | All `status:"ongoing"` auctions, newest first (global) |
| GET | `/auctions/my-products` | required | Active products from all orgs user has founder access to |
| POST | `/auctions` | required | Create auction |
| PUT | `/auctions/:id` | required | Edit auction (creator only) |
| PATCH | `/auctions/:id/cancel` | required | Soft cancel (creator only) |

### GET /auctions/my-products

Fetches active products across **all orgs** the authenticated user belongs to (any role).
Used in the StartAuctionDialog "From Garage" dropdown — not filtered by current office.

**Logic:**
1. `User.findById(userId).select("organizations organization role")`
2. Collect all orgIds from `user.organizations[]` (every membership, regardless of role)
3. Fallback: add legacy `user.organization` if not already in list
4. `Product.find({ organizationId: { $in: orgIds }, status: "active" }).select("_id name images organizationId").limit(200)`

**Response:** `{ products: AuctionProduct[] }` — `_id`, `name`, `images[]`, `organizationId`

### POST /auctions — Request body

```
productSource, productId?, productName, productImages[],
productDescription?, productVideoUrl?,
minPrice, currency, durationHours,
creatorName, creatorAvatar?
```

### POST /auctions — Server adds

```
createdBy      ← req.user.userId
organizationId ← req.user.orgId
creatorOrgName ← Organization.findById(orgId).select('name')
startTime      ← new Date()
endTime        ← startTime + durationHours * 3600000
status         ← "ongoing"
```

---

## Socket

### Room

All clients join `"auction:global"` on page mount via `socket.emit("auction:subscribe")`.

### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `auction:subscribe` | client → server | — |
| `auction:unsubscribe` | client → server | — |
| `auction:new` | server → clients | full IAuction |
| `auction:update` | server → clients | full IAuction |
| `auction:end` | server → clients | full IAuction |

### Page load order

1. Mount page
2. `socket.emit("auction:subscribe")` ← first
3. `GET /auctions` ← then fetch
4. Real-time events from here on

### Client state updates

```typescript
socket.on("auction:new",    (a: IAuction) => setAuctions(p => [a, ...p]))
socket.on("auction:update", (a: IAuction) => setAuctions(p => p.map(x => x._id === a._id ? a : x)))
socket.on("auction:end",    (a: IAuction) => setAuctions(p => p.filter(x => x._id !== a._id)))
```

---

## Files

### Phase 1 (✅ implemented)

| File | Change |
|------|--------|
| `components/dashboard/MainSidebar.tsx` | Added `Gavel` icon + Auction `SidebarItem` |
| `app/(dashboard)/auction/page.tsx` | "Coming Soon" placeholder (reworked in Phase 2) |

### Phase 2 (✅ implemented)

| File | Action |
|------|--------|
| `src/models/auction.model.ts` | New Mongoose model |
| `src/routes/auction.ts` | 5 endpoints (GET all, GET my-products, POST, PUT, PATCH cancel) |
| `src/services/socket.ts` | Added `emitAuctionNew`, `emitAuctionUpdate`, `emitAuctionEnd` |
| `src/realtime/socket.ts` | Added `auction:subscribe` / `auction:unsubscribe` handlers |
| `src/app.ts` | Import + `app.use("/auctions", auctionRoutes)` |
| `lib/auction-api.ts` | Types + API functions: `getAuctions`, `getAuctionMyProducts`, `createAuction`, `updateAuction`, `cancelAuction` |
| `app/(dashboard)/auction/components/StartAuctionDialog.tsx` | 3-step create/edit dialog — uses `getAuctionMyProducts` for cross-org product list |
| `app/(dashboard)/auction/components/OngoingAuctions.tsx` | Responsive 4-col grid, 8-per-page client pagination, card with image + timer badge overlay |
| `app/(dashboard)/auction/page.tsx` | Client component — header + dark-pill tabs + socket + state; Start Auction tab uses `#FBD10D` native button |

### Sidebar order (Networking section)

1. Bat246 *(conditional)*
2. **Auction** *(always)*
3. OfficeStream
4. Communities
5. Feeds
6. Notification

---

## UI Flow

```
Header: [Avatar] [Name] · [OrgName]

[ Auction ]  [ Ongoing Auction (N) ]
─────────────────────────────────────
Tab 1 — Auction:
  [+ Start Auction] button

Tab 2 — Ongoing Auction:
  N auctions                          Page X of Y
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ [image ] │ │ [image ] │ │ [image ] │ │ [image ] │  ← 4/3 aspect, zoom on hover
  │ [5h left]│ │ [5h left]│ │ [5h left]│ │ [Ended]  │  ← badge overlaid on image
  │ Name     │ │ Name     │ │ Name     │ │ Name     │
  │ Org·User │ │ Org·User │ │ Org·User │ │ Org·User │
  │ Min $50  │ │ Min $50  │ │ Min $50  │ │ Min $50  │  ← golden #FBD10D
  │[Edit][X] │ │          │ │[Edit][X] │ │          │  ← owner only
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  [ ← Prev ]  [ 1 ] [ 2 ] [ 3 ]  [ Next → ]
```

### StartAuctionDialog — 3 steps

```
Step 1: Product source + details
  ( ) From Garage  → Select from getProducts()
  ( ) From Outside → Upload image(s) + title + description

Step 2: Settings
  Duration: [1h] [6h] [24h] [48h]
  Min Price: [____] [USD ▾]

Step 3: Confirm
  [product image]  Product Name
  Duration: 6 hours · Min Bid: USD 50
  [Back]  [Start Auction / Save Changes]
```

---

## Phase 3 (future)

- Bidding flow + outbid notifications
- Cron job: auto-set `status: "ended"` when `endTime` passes
- Payment via Razorpay
- Winner notification + auction history tab
