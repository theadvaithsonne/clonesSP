# Public HQs API Documentation

This document describes the public API endpoints for fetching HQs data with founders' information. These endpoints are publicly accessible and do not require authentication.

## Base URL
```
/public
```

## Endpoints

### 1. Get All HQs

**Endpoint:** `GET /public/hq-organizations`

**Description:** Fetches all HQs with their founders' data.

**Authentication:** Not required (Public endpoint)

**Request:**

```http
GET /public/hq-organizations
```

**Response:**

```json
{
  "success": true,
  "count": 3,
  "organizations": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Acme Corporation",
      "size": "11-50",
      "location": "123 Main Street, Downtown",
      "city": "New York",
      "state": "New York",
      "country": "United States",
      "latitude": 40.7128,
      "longitude": -74.006,
      "description": "Leading technology company focused on innovation",
      "headingText": "Welcome to Acme",
      "subHeadingText": "Innovation at its finest",
      "icon": "https://uploadthing.com/icon-url",
      "coverPhoto": "https://uploadthing.com/cover-url",
      "promoVideoLink": "https://youtube.com/watch?v=abc123",
      "founders": [
        {
          "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
          "name": "John Doe",
          "email": "john.doe@acme.com",
          "joinedAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "_id": "64f1a2b3c4d5e6f7g8h9i0j3",
          "name": "Jane Smith",
          "email": "jane.smith@acme.com",
          "joinedAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-20T14:45:00.000Z"
    }
  ]
}
```

**Response Fields:**

| Field           | Type    | Description                             |
| --------------- | ------- | --------------------------------------- |
| `success`       | boolean | Indicates if the request was successful |
| `count`         | number  | Total number of organizations returned  |
| `organizations` | array   | Array of organization objects           |

**Organization Object Fields:**

| Field            | Type   | Description                                                 |
| ---------------- | ------ | ----------------------------------------------------------- |
| `_id`            | string | Unique organization identifier                              |
| `name`           | string | Organization name                                           |
| `size`           | string | Organization size (e.g., "1-10", "11-50", "51-200", "200+") |
| `location`       | string | Street address                                              |
| `city`           | string | City name                                                   |
| `state`          | string | State/Province name                                         |
| `country`        | string | Country name                                                |
| `latitude`       | number | Geographic latitude coordinate                              |
| `longitude`      | number | Geographic longitude coordinate                             |
| `description`    | string | Organization description                                    |
| `headingText`    | string | Main heading text                                           |
| `subHeadingText` | string | Sub heading text                                            |
| `icon`           | string | Organization icon URL                                       |
| `coverPhoto`     | string | Organization cover photo URL                                |
| `promoVideoLink` | string | Promotional video URL                                       |
| `founders`       | array  | Array of founder objects                                    |
| `createdAt`      | string | Organization creation timestamp (ISO 8601)                  |
| `updatedAt`      | string | Last update timestamp (ISO 8601)                            |

**Founder Object Fields:**

| Field      | Type   | Description                                         |
| ---------- | ------ | --------------------------------------------------- |
| `_id`      | string | Unique founder identifier                           |
| `name`     | string | Founder's full name                                 |
| `email`    | string | Founder's email address                             |
| `joinedAt` | string | When the founder joined the organization (ISO 8601) |

---

### 2. Get Single Organization

**Endpoint:** `GET /public/hq-organizations/:orgId`

**Description:** Fetches a specific HQ by ID with its founders' data.

**Authentication:** Not required (Public endpoint)

**Parameters:**

- `orgId` (path parameter): The unique identifier of the organization

**Request:**

```http
GET /public/hq-organizations/64f1a2b3c4d5e6f7g8h9i0j1
```

**Response (Success):**

```json
{
  "success": true,
  "organization": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Acme Corporation",
    "size": "11-50",
    "location": "123 Main Street, Downtown",
    "city": "New York",
    "state": "New York",
    "country": "United States",
    "latitude": 40.7128,
    "longitude": -74.006,
    "description": "Leading technology company focused on innovation",
    "headingText": "Welcome to Acme",
    "subHeadingText": "Innovation at its finest",
    "icon": "https://uploadthing.com/icon-url",
    "coverPhoto": "https://uploadthing.com/cover-url",
    "promoVideoLink": "https://youtube.com/watch?v=abc123",
    "founders": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "John Doe",
        "email": "john.doe@acme.com",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z"
  }
}
```

**Response (Not Found):**

```json
{
  "success": false,
  "error": "Organization not found"
}
```

**Response Fields:**

| Field          | Type    | Description                                   |
| -------------- | ------- | --------------------------------------------- |
| `success`      | boolean | Indicates if the request was successful       |
| `organization` | object  | Organization object (same structure as above) |

---

### 3. Get All Founders

**Endpoint:** `GET /public/all-founders`

**Description:** Fetches all founders across all organizations with their associated organization details.

**Authentication:** Not required (Public endpoint)

**Request:**

```http
GET /public/all-founders
```

**Response:**

```json
{
  "success": true,
  "count": 5,
  "founders": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "name": "John Doe",
      "email": "john.doe@acme.com",
      "profilePicture": "https://uploadthing.com/profile-url",
      "organizations": [
        {
          "organization": {
            "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
            "name": "Acme Corporation",
            "size": "11-50",
            "location": "123 Main Street, Downtown",
            "city": "New York",
            "state": "New York",
            "country": "United States",
            "description": "Leading technology company focused on innovation",
            "icon": "https://uploadthing.com/icon-url"
          },
          "joinedAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  ]
}
```

**Response Fields:**

| Field      | Type    | Description                                     |
| ---------- | ------- | ----------------------------------------------- |
| `success`  | boolean | Indicates if the request was successful         |
| `count`    | number  | Total number of founders returned               |
| `founders` | array   | Array of founder objects with organization data |

**Founder Object Fields:**

| Field            | Type   | Description                                    |
| ---------------- | ------ | ---------------------------------------------- |
| `_id`            | string | Unique founder identifier                      |
| `name`           | string | Founder's full name                            |
| `email`          | string | Founder's email address                        |
| `profilePicture` | string | Founder's profile picture URL                  |
| `organizations`  | array  | Array of organizations where they are founders |

---

### 4. Get All Stakeholders

**Endpoint:** `GET /public/all-stakeholders`

**Description:** Fetches all stakeholders across all organizations with their associated organization details.

**Authentication:** Not required (Public endpoint)

**Request:**

```http
GET /public/all-stakeholders
```

**Response:**

```json
{
  "success": true,
  "count": 8,
  "stakeholders": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j4",
      "name": "Alice Johnson",
      "email": "alice.johnson@techcorp.com",
      "profilePicture": "https://uploadthing.com/profile-url",
      "organizations": [
        {
          "organization": {
            "_id": "64f1a2b3c4d5e6f7g8h9i0j5",
            "name": "TechCorp Solutions",
            "size": "51-200",
            "location": "456 Innovation Drive",
            "city": "San Francisco",
            "state": "California",
            "country": "United States",
            "description": "Cutting-edge technology solutions provider",
            "icon": "https://uploadthing.com/icon-url"
          },
          "joinedAt": "2024-02-01T09:15:00.000Z"
        }
      ]
    }
  ]
}
```

**Response Fields:**

| Field          | Type    | Description                                         |
| -------------- | ------- | --------------------------------------------------- |
| `success`      | boolean | Indicates if the request was successful             |
| `count`        | number  | Total number of stakeholders returned               |
| `stakeholders` | array   | Array of stakeholder objects with organization data |

**Stakeholder Object Fields:**

| Field            | Type   | Description                                        |
| ---------------- | ------ | -------------------------------------------------- |
| `_id`            | string | Unique stakeholder identifier                      |
| `name`           | string | Stakeholder's full name                            |
| `email`          | string | Stakeholder's email address                        |
| `profilePicture` | string | Stakeholder's profile picture URL                  |
| `organizations`  | array  | Array of organizations where they are stakeholders |

---

## Error Responses

Both endpoints may return the following error responses:

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to fetch organizations",
  "message": "Detailed error message"
}
```

### 404 Not Found (Single Organization Endpoint)

```json
{
  "success": false,
  "error": "Organization not found"
}
```

---

## Usage Examples

### JavaScript/Fetch

```javascript
// Get all organizations
const response = await fetch("/public/hq-organizations");
const data = await response.json();
console.log(data.organizations);

// Get specific organization
const orgResponse = await fetch(
  "/public/hq-organizations/64f1a2b3c4d5e6f7g8h9i0j1"
);
const orgData = await orgResponse.json();
console.log(orgData.organization);
```

### cURL

```bash
# Get all organizations
curl -X GET "https://your-api-domain.com/public/hq-organizations"

# Get specific organization
curl -X GET "https://your-api-domain.com/public/hq-organizations/64f1a2b3c4d5e6f7g8h9i0j1"
```

### Python/Requests

```python
import requests

# Get all organizations
response = requests.get('https://your-api-domain.com/public/hq-organizations')
data = response.json()
print(data['organizations'])

# Get specific organization
org_response = requests.get('https://your-api-domain.com/public/hq-organizations/64f1a2b3c4d5e6f7g8h9i0j1')
org_data = org_response.json()
print(org_data['organization'])
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Geographic coordinates (latitude/longitude) are automatically generated using Google Geocoding API when organizations are created/updated
- The `founders` array will be empty if no founders are found for an organization
- Profile pictures are currently commented out in the response but can be enabled by uncommenting the `profilePicture` field in the API code
- These endpoints are optimized for performance using MongoDB lean queries and selective field projection

---

## Rate Limiting

Currently, there are no rate limits applied to these public endpoints. However, it's recommended to implement reasonable caching and rate limiting in production environments.

---

## Support

For any issues or questions regarding these APIs, please contact the development team.
