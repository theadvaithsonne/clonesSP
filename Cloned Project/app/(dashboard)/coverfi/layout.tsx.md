# `app/(dashboard)/coverfi/layout.tsx`

> Root layout of the Coverfi section: it allows founders only, applies the `coverfi-skin` dark theme and wraps every Coverfi page in the client-side password gate.

**Kind:** Next.js layout · **Lines:** 49 · **Route:** `/coverfi` (wraps every `/coverfi/**` page)

## Purpose
Coverfi (the insurance-brokerage back office) is meant for organisation founders. This layout enforces that in the UI and gives the whole section its own visual theme. Every page under `app/(dashboard)/coverfi/`, including the nested `brokerage`, `communication` and `products` layouts, renders inside it.

## How it works
- **Client component** that uses `useAmIFounder()`. That hook decodes the JWT, calls `/auth/me` on the backend and reports whether the user is a founder of the current org, re-checking on the `garage:token-change` event.
- **Theme effect:** on mount it adds the class `coverfi-skin` to `<body>` and removes it on unmount. The scoped CSS in `app/globals.css` (`.coverfi-skin { ... }`) then also reaches Radix dialogs and popovers that render into portals outside this subtree. The wrapping `<div>` carries `coverfi-skin` as well.
- **Founder guard:** once loading finishes, a user who is not a founder is sent away with `router.replace("/")`, and the layout renders `null` meanwhile.
- **Loading:** a spinner with the text "Loading Coverfi…".
- **Authorised:** renders the children inside `CoverfiPasswordGate` within a full-height dark container (`bg-[#0a0a0d]`) with a fade-in.

## Exports
- `default CoverfiLayout({ children })` - the layout component.

## Interfaces
- **Backend endpoints called:** indirectly, through `useAmIFounder`: `GET /backend/auth/me`.
- **Browser storage / cookies:** `CoverfiPasswordGate` stores its unlock flag in `sessionStorage["coverfi_authed"]`.

## Dependencies
- **Internal:**
  - `lib/hooks/useAmIFounder.ts` - the founder check.
  - `components/coverfi/CoverfiPasswordGate.tsx` - the password prompt.
- **Packages:** `react`, `next` (`useRouter`), `lucide-react` (`Loader2`).

## Used by
No file imports it. Next.js applies it automatically to every route under `/coverfi`. `app/(dashboard)/layout.tsx` also treats `/coverfi` paths as full-bleed.

## Notes
- **Both checks are client-side only.** The redirect and the password gate are UX barriers. The gate's own comment says real protection must come from the Coverfi backend's middleware. The password is hardcoded in plain text in `components/coverfi/CoverfiPasswordGate.tsx` (around line 8), so anyone who reads the JS bundle can see it.
