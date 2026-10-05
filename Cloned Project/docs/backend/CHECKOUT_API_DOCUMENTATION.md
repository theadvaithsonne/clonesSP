# Checkout Links API Documentation

Complete API documentation for all serviceable item checkout flows in the Roam platform. This guide covers checkout APIs for **Products**, **Courses**, **Workshops**, **Channels**, and **Services** - designed for mobile app integration.

---

## Table of Contents

### API Documentation
1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication Flow](#authentication-flow)
4. [Serviceable Item Types](#serviceable-item-types)
5. [Product Checkout](#product-checkout)
6. [Course Checkout](#course-checkout)
7. [Workshop Checkout](#workshop-checkout)
8. [Channel Checkout](#channel-checkout)
9. [Service Checkout](#service-checkout)
10. [Coupon Validation](#coupon-validation)
11. [Affiliate/Referral System](#affiliatereferral-system)
12. [Payment Integration (Razorpay)](#payment-integration-razorpay)
13. [Error Handling](#error-handling)
14. [Complete Flow Examples](#complete-flow-examples)
15. [API Endpoints Summary](#api-endpoints-summary)

### Frontend Implementation Guide
16. [Frontend Page Structure](#frontend-page-structure)
17. [UI Flow States](#ui-flow-states)
18. [UI Layout Patterns](#ui-layout-patterns)
19. [UI Components Reference](#ui-components-reference)
20. [Razorpay Integration Details](#razorpay-integration-details)
21. [Token Storage & Auth](#token-storage--auth)
22. [Error Toast Patterns](#error-toast-patterns)
23. [Affiliate Invite Page Details](#affiliate-invite-page-details)
24. [Mobile App Implementation Checklist](#mobile-app-implementation-checklist)

---

## Overview

The checkout system allows users to purchase or subscribe to various items (products, courses, workshops, channels, services) through a unified OTP-based authentication flow. Key features:

- **Public Endpoints**: All checkout routes are public (no JWT required initially)
- **OTP-Based Auth**: Users verify their email via 6-digit OTP
- **Affiliate Support**: Referral tracking via `referralId` parameter
- **Coupon Support**: Discount codes applicable during checkout
- **Payment Options**: Free items, one-time payments, and subscriptions
- **Auto Organization Join**: Users automatically join the item's organization

---

## Base URL

```
https://your-api-domain.com/checkout
```

All checkout endpoints are mounted under `/checkout`.

---

## Authentication Flow

All checkout flows follow the same authentication pattern:

1. **Fetch Item Details** (GET) - Public, no auth required
2. **Request OTP** (POST) - Send verification code to email
3. **Verify OTP** (POST) - Validate code, check user status
4. **Process Checkout** (POST) - Create user, handle payment/enrollment
5. **Verify Payment** (POST) - For paid items, verify Razorpay payment

After successful checkout, a JWT token is returned for authenticated access.

---

## Serviceable Item Types

| Item Type | Description | Payment Models |
|-----------|-------------|----------------|
| `product` | Physical or digital products | Free, One-time, Subscription |
| `course` | Online courses with chapters | Free, One-time, Subscription |
| `workshop` | Live webinars/workshops | Free, One-time, Subscription |
| `channel` | Premium content channels | Free, One-time, Subscription |
| `service` | Milestone-based services | Free, Pay Before Milestone, Pay After Milestone |

---

## Product Checkout

### 1. Get Product Details

```http
GET /checkout/product/:productId
```

**Response:**
```json
{
  "success": true,
  "product": {
    "_id": "64abc123...",
    "name": "Premium Course Bundle",
    "slug": "premium-course-bundle",
    "description": "Complete learning package",
    "price": 999,
    "currency": "INR",
    "images": ["https://..."],
    "isDigital": true,
    "isFree": false,
    "isSubscription": false,
    "subscriptionPeriod": null,
    "channelIds": ["64def456..."],
    "requiresShipping": false,
    "deliveryMethod": "digital"
  },
  "organization": {
    "_id": "64org789...",
    "name": "TechEdu Academy",
    "slug": "techedu",
    "icon": "https://...",
    "coverPhoto": "https://...",
    "description": "Learn tech skills"
  }
}
```

### 2. Request OTP

```http
POST /checkout/product/:productId/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

### 3. Verify OTP

```http
POST /checkout/product/:productId/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "64user123..." | null,
  "isMember": false,
  "needsProfile": true,
  "user": {
    "email": "user@example.com",
    "name": "John Doe"
  } | null
}
```

### 4. Process Checkout

```http
POST /checkout/product/:productId/process-checkout
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "quantity": 1,
  "shippingAddress": {
    "fullName": "John Doe",
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400001",
    "country": "India",
    "phone": "+919876543210"
  },
  "referralId": "AFF123XYZ",
  "couponCode": "SAVE20"
}
```

**Response (One-time Payment):**
```json
{
  "success": true,
  "isMember": false,
  "isSubscription": false,
  "razorpayOrder": {
    "id": "order_ABC123",
    "amount": 79900,
    "currency": "INR"
  },
  "product": {
    "name": "Premium Course Bundle",
    "originalPrice": 999,
    "price": 799,
    "quantity": 1,
    "originalTotalAmount": 999,
    "totalAmount": 799
  },
  "coupon": {
    "code": "SAVE20",
    "discountValue": 20,
    "discountAmount": 20000
  },
  "couponUsageId": "64coupon...",
  "token": "eyJhbG...",
  "orgId": "64org789...",
  "userId": "64user123...",
  "requiresShipping": false
}
```

**Response (Subscription):**
```json
{
  "success": true,
  "isMember": false,
  "isSubscription": true,
  "razorpaySubscription": {
    "id": "sub_ABC123",
    "shortUrl": "https://rzp.io/i/ABC123"
  },
  "coupon": {...},
  "couponUsageId": "64coupon...",
  "token": "eyJhbG...",
  "orgId": "64org789...",
  "userId": "64user123..."
}
```

**Response (Free Product):**
```json
{
  "success": true,
  "isMember": false,
  "isFree": true,
  "order": {...},
  "token": "eyJhbG...",
  "orgId": "64org789...",
  "userId": "64user123..."
}
```

### 5. Verify Payment (One-time)

```http
POST /checkout/product/:productId/verify-payment
Content-Type: application/json

{
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash",
  "userId": "64user123...",
  "quantity": 1,
  "shippingAddress": {...},
  "couponUsageId": "64coupon..."
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "_id": "64order...",
    "status": "paid",
    ...
  },
  "token": "eyJhbG...",
  "orgId": "64org789..."
}
```

### 6. Verify Subscription

```http
POST /checkout/product/:productId/verify-subscription
Content-Type: application/json

{
  "razorpaySubscriptionId": "sub_ABC123",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_ABC123",
    "status": "active"
  },
  "token": "eyJhbG...",
  "orgId": "64org789..."
}
```

---

## Course Checkout

### 1. Get Course Details

```http
GET /checkout/course/:courseId
```

**Response:**
```json
{
  "success": true,
  "course": {
    "_id": "64course...",
    "title": "Web Development Masterclass",
    "description": "Learn full-stack development",
    "coverImage": "https://...",
    "isPaid": true,
    "isFree": false,
    "price": 2999,
    "currency": "INR",
    "isSubscription": false,
    "subscriptionPeriod": null,
    "channelIds": ["64chan..."],
    "totalDuration": 4800,
    "totalChapters": 48,
    "enrolledStudents": 1250
  },
  "organization": {...}
}
```

### 2. Request OTP

```http
POST /checkout/course/:courseId/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 3. Verify OTP

```http
POST /checkout/course/:courseId/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

### 4. Process Checkout

```http
POST /checkout/course/:courseId/process-checkout
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "referralId": "AFF123XYZ",
  "couponCode": "LEARN50"
}
```

**Response (Paid Course):**
```json
{
  "success": true,
  "isMember": false,
  "isFree": false,
  "isSubscription": false,
  "razorpayOrder": {
    "id": "order_ABC123",
    "amount": 199900,
    "currency": "INR"
  },
  "course": {
    "title": "Web Development Masterclass",
    "originalPrice": 2999,
    "price": 1999
  },
  "coupon": {...},
  "couponUsageId": "64coupon...",
  "token": "eyJhbG...",
  "orgId": "64org789...",
  "userId": "64user123..."
}
```

### 5. Verify Payment

```http
POST /checkout/course/:courseId/verify-payment
Content-Type: application/json

{
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

### 6. Verify Subscription

```http
POST /checkout/course/:courseId/verify-subscription
Content-Type: application/json

{
  "razorpaySubscriptionId": "sub_ABC123",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

---

## Workshop Checkout

### 1. Get Workshop Details

```http
GET /checkout/workshop/:workshopId
```

**Response:**
```json
{
  "success": true,
  "workshop": {
    "_id": "64workshop...",
    "title": "AI Workshop: Build Your First ChatBot",
    "description": "Hands-on workshop",
    "thumbnail": "https://...",
    "date": "2024-02-15",
    "startTime": "14:00",
    "endTime": "17:00",
    "timezone": "Asia/Kolkata",
    "maxParticipants": 100,
    "isFree": false,
    "price": 499,
    "currency": "INR",
    "isSubscription": false,
    "subscriptionPeriod": null,
    "isRecurring": false,
    "recurrencePattern": null,
    "channelIds": [],
    "host": {
      "name": "Dr. Jane Smith",
      "profilePicture": "https://..."
    }
  },
  "organization": {...}
}
```

### 2. Request OTP

```http
POST /checkout/workshop/:workshopId/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 3. Verify OTP

```http
POST /checkout/workshop/:workshopId/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

### 4. Process Checkout

```http
POST /checkout/workshop/:workshopId/process-checkout
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "referralId": "AFF123XYZ",
  "couponCode": "EARLY20"
}
```

### 5. Verify Payment

```http
POST /checkout/workshop/:workshopId/verify-payment
Content-Type: application/json

{
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

### 6. Verify Subscription

```http
POST /checkout/workshop/:workshopId/verify-subscription
Content-Type: application/json

{
  "razorpaySubscriptionId": "sub_ABC123",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

---

## Channel Checkout

### 1. Get Channel Details

```http
GET /checkout/channel/:channelId
```

**Response:**
```json
{
  "success": true,
  "channel": {
    "_id": "64channel...",
    "title": "Premium Tech News",
    "description": "Exclusive tech insights",
    "coverImage": "https://...",
    "isFree": false,
    "price": 199,
    "currency": "INR",
    "isSubscription": true,
    "subscriptionPeriod": "monthly",
    "creator": {
      "name": "Tech Guru",
      "profilePicture": "https://..."
    }
  },
  "organization": {...}
}
```

### 2. Request OTP

```http
POST /checkout/channel/:channelId/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 3. Verify OTP

```http
POST /checkout/channel/:channelId/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

### 4. Process Checkout

```http
POST /checkout/channel/:channelId/process-checkout
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "referralId": "AFF123XYZ",
  "couponCode": "SUB10"
}
```

### 5. Verify Payment

```http
POST /checkout/channel/:channelId/verify-payment
Content-Type: application/json

{
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

### 6. Verify Subscription

```http
POST /checkout/channel/:channelId/verify-subscription
Content-Type: application/json

{
  "razorpaySubscriptionId": "sub_ABC123",
  "userId": "64user123...",
  "couponUsageId": "64coupon..."
}
```

---

## Service Checkout

Services have a unique milestone-based payment system. Users opt-in first, then pay per milestone.

### 1. Get Service Details

```http
GET /checkout/service/:serviceId
```

**Response:**
```json
{
  "success": true,
  "service": {
    "_id": "64service...",
    "title": "Website Development Package",
    "slug": "website-development-package",
    "description": "Complete website solution",
    "longDescription": "Detailed description...",
    "icon": "https://...",
    "iconBgColor": "#3B82F6",
    "coverImage": "https://...",
    "tags": ["web", "development", "design"],
    "features": ["Responsive Design", "SEO Optimization"],
    "deliverables": ["Source Code", "Documentation"],
    "duration": "4-6 weeks",
    "teamSize": "3-5 experts",
    "paymentTiming": "pay_before_milestone",
    "currency": "INR",
    "totalPrice": 50000,
    "milestones": [
      {
        "_id": "64mile1...",
        "order": 1,
        "title": "Discovery & Planning",
        "description": "Requirements gathering",
        "duration": "1 week",
        "paymentAmount": 10000,
        "currency": "INR"
      },
      {
        "_id": "64mile2...",
        "order": 2,
        "title": "Design Phase",
        "description": "UI/UX design",
        "duration": "2 weeks",
        "paymentAmount": 15000,
        "currency": "INR"
      },
      {
        "_id": "64mile3...",
        "order": 3,
        "title": "Development",
        "description": "Building the website",
        "duration": "2 weeks",
        "paymentAmount": 20000,
        "currency": "INR"
      },
      {
        "_id": "64mile4...",
        "order": 4,
        "title": "Launch & Handover",
        "description": "Deployment and training",
        "duration": "1 week",
        "paymentAmount": 5000,
        "currency": "INR"
      }
    ],
    "status": "active",
    "projectsCompleted": 25,
    "activeOptIns": 8
  },
  "organization": {...}
}
```

### 2. Request OTP (Init)

```http
POST /checkout/service/:serviceId/init
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 3. Verify OTP

```http
POST /checkout/service/:serviceId/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "64user123...",
  "isMember": false,
  "needsProfile": true,
  "alreadyOptedIn": false,
  "token": null
}
```

### 4. Update Profile (Optional)

```http
POST /checkout/service/:serviceId/update-profile
Content-Type: application/json

{
  "userId": "64user123...",
  "name": "John Doe"
}
```

### 5. Opt-In to Service

```http
POST /checkout/service/:serviceId/opt-in
Content-Type: application/json

{
  "userId": "64user123...",
  "referralId": "AFF123XYZ"
}
```

**Response:**
```json
{
  "success": true,
  "optIn": {
    "_id": "64optin...",
    "serviceId": "64service...",
    "userId": "64user123...",
    "status": "opted",
    "progressPercentage": 0
  },
  "token": "eyJhbG..."
}
```

### 6. Service Milestone Payment (Authenticated)

After opt-in, users pay for milestones. These endpoints require JWT authentication.

#### Create Payment Order

```http
POST /services/opt-ins/:optInId/milestones/:milestoneId/create-order
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order_ABC123",
    "amount": 1000000,
    "currency": "INR"
  },
  "milestone": {
    "id": "64mile1...",
    "title": "Discovery & Planning",
    "amount": 10000,
    "currency": "INR"
  },
  "service": {
    "id": "64service...",
    "title": "Website Development Package"
  }
}
```

#### Verify Milestone Payment

```http
POST /services/opt-ins/:optInId/milestones/:milestoneId/verify-payment
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "optIn": {
    "_id": "64optin...",
    "milestonesProgress": [
      {
        "milestoneId": "64mile1...",
        "status": "pending",
        "paymentStatus": "paid",
        "paymentId": "pay_XYZ789",
        "paidAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

## Coupon Validation

Validate coupons before checkout to show discounted prices.

```http
POST /checkout/validate-coupon
Content-Type: application/json

{
  "code": "SAVE20",
  "itemType": "product",
  "itemId": "64product...",
  "amount": 99900,
  "userId": "64user123...",
  "orgId": "64org789..."
}
```

**Valid Item Types:**
- `channel`
- `course`
- `workshop`
- `product`
- `office_plan`
- `office_addon`

**Response (Valid):**
```json
{
  "valid": true,
  "coupon": {
    "_id": "64coupon...",
    "code": "SAVE20",
    "discountValue": 20,
    "razorpayOfferId": null
  },
  "discountAmount": 19980,
  "finalAmount": 79920
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Coupon has expired"
}
```

---

## Affiliate/Referral System

The affiliate system tracks referrals and distributes commissions.

### Get User's Affiliate ID (Authenticated)

```http
GET /affiliate/my-affiliate-id
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "affiliateId": "AFF123XYZ",
  "hasAffiliateId": true
}
```

### Get Referrer Info (Public)

```http
GET /affiliate/referrer-info?affiliateId=AFF123XYZ
```

**Response:**
```json
{
  "success": true,
  "referrer": {
    "id": "64user...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "profilePicture": "https://...",
    "affiliateCode": "AFF123XYZ",
    "stats": {
      "totalReferrals": 45,
      "activeReferrals": 42,
      "foundedOrgsCount": 3
    }
  }
}
```

### Get Affiliate Stats (Authenticated)

```http
GET /affiliate/stats
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalReferrals": 45,
    "activeReferrals": 42,
    "foundedOrgsCount": 3
  },
  "affiliateId": "AFF123XYZ"
}
```

### Get Affiliate Network Tree (Authenticated)

```http
GET /affiliate/network
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "network": [
    {
      "id": "64child1...",
      "name": "User One",
      "email": "user1@example.com",
      "avatar": "https://...",
      "affiliateId": "AFF456",
      "joinedAt": "2024-01-10T...",
      "level": 1,
      "status": "active",
      "userType": "customer",
      "totalReferrals": 5,
      "directReferrals": 2,
      "children": [...]
    }
  ],
  "affiliateId": "AFF123XYZ",
  "currentUser": {
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://..."
  }
}
```

### Using Referral ID in Checkout

Pass the `referralId` parameter in the `process-checkout` request:

```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "referralId": "AFF123XYZ"
}
```

This will:
1. Link the new user to the referrer
2. Track the referral relationship
3. Enable commission distribution on payment

---

## Payment Integration (Razorpay)

### One-time Payments

1. Call `process-checkout` to get Razorpay order
2. Open Razorpay checkout with order ID
3. On success, call `verify-payment` with payment details

**Razorpay Checkout Configuration:**
```javascript
const options = {
  key: "rzp_live_xxxxx",
  amount: response.razorpayOrder.amount,
  currency: response.razorpayOrder.currency,
  name: "Organization Name",
  description: "Product Description",
  order_id: response.razorpayOrder.id,
  handler: function(paymentResponse) {
    // Call verify-payment endpoint
    verifyPayment({
      razorpayOrderId: paymentResponse.razorpay_order_id,
      razorpayPaymentId: paymentResponse.razorpay_payment_id,
      razorpaySignature: paymentResponse.razorpay_signature,
      userId: userId
    });
  }
};
```

### Subscriptions

1. Call `process-checkout` to get Razorpay subscription
2. Redirect to `shortUrl` for subscription payment
3. On return, call `verify-subscription` with subscription ID

```javascript
// Redirect to Razorpay subscription page
window.location.href = response.razorpaySubscription.shortUrl;

// After redirect back, verify subscription
verifySubscription({
  razorpaySubscriptionId: subscriptionId,
  userId: userId
});
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid product ID"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid or expired OTP"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Product not found or not available"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to process checkout",
  "details": "Database connection error"
}
```

### OTP Expiry

OTP codes expire after **10 minutes**. Request a new OTP if expired.

### Payment Verification Failure

If `verify-payment` fails:
- Coupon usage is automatically marked as failed
- User can retry payment with a new order

---

## Complete Flow Examples

### Example 1: Free Product Checkout

```
1. GET /checkout/product/64abc...
   -> Get product details (isFree: true)

2. POST /checkout/product/64abc.../request-otp
   -> { email: "user@example.com" }
   <- { success: true }

3. POST /checkout/product/64abc.../verify-otp
   -> { email: "user@example.com", code: "123456" }
   <- { success: true, userId: null, needsProfile: true }

4. POST /checkout/product/64abc.../process-checkout
   -> { email: "user@example.com", name: "John" }
   <- { success: true, isFree: true, token: "eyJ...", order: {...} }

Done! User is enrolled and has JWT token.
```

### Example 2: Paid Course with Coupon

```
1. GET /checkout/course/64def...
   -> Get course details (price: 2999)

2. POST /checkout/validate-coupon
   -> { code: "SAVE50", itemType: "course", itemId: "64def...", amount: 299900 }
   <- { valid: true, discountAmount: 149950, finalAmount: 149950 }

3. POST /checkout/course/64def.../request-otp
   -> { email: "user@example.com" }

4. POST /checkout/course/64def.../verify-otp
   -> { email: "user@example.com", code: "123456" }

5. POST /checkout/course/64def.../process-checkout
   -> { email: "user@example.com", name: "John", couponCode: "SAVE50", referralId: "AFF123" }
   <- { success: true, razorpayOrder: { id: "order_xxx", amount: 149950 }, couponUsageId: "..." }

6. [User completes Razorpay payment]

7. POST /checkout/course/64def.../verify-payment
   -> { razorpayOrderId: "...", razorpayPaymentId: "...", razorpaySignature: "...", userId: "...", couponUsageId: "..." }
   <- { success: true, token: "eyJ..." }

Done! User is enrolled with discount and referral tracked.
```

### Example 3: Service with Milestone Payments

```
1. GET /checkout/service/64ghi...
   -> Get service details (paymentTiming: "pay_before_milestone")

2. POST /checkout/service/64ghi.../init
   -> { email: "user@example.com" }

3. POST /checkout/service/64ghi.../verify-otp
   -> { email: "user@example.com", otp: "123456" }
   <- { needsProfile: true }

4. POST /checkout/service/64ghi.../update-profile
   -> { userId: "64user...", name: "John" }

5. POST /checkout/service/64ghi.../opt-in
   -> { userId: "64user...", referralId: "AFF123" }
   <- { optIn: { _id: "64optin..." }, token: "eyJ..." }

User is now opted-in. Pay for milestones as work progresses:

6. POST /services/opt-ins/64optin.../milestones/64mile1.../create-order
   Authorization: Bearer <token>
   <- { order: { id: "order_xxx", amount: 1000000 } }

7. [User completes Razorpay payment]

8. POST /services/opt-ins/64optin.../milestones/64mile1.../verify-payment
   -> { razorpayOrderId: "...", razorpayPaymentId: "...", razorpaySignature: "..." }
   <- { success: true, optIn: {...} }

Repeat steps 6-8 for each milestone.
```

### Example 4: Subscription Channel

```
1. GET /checkout/channel/64jkl...
   -> Get channel details (isSubscription: true, subscriptionPeriod: "monthly")

2. POST /checkout/channel/64jkl.../request-otp
3. POST /checkout/channel/64jkl.../verify-otp

4. POST /checkout/channel/64jkl.../process-checkout
   -> { email: "user@example.com", name: "John" }
   <- { success: true, isSubscription: true, razorpaySubscription: { id: "sub_xxx", shortUrl: "https://rzp.io/..." } }

5. [Redirect user to shortUrl for subscription payment]

6. [After redirect back] POST /checkout/channel/64jkl.../verify-subscription
   -> { razorpaySubscriptionId: "sub_xxx", userId: "64user..." }
   <- { success: true, subscription: { status: "active" }, token: "eyJ..." }

Done! User has active subscription.
```

---

## Notes for Mobile App Implementation

1. **OTP Auto-fill**: Consider using SMS Retriever API (Android) or automatic OTP detection for better UX

2. **Razorpay Mobile SDK**: Use Razorpay's native mobile SDKs instead of web checkout for better integration

3. **Deep Links**: Handle redirect URLs after subscription payment completion

4. **Token Storage**: Securely store JWT token after checkout for authenticated API calls

5. **Error Retry**: Implement retry logic for network failures during payment verification

6. **Offline Queue**: Queue checkout requests if offline and process when connection restored

7. **Referral Links**: Parse deep links to extract `referralId` from affiliate URLs

8. **Price Display**: Always fetch fresh item details before checkout to ensure accurate pricing

---

## API Endpoints Summary

| Endpoint Pattern | Method | Auth | Description |
|-----------------|--------|------|-------------|
| `/checkout/{type}/{id}` | GET | No | Get item details |
| `/checkout/{type}/{id}/request-otp` | POST | No | Send OTP |
| `/checkout/{type}/{id}/verify-otp` | POST | No | Verify OTP |
| `/checkout/{type}/{id}/process-checkout` | POST | No | Process checkout |
| `/checkout/{type}/{id}/verify-payment` | POST | No | Verify one-time payment |
| `/checkout/{type}/{id}/verify-subscription` | POST | No | Verify subscription |
| `/checkout/validate-coupon` | POST | No | Validate coupon |
| `/services/opt-ins/{id}/milestones/{id}/create-order` | POST | Yes | Create milestone payment order |
| `/services/opt-ins/{id}/milestones/{id}/verify-payment` | POST | Yes | Verify milestone payment |
| `/affiliate/my-affiliate-id` | GET | Yes | Get user's affiliate ID |
| `/affiliate/referrer-info` | GET | No | Get referrer info by affiliate ID |
| `/affiliate/stats` | GET | Yes | Get affiliate stats |
| `/affiliate/network` | GET | Yes | Get affiliate network tree |

Where `{type}` is one of: `product`, `course`, `workshop`, `channel`, `service`

---

## Frontend Page Structure

This section documents how checkout pages are structured in the web frontend for reference when building the mobile app.

### Checkout Page URLs

| Item Type | Frontend URL | Component |
|-----------|--------------|-----------|
| Product | `/checkout/product/[productId]` | `ProductCheckoutPage.tsx` |
| Course | `/checkout/course/[courseId]` | `CourseCheckoutPage.tsx` |
| Workshop | `/checkout/workshop/[workshopId]` | `WorkshopCheckoutPage.tsx` |
| Channel | `/checkout/channel/[channelId]` | `ChannelCheckoutPage.tsx` |
| Service | `/checkout/service/[serviceId]` | `ServiceCheckoutPage.tsx` |

### Affiliate Invite Pages

| Flow Type | Frontend URL | Component |
|-----------|--------------|-----------|
| Organization Invite | `/[orgSlug]?ref=[affiliateId]` | `OrgAffiliateInvite` |
| Channel-Specific Invite | `/[orgSlug]/[channelId]?ref=[affiliateId]` | `AffiliateInvite` |

### Referral ID Handling

All checkout pages accept a `ref` query parameter for affiliate tracking:

```
/checkout/product/64abc123?ref=AFF123XYZ
/checkout/course/64def456?ref=AFF123XYZ
/checkout/channel/64ghi789?ref=AFF123XYZ
```

The frontend extracts this parameter on mount:
```javascript
const searchParams = new URLSearchParams(window.location.search);
const ref = searchParams.get("ref");
if (ref) {
  setReferralId(ref);
}
```

---

## UI Flow States

### Common Checkout Steps

All checkout pages follow a unified step-based flow:

```typescript
type Step =
  | "email"          // Email input
  | "otp"            // OTP verification
  | "name"           // Profile name (if needsProfile: true)
  | "shipping"       // Shipping address (products only)
  | "processing"     // Processing checkout/payment
  | "already_member" // User already has access
  | "success";       // Checkout complete
```

### Service-Specific Steps

Services have a slightly different flow:

```typescript
type Step =
  | "email"         // Email input
  | "otp"           // OTP verification
  | "name"          // Profile name (if needsProfile: true)
  | "processing"    // Processing opt-in
  | "already_opted" // Already opted in to service
  | "success";      // Opt-in complete
```

### Affiliate Invite Steps

Organization affiliate invite flow:

```typescript
type ViewStep =
  | "initial"    // Show org info + "See Channels" button
  | "channels"   // Channel selection grid
  | "email"      // Email input
  | "otp"        // OTP verification
  | "details"    // Profile details (name + phone)
  | "processing" // Processing acceptance
```

Channel-specific affiliate invite flow:

```typescript
type Step =
  | "view"       // Show invite details + CTA button
  | "email"      // Email input
  | "otp"        // OTP verification
  | "details"    // Profile details (name + phone)
  | "processing" // Processing acceptance
  | "payment"    // Payment flow (for paid channels)
```

---

## UI Layout Patterns

### Split-Screen Checkout Layout

All checkout pages use a split-screen layout on desktop:

```
┌─────────────────────────────────────────────────────────┐
│                    Checkout Page                         │
├────────────────────────┬────────────────────────────────┤
│                        │                                │
│   LEFT PANEL (50%)     │    RIGHT PANEL (50%)           │
│                        │                                │
│   • Organization Logo  │    • Payment Details Card      │
│   • Item Name          │    • Form Steps:               │
│   • Price Display      │      - Email Input             │
│   • Description        │      - OTP Input               │
│   • Item Image         │      - Name Input              │
│   • Stats (chapters,   │      - Shipping (if needed)    │
│     duration, etc.)    │    • Coupon Input              │
│                        │    • Order Summary             │
│   Footer: Terms/       │    • Pay Button                │
│   Privacy links        │    • Security Badge            │
│                        │                                │
└────────────────────────┴────────────────────────────────┘
```

On mobile, this becomes a single column with the form at the top.

### Service Checkout Layout

Services use a grid layout:

```
┌─────────────────────────────────────────────────────────┐
│  Header: Organization Logo + Name                        │
├────────────────────────┬────────────────────────────────┤
│   SERVICE INFO         │    CHECKOUT FORM               │
│                        │                                │
│   • Cover Image/Icon   │    • Step-based Form           │
│   • Title + Desc       │      - Email                   │
│   • Quick Stats:       │      - OTP                     │
│     - Duration         │      - Name                    │
│     - Team Size        │                                │
│     - Milestones       │    • Trust Badges              │
│   • Total Price        │    • Payment Info Card         │
│   • Payment Timing     │      (Milestone-based)         │
│                        │                                │
│   MILESTONES LIST      │                                │
│   • Milestone 1        │                                │
│   • Milestone 2        │                                │
│   • ...                │                                │
│                        │                                │
│   FEATURES LIST        │                                │
│   • Feature 1          │                                │
│   • Feature 2          │                                │
│   • ...                │                                │
└────────────────────────┴────────────────────────────────┘
```

---

## UI Components Reference

### CouponInput Component

Reusable coupon input with validation:

```typescript
interface CouponInputProps {
  itemType: string;      // "product" | "course" | "channel" | "workshop"
  itemId: string;        // Item ID
  amount: number;        // Amount in paise (smallest currency unit)
  currency?: string;     // Default: "INR"
  onCouponApplied?: (coupon: AppliedCoupon) => void;
  onCouponRemoved?: () => void;
  orgId?: string;        // Optional for org-specific coupons
  userId?: string;       // Optional for per-user limits
  disabled?: boolean;
}

interface AppliedCoupon {
  code: string;
  discountValue: number;     // Percentage (e.g., 20 for 20%)
  discountAmount: number;    // Amount in paise
  finalAmount: number;       // Amount in paise after discount
  hasRazorpayOffer?: boolean;
}
```

**States:**
- **Input State**: Text field + "Apply" button
- **Loading State**: Spinner during validation
- **Error State**: Red text showing validation error
- **Success State**: Green badge showing discount details with "X" to remove

### OTP Input

6-digit OTP input with:
- Auto-focus on first digit
- Auto-advance on input
- Backspace to go back
- Paste support for full code
- Center-aligned, tracking-wide display

```typescript
// OTP input pattern
<Input
  type="text"
  value={otp}
  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
  placeholder="Enter 6-digit code"
  maxLength={6}
  className="text-center tracking-[0.5em] font-mono"
/>
```

### Price Display

Formatted price with original/discounted display:

```typescript
const formatPrice = (price: number, currency: string = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price);
};

// Display logic — `price` is the single source of truth (0 = free);
// discountedPrice was removed platform-wide.
const displayPrice = item?.price || 0;
```

### Shipping Address Form

For physical products that require shipping:

```typescript
interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}
```

Grid layout: 2 columns for city/state, postal/country pairs.

---

## Razorpay Integration Details

### Loading Razorpay SDK

```typescript
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};
```

### Razorpay Configuration

```typescript
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  amount: orderData.amount,           // In paise
  currency: orderData.currency,        // "INR"
  order_id: orderData.id,              // From backend
  name: organizationName,
  description: `Purchase: ${itemName}`,
  handler: async (response) => {
    // Verify payment
    await verifyPayment({
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
      userId
    });
  },
  modal: {
    ondismiss: () => {
      // Handle payment cancellation
      setStep("email");
      toast.info("Payment cancelled");
    },
  },
  theme: { color: "#FBD10D" },  // Brand yellow
  prefill: { name, email },
};

const rzp = new window.Razorpay(options);
rzp.open();
```

### Subscription Handling

For subscription products, redirect to Razorpay's hosted page:

```typescript
// Store data for verification after redirect
localStorage.setItem("checkout_user_id", userId);
localStorage.setItem("checkout_token", token);
localStorage.setItem("checkout_org_id", orgId);
localStorage.setItem("checkout_item_id", itemId);

// Redirect to Razorpay
window.location.href = razorpaySubscription.shortUrl;

// On return, check URL for subscription ID
const searchParams = new URLSearchParams(window.location.search);
const subscriptionId = searchParams.get("razorpay_subscription_id");

if (subscriptionId) {
  // Verify subscription
  await verifySubscription(subscriptionId, savedUserId);

  // Clean up localStorage
  localStorage.removeItem("checkout_user_id");
  // ...
}
```

---

## Token Storage & Auth

After successful checkout, save JWT token and org ID:

```typescript
import { saveToken, saveOrgId } from "@/lib/auth";

// On successful checkout
saveToken(data.token);
saveOrgId(data.orgId);

// Redirect to workspace
router.push("/workspace");
```

**Storage Keys (Web):**
- `garage_tok` - JWT token
- `garage_org_id` - Current organization ID

**Mobile App Recommendation:**
- Use secure storage (Keychain on iOS, EncryptedSharedPreferences on Android)
- Never store tokens in plain AsyncStorage

---

## Error Toast Patterns

Using `sonner` for toast notifications:

```typescript
import { toast } from "sonner";

// Success
toast.success("OTP sent to your email");
toast.success("Purchase successful!");
toast.success("Enrolled successfully!");

// Error
toast.error("Please enter your email");
toast.error("Invalid OTP");
toast.error("Payment verification failed");

// Info
toast.info("Payment cancelled");
```

---

## Affiliate Invite Page Details

### Organization-Level Invite

**URL:** `/{orgSlug}?ref={affiliateId}`

**Flow:**
1. Fetch invite details: `GET /affiliate/invite-details?orgSlug={orgSlug}&affiliateId={affiliateId}`
2. Display organization info + affiliate (inviter) info
3. "See Channels" button → fetch channels
4. User selects a channel
5. Email → OTP → Profile (if needed) → Accept invite
6. Redirect to workspace

**API Endpoints Used:**
- `GET /affiliate/invite-details`
- `GET /affiliate/org-channels/{storeId}`
- `POST /affiliate/request-otp`
- `POST /affiliate/check-user`
- `POST /affiliate/accept-invite`

### Channel-Specific Invite

**URL:** `/{orgSlug}/{channelId}?ref={affiliateId}`

**Flow:**
1. Fetch invite details with channel: `GET /affiliate/invite-details?orgSlug={orgSlug}&affiliateId={affiliateId}&channelId={channelId}`
2. Display organization + affiliate + channel info
3. For paid channels, show price + "Join & Pay" button
4. Email → OTP → Profile (if needed)
5. For free channels: Accept invite directly
6. For paid channels: Trigger Razorpay payment flow
7. Redirect to workspace

**API Endpoints Used:**
- `GET /affiliate/invite-details`
- `POST /affiliate/request-otp`
- `POST /affiliate/check-user`
- `POST /affiliate/accept-invite`
- `POST /feed/channels/{channelId}/create-order` (for paid channels)
- `POST /feed/channels/{channelId}/verify-payment` (for paid channels)

---

## Mobile App Implementation Checklist

### Screens to Build

- [ ] Product Checkout Screen
- [ ] Course Checkout Screen
- [ ] Workshop Checkout Screen
- [ ] Channel Checkout Screen
- [ ] Service Checkout Screen
- [ ] Organization Affiliate Invite Screen
- [ ] Channel Affiliate Invite Screen

### Reusable Components

- [ ] OTP Input Component (6-digit)
- [ ] Coupon Input Component
- [ ] Price Display Component (with original/discounted)
- [ ] Shipping Address Form
- [ ] Order Summary Card
- [ ] Processing/Loading State
- [ ] Success State with Redirect
- [ ] Error State with Retry

### Integration Points

- [ ] Razorpay Mobile SDK (Android/iOS)
- [ ] Deep Link Handler for `ref` parameter
- [ ] Deep Link Handler for subscription return
- [ ] Secure Token Storage
- [ ] Toast/Snackbar Notifications

### State Management

- [ ] Form state (email, otp, name, etc.)
- [ ] Step/Flow state
- [ ] Loading states per operation
- [ ] Error handling
- [ ] Applied coupon state
- [ ] Referral ID storage

### UX Considerations

- [ ] Keyboard handling (auto-dismiss, next field)
- [ ] OTP auto-fill from SMS
- [ ] Loading indicators during API calls
- [ ] Disable buttons during processing
- [ ] Back navigation handling
- [ ] Network error recovery
