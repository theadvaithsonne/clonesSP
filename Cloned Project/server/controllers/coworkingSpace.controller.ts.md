# `server/controllers/coworkingSpace.controller.ts`

> Express controller for the coworking-space catalogue: garage admins create, read, update and delete it, and signed-in users get a read-only view of the active spaces.

**Kind:** Express controller · **Lines:** 337 · **Mounted at:** `/garage-admin/coworking-spaces` (browser: `/backend/garage-admin/coworking-spaces`)

## Purpose
Garage keeps a list of physical coworking spaces. Each space has office types priced per seat, and founders can book seats in them (bookings are handled by `coworkingSpaceBooking.controller.ts`). This controller manages the catalogue itself. Admin handlers create and edit spaces and geocode their address into latitude and longitude. The two "public" handlers give logged-in users the active spaces, without admin-only fields.

## How it works
- **Validation (zod):**
  - `officeTypeSchema`: `name` (required), `description`, `pricePerSeat >= 0`, `capacity >= 1`, `images[]`.
  - `createCoworkingSpaceSchema`: `name` (required), `description`, `location`, `city`, `state`, `country`, `images`, `amenities`, `officeTypes[]`, `rating` (0-5), `ratingCount`, `isActive`.
  - `updateCoworkingSpaceSchema`: the create schema made `.partial()`.
  - A validation failure returns `400 fail("Invalid input")`. The zod details are not returned.
- **Geocoding:** when `city`, `state` and `country` are all present, both create and update call `getCoordinatesFromAddress({ streetAddress: location, city, state, country })` from `server/utils/geocoding.ts`. That helper tries the Google Geocoding API and falls back to OpenStreetMap Nominatim. If it returns coordinates they are stored; otherwise latitude and longitude stay unset (on create) or unchanged (on update). An update that changes only some address fields does not re-geocode.
- **Response shape:** every handler wraps its result in `ok(...)` from `server/utils/http.ts` (`{ success: true, data }`) and maps `_id` to `id`. Admin responses include `isActive`, `createdBy` (populated with `name email`) and timestamps. Public responses leave those out.
- **Handlers:**
  - `getAllCoworkingSpaces`: every space, newest first.
  - `getCoworkingSpaceById`: one space by id, or 404.
  - `createCoworkingSpace`: sets `createdBy` to `req.garageAdmin.id` (attached by the garage-admin auth middleware). Returns 201.
  - `updateCoworkingSpace`: `findByIdAndUpdate(..., { new: true })`. Returns 404 if the space is missing.
  - `deleteCoworkingSpace`: hard delete. Existing bookings that point at the space are left in place.
  - `getUniqueOfficeTypes`: an aggregation that unwinds `officeTypes`, groups by `officeTypes.name` and sorts. Returns a plain array of names.
  - `getPublicCoworkingSpaces`: `{ isActive: true }`, newest first.
  - `getPublicCoworkingSpaceById`: `{ _id, isActive: true }`, or 404.
- Errors are logged and returned as `500 fail("Failed to ...")`.

## Exports
- `getAllCoworkingSpaces(req, res)` - admin list.
- `getCoworkingSpaceById(req, res)` - admin detail.
- `createCoworkingSpace(req, res)` - create, with geocoding.
- `updateCoworkingSpace(req, res)` - partial update, with geocoding.
- `deleteCoworkingSpace(req, res)` - hard delete.
- `getUniqueOfficeTypes(req, res)` - distinct office-type names.
- `getPublicCoworkingSpaces(req, res)` - active spaces for users.
- `getPublicCoworkingSpaceById(req, res)` - one active space for users.

## Interfaces
- **Endpoints served** (router `server/routes/coworkingSpace.ts`, mounted at `/garage-admin/coworking-spaces`. The global `/garage-admin` gate in `server/app.ts` (`garageAdminPageGate` + `requireAdminVerified`) also covers this whole mount):
  - `GET /backend/garage-admin/coworking-spaces/public` - `requireAuth`, public list
  - `GET /backend/garage-admin/coworking-spaces/public/:id` - `requireAuth`, public detail
  - `GET /backend/garage-admin/coworking-spaces/` - `requireGarageAdminAuth`
  - `GET /backend/garage-admin/coworking-spaces/office-types` - `requireGarageAdminAuth`
  - `GET /backend/garage-admin/coworking-spaces/:id` - `requireGarageAdminAuth`
  - `POST /backend/garage-admin/coworking-spaces/` - `requireGarageAdminAuth` + `requireGarageSuperAdmin`
  - `PUT /backend/garage-admin/coworking-spaces/:id` - super admin
  - `DELETE /backend/garage-admin/coworking-spaces/:id` - super admin
- **Database:** `CoworkingSpace` (model `CoworkingSpace`, default collection `coworkingspaces`) - read and write.
- **External services:** Google Geocoding API and OpenStreetMap Nominatim, both called indirectly through `getCoordinatesFromAddress`.

## Dependencies
- **Internal:** `server/models/coworkingSpace.model.ts` - the model. `server/utils/http.ts` - `ok`/`fail` envelopes. `server/utils/geocoding.ts` - address to coordinates.
- **Packages:** `express` (types), `zod` (body validation).

## Used by
- `server/routes/coworkingSpace.ts` (the only importer).
- Admin UI: `app/garage-admin/(admin-dashboard)/coworking-spaces/**` pages.
- User UI: `components/dashboard/CoworkingSpacesPage.tsx`.

## Notes
- The `/public` routes sit under the `/garage-admin` prefix, and `server/app.ts` puts `garageAdminPageGate` on all of `/garage-admin`. Normal user tokens still get through to them because `server/config/adminPages.ts` lists `^/garage-admin/coworking-spaces/public` in `GATE_BYPASS_PATTERNS`. The rest of this mount maps to the admin page key `coworking_spaces`. Keep that bypass entry if the routes ever move.
- Route order matters: `/public` and `/office-types` must be registered before `/:id` (see the router).
- The same field-mapping block appears five times; a shared serializer would remove the repetition.
