# `lib/money/types.ts`

> Type-only frontend mirror of the canonical `Money` shape that the NetworkChains contacts-backend sends in API payloads.

**Kind:** frontend library · **Lines:** 27

## Purpose
The contacts-backend (NetworkChains, an external service not part of this repo; its source comment points to `contacts-backend/src/money/money.types.ts`) normalises every amount into a `Money` object that already carries the original amount and a USD conversion. This file declares that shape so the frontend can format it without doing any currency conversion itself.

## How it works
No runtime code, only types:
- `CurrencyCode` is a plain `string` alias (ISO 4217 code such as `"INR"`).
- `FxSource` says where the USD figure came from: `"same"` (already USD), `"live"`, `"cached"`, `"stale"`, `"fallback"`, `"backfilled"` or `"unconverted"` (no USD figure available).
- `Money` holds the original amount in minor units (`originalAmountMinor`) with its `originalCurrency` (nullable when unknown), the converted `usdCents` and higher-precision `usdMicros` (both nullable), the `fxRate` used, the rate timestamp `fxAsOf` (ISO string), and `fxSource`.

## Exports
- `type CurrencyCode = string` - ISO currency code.
- `type FxSource` - union of the seven conversion-source strings above.
- `interface Money` - normalised money value as described above.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `lib/money/format-money.ts` - the only importer; it formats `Money` values for display.

## Notes
- Keep this in sync with the backend definition by hand; nothing enforces it. `format-money.ts` treats `"stale" | "fallback" | "backfilled"` as approximate, so adding a new `FxSource` value means revisiting that set.
