# `lib/revenue-network-api.ts`

> Revenue Network API Client - Connects to customer-app public APIs

**Kind:** frontend library · **Lines:** 771

<!-- docgen:auto -->

## Purpose
Revenue Network API Client - Connects to customer-app public APIs

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Channel` | interface |  | 15 |
| `Post` | interface |  | 29 |
| `Workshop` | interface |  | 53 |
| `CourseChapter` | interface |  | 81 |
| `CourseSection` | interface |  | 92 |
| `Course` | interface |  | 100 |
| `Product` | interface |  | 126 |
| `OrderCustomer` | interface |  | 154 |
| `DigitalAsset` | interface |  | 161 |
| `DigitalLink` | interface |  | 167 |
| `OrderItem` | interface |  | 173 |
| `OrderFulfillment` | interface |  | 184 |
| `Order` | interface |  | 198 |
| `OrdersResponse` | interface |  | 217 |
| `getStoreChannels` | function | `async getStoreChannels(storeId: string): Promise<{ channels: Channel[] }>` | 250 |
| `getStorePosts` | function | `async getStorePosts(storeId: string, options?: { channelId?: string; customerId?: string; custom…): Promise<{ posts: Post[]; pagination: { total: num…` | 254 |
| `getStoreWorkshops` | function | `async getStoreWorkshops(storeId: string, customerId?: string): Promise<{ workshops: Workshop[] }>` | 285 |
| `enrollInFreeWorkshop` | function | `async enrollInFreeWorkshop(storeId: string, workshopId: string, customerData: { customerId?: string; customerEmail: string;…): Promise<{ success: boolean; message: string; alre…` | 292 |
| `getStoreCourses` | function | `async getStoreCourses(storeId: string, customerId?: string, customerEmail?: string): Promise<{ courses: Course[] }>` | 322 |
| `getCourseDetail` | function | `async getCourseDetail(storeId: string, courseId: string, customerId?: string, customerEmail?: string): Promise<{ course: Course }>` | 336 |
| `getStoreProducts` | function | `async getStoreProducts(storeId: string): Promise<{ products: Product[] }>` | 351 |
| `getStoreOrders` | function | `async getStoreOrders(storeId: string, options?: { page?: number; limit?: number; status?: 'pendin…): Promise<OrdersResponse>` | 355 |
| `createPost` | function | `async createPost(data: { storeId: string; content: string; channelIds: strin…): Promise<{ post: Post }>` | 383 |
| `updatePost` | function | `async updatePost(postId: string, data: { content?: string; tags?: string[]; attachments?: { …): Promise<{ post: Post }>` | 415 |
| `deletePost` | function | `async deletePost(postId: string, authorData: { authorId?: string; authorEmail?: string }): Promise<{ success: boolean }>` | 446 |
| `likePost` | function | `async likePost(storeId: string, postId: string, customerData?: { customerId: string; customerName: string; …): Promise<{ success: boolean }>` | 467 |
| `commentOnPost` | function | `async commentOnPost(postId: string, data: { content: string; customerId?: string; customerName?…): Promise<{ comment: any }>` | 489 |
| `getPostComments` | function | `async getPostComments(postId: string): Promise<{ comments: any[]; total: number }>` | 510 |
| `subscribeToChannel` | function | `async subscribeToChannel(data: { channelId: string; customerId?: string; // Optional…): Promise<{ message: string; subscription: any }>` | 526 |
| `getCustomerSubscriptions` | function | `async getCustomerSubscriptions(customerIdOrEmail: string, storeId?: string): Promise<{ subscriptions: any[]; store?: any; stor…` | 553 |
| `SubscribedChannel` | interface |  | 581 |
| `getSubscribedChannels` | function | `async getSubscribedChannels(customerIdOrEmail: string, storeId: string): Promise<{ channels: SubscribedChannel[] }>` | 590 |
| `WalletData` | interface |  | 624 |
| `WalletTransaction` | interface |  | 631 |
| `WalletResponse` | interface |  | 649 |
| `getWallet` | function | `async getWallet(token: string, walletType: 'store' \| 'commission', storeId?: string): Promise<WalletResponse>` | 655 |
| `transferCredits` | function | `async transferCredits(token: string, data: { storeId?: string; toUserId: string; amount: number;…): Promise<{ success: boolean; newBalance: number }>` | 669 |
| `StoreUser` | interface |  | 685 |
| `getStoreUsers` | function | `async getStoreUsers(token: string, storeId: string, search?: string): Promise<{ users: StoreUser[] }>` | 694 |
| `AffiliateNode` | interface |  | 706 |
| `AffiliateStats` | interface |  | 721 |
| `getAffiliateNetwork` | function | `async getAffiliateNetwork(token: string, storeId: string): Promise<{ network: AffiliateNode \| null }>` | 731 |
| `getAffiliateStats` | function | `async getAffiliateStats(token: string, storeId: string): Promise<AffiliateStats>` | 752 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/revenue-network/affiliate/network?storeId=${storeId}` (L736)
  - `GET /api/revenue-network/affiliate/stats?storeId=${storeId}` (L757)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${CUSTOMER_APP_URL}${endpoint}` (L235)
  - `POST ${CUSTOMER_APP_URL}/api/public/stores/${storeId}/workshops/${workshopId}/enroll` (L301)
  - `POST ${CUSTOMER_APP_URL}/api/public/stores/${data.storeId}/posts/create` (L398)
  - `PUT ${CUSTOMER_APP_URL}/api/public/posts/${postId}` (L429)
  - `DELETE ${CUSTOMER_APP_URL}/api/public/posts/${postId}` (L450)
  - `POST ${CUSTOMER_APP_URL}/api/public/posts/${postId}/like` (L472)
  - `POST ${CUSTOMER_APP_URL}/api/public/posts/${postId}/comments` (L493)
  - `GET ${CUSTOMER_APP_URL}/api/public/posts/${postId}/comments` (L511)
  - `POST ${CUSTOMER_APP_URL}/api/public/channels/${data.channelId}/subscribe` (L532)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_CUSTOMER_APP_URL`, `NEXT_PUBLIC_EXTERNAL_API_KEY`, `NODE_ENV`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/AffiliatePageNew.tsx`
- `components/dashboard/ImageModal.tsx`
