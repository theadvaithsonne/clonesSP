# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Roam Backend** is a Node.js/TypeScript backend for a collaborative workspace platform. It combines organization management, real-time messaging (Socket.IO), file storage (AWS S3), calendar/booking systems, and third-party integrations (GetStream video, Google Gemini AI).

## Development Command s

### Core Development
```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production (after build)
npm start
```

### Testing & Database
```bash
# Run the production server (requires dist/ from build)
node dist/index.js

# MongoDB connection string is in .env (MONGODB_URI)
```

## High-Level Architecture

### Entry Point & Server Setup
- **`src/index.ts`**: Application entry point. Creates HTTP server, initializes Socket.IO, connects to MongoDB, and starts listening
- **`src/app.ts`**: Express app configuration with CORS, JSON parsing, cookie parser, and route mounting
- **Port**: Default 4000 (configurable via `PORT` env var)

### Authentication Flow
1. **OTP-Based Login**: Users request an OTP via email (`/auth/request-otp`), verify it (`/auth/verify-otp`)
2. **Organization Selection**: If user has multiple organizations, they select one (`/auth/select-org`) to receive a JWT token
3. **JWT Token**: Contains `userId`, `orgId`, `name`, `email`. Valid for 7 days
4. **Token Verification**: `src/middleware/auth.ts` (REST) and `src/realtime/socket.ts` (WebSocket)

### Multi-Organization Support
- Users belong to multiple organizations via `User.organizations[]` array
- Each membership has: `organization` (ref), `role` (founder/stakeholder), `floorId`, `joinedAt`
- Legacy single-org fields (`User.organization`, `User.role`) maintained for backward compatibility
- JWT token is scoped to ONE organization at a time

### Real-Time Communication (Socket.IO)
- **Location**: `src/realtime/socket.ts`
- **Authentication**: JWT token via `auth.token` handshake or `Authorization` header
- **Features**:
  - **Direct Messages (DM)**: One-to-one chat with typing indicators, read receipts
  - **Group Chat**: Multi-user groups with mentions (`@username`), attachments, admins
  - **Workspace Presence**: Track users in virtual workspace rooms ("lobby" or private spaces)
  - **Screen Sharing**: Coordinate screenshare sessions with "knock" request system
  - **User Activity Tracking**: Online status, last activity timestamps
- **Conversation ID Format**: DMs use `dm:<userId1>:<userId2>` (sorted alphabetically)

### File Storage (AWS S3)
- **Service**: `src/services/s3.ts` - Singleton S3Service class
- **Operations**: Upload, download (presigned URLs), delete, metadata retrieval
- **File Organization**: `cabinet/{orgId}/{userId}/{timestamp}_{randomId}_{filename}`
- **Presigned URLs**: 7 days validity for downloads, 1 hour for uploads
- **Integration**: Cabinet system (Google Drive-like), message attachments, profile pictures

### Database Models (MongoDB/Mongoose)
Key models in `src/models/`:
- **`user.model.ts`**: Users with multi-org support, profile data, EarnGPT affiliate integration
- **`organization.model.ts`**: Organizations (HQs) with location data, branding, geocoded coordinates
- **`message.model.ts`**: Direct messages with `convId`, attachments, read status, reply-to
- **`groupMessage.model.ts`**: Group messages with mentions array, attachments
- **`group.model.ts`**: Chat groups with members (userId + role + lastReadAt)
- **`cabinet.model.ts`**: Folders for file organization
- **`file.model.ts`**: File metadata referencing S3 keys
- **`garageAdmin.model.ts`**: Separate admin system with super admin/admin roles
- **`booking.model.ts`**: Calendar/space bookings
- **`notification.model.ts`**: User notifications (group mentions, invites, etc.)
- **`task.model.ts`**, **`todo.model.ts`**: Task management features

### Route Structure
Routes in `src/routes/` and mounted in `src/app.ts`:
- **`/auth`**: OTP request/verify, org selection, user profile (`/auth/me`)
- **`/dm`**: Direct messaging (get messages, mark read, edit/delete)
- **`/groups`**: Group chat (create, add members, messages, read status)
- **`/org`**: Organization CRUD, update location (triggers Google Geocoding)
- **`/team`**: List team members for an organization
- **`/cabinet`**: File/folder management (create folders, upload/download files)
- **`/upload`**: General file upload endpoint (multipart/form-data)
- **`/public`**: Public unauthenticated endpoints (list HQs, founders, stakeholders)
- **`/garage-admin`**: Separate admin panel for garage operations
- **`/betty`**: AI assistant integration (Google Gemini)
- **`/ask-cabinet`**: AI-powered cabinet file querying
- **`/stream`**: GetStream video chat integration
- **`/calendar`**: Booking system for spaces/resources
- **`/floors`**: Virtual floor/space management
- **`/tasks`**, **`/todos`**: Task management
- **`/invites`**: Organization invitations
- **`/profile`**: User profile updates
- **`/apps`**: Marketplace app subscriptions
- **`/affiliate`**: EarnGPT referral system
- **`/link-preview`**: URL metadata scraping for chat
- **`/user-activity`**: Activity tracking endpoints

### Third-Party Integrations
- **Resend**: Email service for OTP delivery (`src/services/mailer.ts`)
- **AWS S3**: File storage (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Google Geocoding**: Converts addresses to lat/long (`src/utils/geocoding.ts`)
- **GetStream**: Video chat SDK integration (`@stream-io/node-sdk`)
- **Google Gemini AI**: AI assistant features (`@google/generative-ai`)
- **EarnGPT**: Affiliate/referral tracking system
- **UploadThing**: Alternative file upload service (legacy, being migrated to S3)

## Key Architectural Patterns

### Conversation ID Generation
For DMs, always sort user IDs alphabetically to ensure consistent conversation IDs:
```typescript
// src/utils/conv.ts
export function dmConvId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}
```

### Presigned URLs vs Direct Storage
- Use presigned S3 URLs (7 days) for file access to avoid exposing credentials
- Store only S3 keys in database, generate URLs on-demand
- File uploads: client uploads to presigned URL, backend stores metadata

### JWT Token Scoping
- Tokens are org-scoped: one token per user-org combination
- When user switches orgs, generate new token via `/auth/select-org`
- Socket.IO extracts `userId` and `orgId` from token for all real-time operations

### Mentions in Group Chats
- Text parsed for `@username`, `@email`, or `@userId` patterns
- Mentioned users stored in `mentions[]` array
- High-priority notifications sent to mentioned users via Socket.IO

### Rate Limiting & Concurrency
- Knock system has rate limiting: 3 knocks per minute per user
- Multiple socket connections tracked per user (desktop + mobile)
- Presence state cleaned up every 10 minutes (30-minute staleness threshold)

## Environment Variables

Critical variables in `.env` (see `src/config/env.ts`):
```bash
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://...

# Auth
JWT_SECRET=your-secret-key

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM=noreply@yourdomain.com

# AWS S3
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_ENDPOINT=https://s3.amazonaws.com (optional for custom endpoints)
AWS_S3_FORCE_PATH_STYLE=false

# Optional Integrations
UPLOADTHING_SECRET=xxx
EARN_GPT_API_KEY=xxx
```

## Common Development Patterns

### Adding a New REST Endpoint
1. Create controller in `src/controllers/` (or add to existing)
2. Create route in `src/routes/` (or add to existing router)
3. Mount route in `src/app.ts`
4. Use `requireAuth` middleware for protected endpoints
5. Extract `req.user.userId` and `req.user.orgId` from authenticated request

### Adding a Socket.IO Event
1. Open `src/realtime/socket.ts`
2. Add event listener in `io.on('connection', (socket) => { ... })`
3. Extract `socket.userId` and `socket.orgId` from authenticated socket
4. Emit events to rooms: `io.to(roomId).emit('event:name', data)`
5. Use acknowledgments for request/response patterns

### Working with S3 Files
```typescript
import { s3Service } from '../services/s3';

// Upload
const key = s3Service.generateFileKey(userId, orgId, fileName);
await s3Service.uploadFile(key, buffer, contentType);

// Get presigned download URL
const url = await s3Service.getPresignedDownloadUrl(key, 604800); // 7 days

// Delete
await s3Service.deleteFile(key);
```

### Geocoding Addresses
Organization addresses are automatically geocoded when created/updated:
```typescript
import { geocodeAddress } from '../utils/geocoding';

const coords = await geocodeAddress(location, city, state, country);
// Returns { latitude, longitude } or null
```

## Testing Considerations
- No test framework currently configured
- Manual testing via Postman collection: `Roam-Public-APIs.postman_collection.json`
- Socket.IO testing requires WebSocket client (socket.io-client)
- Use `/health` endpoint to verify server is running

## Database Migrations
- No formal migration system
- Schema changes handled via Mongoose schema updates
- Legacy fields kept for backward compatibility (e.g., `User.organization` alongside `User.organizations[]`)
- Migration script example: `src/scripts/migrate-cabinets.ts`

## Security Notes
- JWT tokens expire in 7 days
- OTP codes expire in 10 minutes
- S3 presigned URLs expire (uploads: 1h, downloads: 7d)
- User isolation: queries filtered by `userId` and `orgId`
- Path sanitization in S3 keys to prevent directory traversal
- Socket.IO rooms prevent cross-conversation leakage
- Garage admin system is completely separate with its own auth

## Module Organization

### Core Services (`src/services/`)
- `jwt.ts`: Token generation/verification
- `otp.ts`: OTP code generation/validation
- `mailer.ts`: Email sending via Resend
- `s3.ts`: AWS S3 operations
- `socket.ts`: Socket.IO instance management
- `init.ts`, `garageAdminInit.ts`: Initialization scripts

### Utilities (`src/utils/`)
- `conv.ts`: Conversation ID generation
- `http.ts`: HTTP response helpers
- `geocoding.ts`: Google Geocoding API wrapper
- `uploadthing.ts`: UploadThing integration (legacy)
- `videoCompression.ts`: Video processing utilities

### Middleware (`src/middleware/`)
- `auth.ts`: JWT authentication for REST endpoints
- `garageAdminAuth.ts`: Separate auth for garage admin routes
- `rbac.ts`, `roles.ts`: Role-based access control helpers

## API Documentation
Comprehensive API docs available in repository:
- **`API_DOCUMENTATION.md`**: Public HQs API (founders, stakeholders, organizations)
- **`MOBILE_API_DOCUMENTATION.md`**: Full mobile app integration guide (auth, chat, files)
- **`CABINET_SYSTEM_README.md`**: File storage system details
- **`GARAGE_ADMIN_README.md`**: Admin panel documentation

## Special Features

### Cabinet System (File Storage)
Google Drive-like interface with:
- Nested folders (cabinets)
- File uploads up to 100MB
- Search across files and folders
- Organization and user isolation
- AI-powered "Ask Cabinet" feature for querying file contents

### Garage Admin Panel
Separate admin system with:
- OTP-based authentication
- Super Admin role (initial: shorupan@yopmail.com)
- Admin invitation and management
- Independent from main user system

### Workspace Presence
Virtual workspace with:
- Lobby and private spaces
- Knock system for requesting access
- Screen sharing coordination
- Online/busy/AFK status tracking
- Multiple device support per user

### GetStream Video Integration
- Create video call tokens
- Room management
- Call recording flags
- Integrated with workspace presence

## Common Gotchas
- **DM Conversation IDs**: Always sort user IDs alphabetically before generating `dmConvId`
- **Organization Context**: Most operations require `orgId` - user can belong to multiple orgs but token is scoped to one
- **Socket.IO Rooms**: Join appropriate rooms (`dm:xxx`, `group:xxx`, `space:xxx`) before expecting events
- **S3 File Keys**: Store keys, not full URLs - URLs expire, keys don't
- **Mongoose Lean**: Use `.lean()` for read-only queries to get plain objects instead of documents
- **Presigned URL Expiry**: Plan for URL expiration - implement refresh logic if URLs are long-lived
- **Time Zones**: All timestamps in UTC (ISO 8601 format)

## Deploy & production

- **`dist/` is committed to git.** Deploying is `git pull` + `pm2 restart` on the
  box — nothing is built server-side. Always run `npm run build` and commit the
  `dist/` change together with the `src/` change, or prod silently runs old code.
- Prod: `root@168.144.72.230` (hostname `Garage-Office--176`), app at
  `/root/garagenew-backend`, pm2 process **`garage-prod`**. Public API is
  `https://test.garage.app`.
- `.env` lives on the box and is NOT in git. After editing it,
  `pm2 restart garage-prod --update-env` — pm2 will not otherwise pick it up.
- After any restart, check `restart_time` twice a few seconds apart. A rising
  count is a crash loop, and this app has had one in production
  (`ERR_REQUIRE_ESM` from a dependency installed outside its `package.json`
  range). `status: online` alone does not mean healthy.

## Verification traps

- **Typecheck with `./node_modules/.bin/tsc --noEmit -p tsconfig.json`.**
  `npx --no tsc --noEmit` produces NO output and exits cleanly even when the
  code is broken — it looks exactly like a pass. Always read the real exit code
  (`echo $?` on its own line, not after a pipe).
- **Never boot the server locally to test.** `.env` points at the PRODUCTION
  database and startup schedules cron jobs. To exercise a route's logic, require
  the compiled modules from `dist/` in a small node script and call the same
  queries directly — that verifies the real data path without side effects.

## Express: router-level middleware runs BEFORE route matching

Several routers are mounted on the bare `/garage-admin` prefix, ordered so their
leaf routes win over more general ones (see `app.ts`). In that arrangement
`router.use(auth)` is a trap: it fires for **every** request under the prefix,
including paths the router doesn't define, and rejects them before the next
router is reached.

This took down admin login in production — `garageAdminDangerZone` guarded
itself with `router.use(...)`, which then intercepted `/garage-admin/request-otp`
and `/verify-otp` (the login itself, no token yet) and returned
`401 No token provided`.

Attach guards **per route** on any router sharing a mount prefix:

```ts
const superAdminOnly = [requireGarageAdminAuth, requireGarageSuperAdmin];
router.delete("/users/:id", superAdminOnly, handler);
```

## WhatsApp (11za) — `services/elevenZaWhatsapp.ts`

- Endpoint `POST https://api.11za.in/apis/template/sendTemplate`.
- **`IsSuccess` is the only success signal.** Rejections come back as HTTP 200
  with `IsSuccess: false`, so checking `res.ok` reports failures as sent.
- `sendto` is country code + digits with **no `+`** (`919022108802`), unlike the
  E.164 that 2Factor SMS takes. `toElevenZaNumber()` handles the difference.
- Working OTP template: **`garage_otp`** (one body variable, no header image).
  A template with a header image fails with `Invalid File or File Not found`
  because the send code passes no file.
- `POST /apis/template/getTemplates` lists templates but is **incomplete** —
  `garage_otp` does not appear in it. Do not conclude a template is missing from
  that listing; try sending to it.
- `/auth/phone/request-otp` takes `channel: "sms" | "whatsapp" | "both"` and
  **defaults to `"sms"`** so older clients don't start paying per WhatsApp
  message. A caller that omits it gets SMS only, no matter how the env is set.
  Both channels are attempted independently; the request fails only if every
  attempted channel failed.

## Push notifications are already built and live

`services/pushNotification.ts` + call sites in `realtime/socket.ts` send Expo
pushes for DMs, group messages, mentions, calls and knocks, with the correct
`data.type`/`data.chatId` shape and Android `channelId`. Tokens register via
`routes/devices.ts`. Don't rebuild this.

Known gap: the code checks Expo **tickets** but never fetches **receipts**. An
`ok` ticket only means Expo accepted the push, not that FCM delivered it —
`MismatchSenderId` and delayed `DeviceNotRegistered` appear only in receipts. If
Android delivery is reported broken while `devicetokens.lastUsedAt` is updating
(it is only written on an `ok` ticket), that is the first place to look.

## Webinar data model notes

- A workshop keeps **one `workshopId` across every session it ever runs**, and
  `webinarmessages` / `webinarproductpins` are stored against it. Anything
  replaying a single recording must bound results by that recording's duration,
  or it will show chat and pins from other sessions.
- `recordingStartedAt()` (`utils/recordingTime.ts`) derives egress start from the
  S3 key. A file's `createdAt` is UPLOAD time and can be hours later on a long
  stream — useless as a replay anchor. Shared by the authed and public routes so
  they can't drift.
- "Has this session finished?" is answered by a filed recording, not the workshop
  doc: workshops carry no `endedAt`/`isLive`/`status`, only scheduled start/end
  strings. Gating on those fields 403s everything.
- `WorkshopRegistration.status === "attended"` is **never written** by any
  webinar code, so every "attended" count derived from it is 0.

## StoreWallet is multi-currency — NEVER `findOne({ userId, orgId })`

Since Aug 28 2026, cryptobrand orgs (`officeCreatedFromCryptobrand: true`,
16 orgs incl. Garage App) carry **INR/ETH/BTC sibling wallets** beside the
USD parent, and uniqueness moved to `{userId, orgId, currency}`.

A bare `StoreWallet.findOne({ userId, orgId })` now resolves through that
index, where **"BTC" sorts first** — so it returns the BTC wallet, not USD.
Verified in prod: 1564 of 1564 duplicated (user, org) pairs return BTC.
The model comment claims "every legacy caller reads USD"; that is NOT true
of an unpinned query. **Always pass `currency`** (USD is the parent).

Read helpers are already pinned (`getStoreWalletBalance`,
`getStoreWalletTransactions`, both take `currency = "USD"`; the
`/wallet/store/balance` + `/wallet/store/transactions` routes expose an
optional `?currency=`). The **write/credit paths were deliberately left
unpinned** — owned separately. Until they are fixed, commissions on
cryptobrand orgs land in the BTC wallet, so a store's USD balance can look
frozen while a same-named BTC wallet accrues USD-denominated rows.

`/wallet/store/all` returns **one row per currency**, so any consumer
listing "stores" must group by `orgId` — otherwise each store renders once
per currency (this was the Vaults-page duplicate bug).
