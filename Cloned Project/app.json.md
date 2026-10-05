# `app.json`

> A small Expo config stub that holds only an EAS (Expo Application Services) project ID; nothing in this repo reads it.

**Kind:** project config / root file · **Lines:** 10

## Purpose
`app.json` is the file Expo / EAS tooling looks for to identify a project. This one came over from the old backend repository (`garagenew-backend/app.json`); the frontend repo never had one. It contains no app settings, only `expo.extra.eas.projectId`, which links the folder to a project on Expo's EAS service. It most likely exists because the backend sends mobile push notifications through Expo, and the mobile apps (garage-chat, NetworkChains) are Expo/EAS projects.

## How it works
The whole file is one nested object:

```json
{ "expo": { "extra": { "eas": { "projectId": "<UUID>" } } } }
```

- `expo.extra.eas.projectId` (line 5): the UUID of an EAS project. It is an identifier, not a secret or access token.
- There are no other Expo fields (`name`, `slug`, `ios`, `android`, plugins and so on), so this file cannot build or run a mobile app on its own.

Next.js and the Express server do not load it. A search of the project finds no code that reads `app.json` or `projectId`. The backend's Expo integration, `server/services/pushNotification.ts`, builds its client with `new Expo()` from `expo-server-sdk` and passes no options, so it does not depend on this file either.

## Interfaces
- **External services:** Expo Application Services (EAS). The ID only matters to Expo CLI / EAS CLI if someone runs them in this folder.

## Dependencies
- **Internal:** none
- **Packages:** none directly. The related runtime package is `expo-server-sdk` (declared in `package.json`), which `server/services/pushNotification.ts` uses to send pushes to Expo device tokens.

## Used by
No file in the dependency analysis imports it, and no npm script reads it. Only Expo/EAS command-line tools would pick it up.

## Notes
- The file is very likely leftover tooling metadata. Deleting it would not affect the web app or the server, but it would remove the EAS project link for anyone who runs `eas` commands from the repo root.
- Do not confuse it with Next.js configuration (`next.config.ts`) or `package.json`. Despite the name, it plays no part in the Next.js `app/` router.
