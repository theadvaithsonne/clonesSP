# `components/bat246/MiniCard.tsx`

> Client-side card toolkit for the BAT246 board: miniature trading-card faces, the "display case" that groups them, country flags, slot-to-card helpers, and the click-to-reveal card-back modals filled from the player's card-earning history.

**Kind:** React component · **Lines:** 1359

## Purpose
Every BAT246 board slot shows the cards its player holds: up to two green PPB ("Green Card") spaces plus earned gold, black, brown and gray cards (and a "No Card" marker). This file holds everything needed to draw those cards at a few pixels' size, group them into framed cases, and open a full-size front + back view of a card. The back is filled with live data from the backend (who the card was assigned to, the free position it produced, who it was stolen from, date/time, board number). The board page, `BoardLayout`, `BaseCard`, `HomePlateCard` and the mobile board sections all import from here, so it is the single source of card visuals for the game UI.

## How it works

### Flags (L11-L56)
`ALL_COUNTRIES` is loaded once from `country-state-city`. BAT246 stores `countryResidence` / `countryOrigin` as the full country **name**, so `flagIsoCode()` resolves a name to its ISO code (case-insensitive). A two-character value is treated as an ISO code directly. `FlagIcon` renders `https://flagcdn.com/<iso>.svg` as an `<img>`. `flagEmoji` is kept but marked `@deprecated`: Windows has no glyphs for regional-indicator emoji, so Chrome and Edge there show the bare letters ("IN").

### Card faces (L58-L151)
- `SCHEME` holds a gradient and colour recipe per `MiniCardType` (`gold`, `green`, `black`, `brown`, `gray`, `noCard`). `SIZE` holds Tailwind size classes for `xs` / `sm` / `md`. `GREEN_SIZE_PX` holds the real pixel footprint: 1.18x the class size, so every card renders the same size as the green art.
- `TYPE_IMAGE` maps types to printed face art under `/images/bat246-*-card.svg` (noCard uses a `.jpg`). Gray has no default art; its Free and 160 sub-types pass `imageSrc` (`GRAY_FREE_IMAGE` / `GRAY_160_IMAGE`).
- `MiniCard` draws the art image when one is available. Otherwise it draws a CSS-only card: a gradient body, a title bar, a globe emblem, a bottom banner and a gloss layer.
- `TYPE_BACK_IMAGE` and `GRAY_160_BACK_IMAGE` are the back artwork used by the static back modal.

### Slot helpers (L153-L203)
These read `SlotData` fields from `./types`:
- `ppbGreens(slot)`: `salesCredits` clamped to 0-2.
- `earnedCards(slot)`: an ordered list of gold cards (`goldCards`, or 1 if `cardType === "Gold"`), one green if `cardType === "Green"`, then gray (`freeGrayCards + grayCard160`, falling back to legacy `grayCards`), black and brown.
- `grayCardItems(slot)`: one label and art entry per gray card ("Free Grey Card" / "160 Grey Card", or legacy "Grey Card").
- `allSlotCards(slot)`: green PPB cards followed by the earned cards.
- `ppbGreenCards(slot)`: the green PPB cards only.

### Card-history data and the hover tooltip (L205-L369)
- `CardEarningEvent` and `CardBack` mirror the records returned by the backend card-history endpoint.
- `POSITION_LABELS` / `formatPosition` turn raw position keys (`thirdBase`, `secondBaseA`, `1stA`-`1stD`, `atBat-0`-`atBat-7`) into readable labels such as "1st Base A" or "AT BAT 1". The comment says the mapping mirrors `Bat246NotificationBell.tsx`.
- `historyCache` is a module-level `Map` keyed `"<playerId>:<type>"`. Once a player and card type have been fetched successfully, they are never fetched again for the life of the page.
- `closeRegistry` is a module-level `Set` of close callbacks, so opening one card closes every other open card.
- Dates are formatted in `en-US`. Times are formatted in the `America/New_York` time zone.
- `HistoryTooltip` shows a coloured header, then a loading, error or empty state ("Earned before tracking was added"), or one block per event. A block has a "Baseball Card" section and a "Free Position" section. Gold cards also get a "Stolen From" section. An event without `cardBack` falls back to "Referred <name>".

### Card-back text layout engine (L371-L493)
Each card back is fixed artwork with the red labels already printed on it. Values are positioned against label geometry measured from that artwork, in the art's own viewBox units:
- `measureBold` measures bold Arial text with a cached canvas 2D context. During SSR, or when no context is available, it estimates `length * size * 0.58`. `fitFontSize` shrinks text so it fits the column, down to `CARD_TEXT.minScale` (0.62).
- `CARD_TEXT` holds font size, gap, gutter and stroke in **display** pixels, against a 720 px card width (`CARD_DISPLAY_W`). `cardBack(layout)` converts those values into each art's own units. That conversion is why text looks identical on the green art (1684 wide) and the 2245-wide art. The returned `left(key)` / `right(key)` functions give the slot for the value after a row's left or right label, or `null` when the art has no label there.
- `CardValue` renders one SVG `<text>` with a white halo. If the text is still too wide at minimum scale, it is condensed with `textLength` + `lengthAdjust="spacingAndGlyphs"`. A missing value renders as "—".
- `CardLoading` is the spinner overlay shown while `cardBack` is missing.

### `CardStage` (L495-L549)
`CardStage` portals a backdrop to `document.body` at z-index 10000. Escape closes it, and so does a click on the backdrop. A `ResizeObserver` plus a window `resize` listener scale the front + back pair down to fit the viewport. They also lift the pair by up to `CARD_STAGE_LIFT` (150 px) so it overlaps the action buttons above. Pass `centered` to disable the lift. The pair stacks vertically below `md` unless the device is in landscape.

### Data-filled back modals (L551-L942)
- `GreenCardBackModal` renders `GreenCardBackSvg` (a portrait 1190x1684 SVG component) inside a landscape SVG, rotated with `translate(0,1190) rotate(-90)`. Values are placed in that same coordinate space using the `GREEN_BACK` layout. The rows are Baseball Card (assigned to / ID / 1st-base position / entry), Free Position (assigned to / ID / at-bat position / entry) and Date-time / Board #.
- `StandardCardBackModal` is used for gold, black and brown cards. It lays an SVG over the back `<img>` and adds a "Stolen From" section. Each card has its own measured layout (`GOLD_BACK`, `BLACK_BACK`, `BROWN_BACK`). Brown's `bcPosition` has no `left` value because the Home Plate card prints that position itself. `GoldCardBackModal`, `BlackCardBackModal` and `BrownCardBackModal` are thin wrappers that pass in the art and the layout.
- `NoCardBackModal` uses `NOCARD_BACK`. Its Baseball Card section shows **Stolen By** (the gold-card earner) and **Card Earned**. Its Stolen From section shows the No Card holder.
- Every data modal pages through multiple events with Prev / Next. Each picks values with fallbacks: `distributorId ?? playerIdNo`, `cardBack.issuedAt ?? earnedAt`, `cardBack.boardTrackingNo ?? boardTrackingNumber`.
- `CardBackModal` is a static front + back image viewer for cards that have back art but no data modal (e.g. gray, or any type opened without a `playerId`). Gray 160 cards get `GRAY_160_BACK_IMAGE`.

### `StackedCard` (L987-L1239)
`StackedCard` is one position in a case. It shows a single card with an "xN" badge, or with `overlayCount` it draws a large number over the art (leaderboard style).
- **Triggers:** `trigger="hover"` opens on mouse enter, except for `noCard`. `trigger="click"` toggles.
- **What opens:** a click on green, gold, black, brown or noCard **with a `playerId`** opens the matching data modal. A click on another type that has back art opens `CardBackModal`. Everything else gets a small fixed-position tooltip, portaled. It shows `HistoryTooltip` when a `playerId` is set; otherwise it shows `count` copies of the card.
- **Fetching:** when open with a `playerId`, the cache is checked first. On a miss, after a 150 ms debounce it calls `GET /backend/bat246/players/:playerId/card-history?cardType=<Type>`. The type is capitalised: `Gold`, `Green`, `NoCard`, `Gray`, and so on. The request sends `Authorization: Bearer <getToken()>`. It is aborted on close or unmount. A failure sets `"error"`. Failures are not cached, so the next open retries.
- **`eventIndex`:** this slices the history to the events for one card instance (`history.slice(eventIndex, eventIndex + count)`). `CardCase` uses it so the Nth green card shows the Nth green event.
- While a tooltip is open, a click outside closes it (`mousedown` listener). This does not apply to the full modals.

### `CardCase` (L1241-L1358)
`CardCase` is a framed row of cards.
- `frame="ppb"` gives a white box with a 2px blue border (`#3b82f6`). Despite the doc comment, it is not gold.
- `frame="earned"` gives a borderless box: black when it holds cards, white when empty.
- `minSlots` pads the row with empty placeholders. The placeholders are dashed only when the case also holds real cards; a fully empty case shows blank space of the same size, so the box does not collapse.
- With `stack`, same-colour cards collapse into one `StackedCard` with a count. Green and noCard are never stacked; each gets a running `eventIndex`. PPB groups are scaled slightly larger (`scaleX(1.03) scaleY(1.065)`).
- Without `stack`, it renders plain `MiniCard`s, with a text caption for every card except green.

## Exports
- `flagEmoji(value?)` - **deprecated**. Returns a regional-indicator flag emoji for a country name or ISO code.
- `FlagIcon({ value, className?, title? })` - flagcdn.com SVG flag `<img>`, or `null` when the country can't be resolved.
- `type MiniCardType` - `"gold" | "green" | "black" | "brown" | "gray" | "noCard"`.
- `MiniCard({ type, size?, title?, className?, imageSrc? })` - a single miniature card face.
- `ppbGreens(slot)` - number of green PPB spaces paid (0-2).
- `earnedCards(slot)` - ordered list of the earned card types.
- `GRAY_FREE_IMAGE`, `GRAY_160_IMAGE` - face-art paths for the two gray sub-types.
- `grayCardItems(slot)` - per-gray-card `{ label, imageSrc? }`.
- `allSlotCards(slot)` - green PPB cards followed by the earned cards.
- `ppbGreenCards(slot)` - green PPB cards as a `MiniCardType[]`.
- `StackedCard({ type, count, size, trigger?, playerId?, eventIndex?, label?, tooltipLabel?, imageSrc?, overlayCount?, cardClassName? })` - an interactive card with a count badge, history tooltip and back modals.
- `CardCase({ cards, size?, frame?, minSlots?, stack?, playerId?, trigger?, className?, style?, overlayCount?, cardClassName? })` - a framed case of cards.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/players/:playerId/card-history?cardType=<Type>` - served by `server/bat246/routes/bat246.routes.ts` behind `requireAuth`. It returns `Bat246SalesCredit` records sorted by `earnedAt`, with `cardBack.*.distributorId` filled in live from `Bat246Distributor`.
- **External services:** flagcdn.com, for flag SVG images.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL; falls back to `http://localhost:4000`.
- **Browser storage / cookies:** reads the auth token from localStorage through `getToken()`.

## Dependencies
- **Internal:** `components/bat246/GreenCardBackSvg.tsx` - green card back artwork as an SVG component; `components/bat246/types.ts` - `SlotData`; `lib/auth.ts` - `getToken`; `lib/utils.ts` - `cn`.
- **Packages:** `react` - state, effects, refs; `react-dom` - `createPortal` for modals and tooltips; `country-state-city` - mapping country names to ISO codes.

## Used by
- `app/(dashboard)/games/bat246/[boardId]/page.tsx` - imports only `ppbGreens`. The board page lives at `/games/bat246/:boardId`.
- `components/bat246/BoardLayout.tsx`, `components/bat246/BaseCard.tsx`, `components/bat246/HomePlateCard.tsx`, `components/bat246/BoardMobileSections.tsx` - use `CardCase`, `StackedCard`, `FlagIcon`, the slot helpers and the gray image constants.

## Notes
- `NoCardBackModal` reads `cb.stolenBy` and `cb.cardEarned`, but neither field is declared on the local `CardBack` interface. The backend does return `stolenBy`. This is a TypeScript error, which the build ignores. Add both fields to `CardBack` if you touch this.
- The outside-click effect in `StackedCard` depends on `[pop, isDataModal]` but also reads `isCardBackModal`. This is harmless, because that flag only changes when props change.
- `historyCache` is never invalidated. A card earned while the page is open will not appear in the history until the page reloads.
- Tooltip and modal times are always shown in US Eastern time, whatever the viewer's local time zone.
- Card-back label coordinates are hand-measured from each SVG. If the artwork under `public/images/bat246-*-card-back.svg` is replaced, the matching `*_BACK` layout must be measured again.
- Terminology: the green card is the "Green Card" (the green PPB circle). Older code calls the stored count `salesCredits` and the model `Bat246SalesCredit`.
