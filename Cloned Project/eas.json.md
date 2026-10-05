# `eas.json`

> Expo Application Services (EAS) configuration file that defines build profiles and a submit profile for the EAS CLI.

**Kind:** project config / root file · **Lines:** 22

## Purpose
`eas.json` is the config file read by the EAS CLI (`eas build`, `eas submit`) when building and submitting a React Native / Expo mobile app. In this repository there is no Expo or React Native app source: the project is a Next.js frontend plus an Express backend. The file sits at the repo root next to `app.json`, which holds only `expo.extra.eas.projectId` (an EAS project ID). Together they link this folder to an EAS project, but nothing in the Next.js or Express build reads either file.

## How it works
- **`cli`**
  - `version: ">= 18.8.0"`: the minimum EAS CLI version allowed to run against this config.
  - `appVersionSource: "remote"`: app version and build numbers are stored on EAS servers, not in local native project files.
- **`build` profiles**
  - `development`: `developmentClient: true` (builds an Expo dev client) with `distribution: "internal"` (shared through an internal link, not app stores).
  - `preview`: `distribution: "internal"`, for internal test builds.
  - `production`: `autoIncrement: true`, so EAS bumps the build number on each production build (works with the remote version source).
- **`submit`**
  - `production: {}`: an empty submit profile. `eas submit --profile production` falls back to defaults or interactive prompts for store credentials.

This is the default layout that `eas build:configure` generates. There is nothing project-specific in it beyond the CLI version floor.

## Exports
None (static JSON config).

## Dependencies
- **Internal:** `app.json` - supplies the EAS `projectId` that the EAS CLI pairs with this file.
- **Packages:** none. The EAS CLI (`eas-cli`) is not listed in `package.json`; it would be run globally or through `npx`.

## Used by
No source file imports it, and no npm script references it. Only the EAS CLI reads it, if someone runs `eas build` / `eas submit` by hand from the repo root.

## Notes
- The backend uses `expo-server-sdk` (in `server/services/pushNotification.ts`) to send Expo push notifications to the mobile apps. That is a runtime dependency and does not depend on this file.
- Running `eas build` here would fail without an Expo app entry point, because this repo contains none. Treat the file as a leftover or placeholder, kept to preserve the link to the EAS project.
- The file contains no secrets.
