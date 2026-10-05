# GET /workshop-preview/live-all

Returns all currently live workshops across all organizations.

---

## Details

| Property | Value |
|---|---|
| Method | `GET` |
| Auth | Not required |
| Body | None |
| Params | None |

---

## URL

```
{API_URL}/workshop-preview/live-all
```

Set `API_URL` in your `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000        # local
NEXT_PUBLIC_API_URL=https://test.garage.app      # staging
```

---

## Usage

```js
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workshop-preview/live-all`, {
  cache: "no-store"
});
const data = await res.json();
// data.workshops → array of live webinars
```

---

## Response

```json
{
  "success": true,
  "workshops": [
    {
      "workshopId": "664abc123...",
      "title": "How to Scale Live Events",
      "thumbnail": "https://s3.../thumb.jpg",
      "hostName": "Amit Patel",
      "hostProfilePicture": "https://s3.../avatar.jpg",
      "hostEmail": "amit@example.com",
      "meetId": "664def456...",
      "agoraChannel": "channel-xyz",
      "startedAt": "2026-05-06T09:12:00.000Z",
      "viewerCount": 24,
      "isScreenSharing": false,
      "webinarType": "mediasoup",
      "orgName": "GarageNew Office",
      "orgLogo": "https://s3.../logo.png",
      "webinarLink": "https://garage.app/webinar/664abc123..."
    }
  ]
}
```

If nothing is live:
```json
{ "success": true, "workshops": [] }
```

---

## Field Reference

| Field | Type | Description |
|---|---|---|
| `workshopId` | string | Workshop ID |
| `title` | string | Webinar title |
| `thumbnail` | string \| null | Cover image URL |
| `hostName` | string | Host's display name |
| `hostProfilePicture` | string \| null | Host's avatar URL |
| `hostEmail` | string | Host's email |
| `meetId` | string | Live meeting ID |
| `agoraChannel` | string | Agora channel name |
| `startedAt` | string | ISO timestamp when stream started |
| `viewerCount` | number | Current live viewer count |
| `isScreenSharing` | boolean | Whether host is screen sharing |
| `webinarType` | string | Always `"mediasoup"` |
| `orgName` | string | Organization name |
| `orgLogo` | string \| null | Organization logo URL |
| `webinarLink` | string | Direct link to join webinar instantly as attendee (no login required) |

---

## What to do with the response

### Join webinar instantly on card click (no login needed)
```js
window.open(workshop.webinarLink, "_blank", "noopener,noreferrer");
```

### Get LiveKit preview token for card video
```js
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workshop-preview/audience-token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ workshopId: workshop.workshopId })
});
const { token, serverUrl, roomName } = await res.json();
// Connect to LiveKit room using token + serverUrl
```
