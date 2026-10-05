# `lib/bat246MembersCache.ts`

> A 60-second in-memory cache for the BAT 246 office members list, shared across the BAT 246 back-office pages, plus the response types.

**Kind:** frontend library · **Lines:** 42

## Purpose
Several BAT 246 admin pages (dashboard, members, distributors, distributor detail, hub) show the same office member roster. Navigating between them would otherwise refetch the full list each time. This module keeps the last response in a module-level variable so a page opened within a minute of another can render instantly.

## How it works
- `_cache` holds the last `MembersApiResponse`; `_at` holds when it was stored.
- `getMembersCache()` returns the cached response only if it is younger than `TTL` (60,000 ms); otherwise `null`, telling the caller to fetch.
- `setMembersCache(data)` stores a fresh response and timestamp.
- The cache lives only for the current JS module instance: it survives client-side navigation but is lost on a full reload, and is not shared between tabs. There is no explicit invalidation; stale data expires by time only.

Types describe the members endpoint response: `MembersApiResponse` = `{ success, office: { _id, name }, totalMembers, members: CachedMember[] }`. A `CachedMember` is a `PersonBlock` (`userId`, `name`, `email`, `phone`, `profilePicture`, `address`) plus `role`, `guest`, `joinedAt` and an `upline` person (or `null`). The address block (`city`, `state`, `country`, `postalCode`, `formatted`) is a private interface.

## Exports
- `getMembersCache(): MembersApiResponse | null` - cached roster if fresh.
- `setMembersCache(data: MembersApiResponse): void` - store a roster.
- Types: `PersonBlock`, `CachedMember`, `MembersApiResponse`.

## Dependencies
None.

## Used by
- `app/(dashboard)/games/bat246/page.tsx`
- `app/(dashboard)/games/bat246/dashboard/page.tsx`
- `app/(dashboard)/games/bat246/members/page.tsx`
- `app/(dashboard)/games/bat246/distributors/page.tsx`
- `app/(dashboard)/games/bat246/distributors/[userId]/page.tsx`

## Notes
- The cache is not keyed by office or user. If the signed-in user switches account or office without a reload, a page could show the previous roster for up to 60 seconds.
