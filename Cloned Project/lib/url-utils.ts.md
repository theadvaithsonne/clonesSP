# `lib/url-utils.ts`

> Pure helpers that find, normalise and validate URLs in free text, used to drive link previews in chat and feed messages.

**Kind:** frontend library · **Lines:** 100

## Purpose
Chat and feed composers show a link-preview card when a message contains a URL. This module decides what counts as a URL. It handles bare domains and `www.` links as well as full `http(s)://` URLs, and it deliberately ignores email addresses so that `alice@example.com` does not produce a preview of `example.com`.

## How it works
`extractUrls(text)`:
1. Runs one global, case-insensitive regex that matches `http(s)://...`, `www....`, or a bare `domain.tld[:port][/path]`.
2. For each match: trims it and strips trailing punctuation (`.,;:!?)]}`).
3. Drops the match if it is itself an email, if the character just before it in the text is `@`, or if the 50 characters before it end in `@...` with no whitespace (meaning it is the domain part of an email). It uses `text.indexOf(url)`, so only the first occurrence of a repeated string is checked.
4. Adds `https://` when there is no scheme: bare domains with a TLD of two or more letters, and `www.` links.
5. Keeps only strings that `new URL()` accepts.

The other helpers are built on it: `hasUrl` and `getFirstUrl`. `isValidUrl` is a plain `new URL()` try/catch.

## Exports
- `extractUrls(text: string): string[]` - all normalised URLs found, in order.
- `hasUrl(text: string): boolean` - true when at least one URL is found.
- `getFirstUrl(text: string): string | null` - the first normalised URL, or `null`.
- `isValidUrl(url: string): boolean` - true when `new URL(url)` succeeds. Strings without a scheme fail.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`

## Notes
- The bare-domain branch is permissive. Text such as `file.js` or `v1.2.ab` will be treated as a URL (`https://file.js`).
- No deduplication: the same link appearing twice is returned twice.
