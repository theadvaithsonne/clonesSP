// Revenue Network API Client - Connects to customer-app public APIs

const CUSTOMER_APP_URL = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || 'http://localhost:3001';
const EXTERNAL_API_KEY = process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || '';

// Warn if API key is missing (development only)
if (typeof window !== 'undefined' && !EXTERNAL_API_KEY && process.env.NODE_ENV === 'development') {
  console.warn(
    '⚠️ NEXT_PUBLIC_EXTERNAL_API_KEY is not set! Revenue Network APIs will fail with 401 errors.\n' +
    'Add this to your .env.local file:\n' +
    'NEXT_PUBLIC_EXTERNAL_API_KEY=your_api_key_here'
  );
}

export interface Channel {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  coverImage?: string;
  shareLink?: string;
  isFree: boolean;
  isSubscription: boolean;
  allowPayWhatYouWant: boolean;
  createdAt: Date;
}

export interface Post {
  _id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string | null;
  authorType?: 'admin' | 'customer';
  storeId?: string;
  channelIds: { _id: string; title: string }[];
  tags?: string[];
  attachments?: {
    type: 'image' | 'video' | 'document' | 'audio';
    url: string;
    name: string;
  }[];
  likes: number;
  hasLiked?: boolean;
  comments: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workshop {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date: Date;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingPlatform: 'zoom' | 'google-meet' | 'custom';
  meetingUrl?: string;
  maxParticipants?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registeredParticipantsCount: number;
  availableSpots: number | null;
  // Channel association
  channelIds?: { _id: string; title: string }[];
  // Pricing fields
  price?: number;
  currency?: string;
  isFree?: boolean;
  isPaid?: boolean;
  // Registration status (when customerId is provided)
  isRegistered?: boolean;
  hasPaid?: boolean;
  createdAt: Date;
}

export interface CourseChapter {
  _id: string;
  title: string;
  order: number;
  contentType?: 'video' | 'article' | 'text' | 'link';
  content?: string;
  videoUrl?: string;
  linkUrl?: string;
  duration?: number;
}

export interface CourseSection {
  _id: string;
  title: string;
  order: number;
  chaptersCount?: number;
  chapters?: CourseChapter[];
}

export interface Course {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  status: 'draft' | 'published' | 'archived';
  totalDuration: number;
  totalChapters: number;
  enrolledStudentsCount: number;
  // Channel association
  channelIds?: { _id: string; title: string }[];
  // Pricing fields
  price?: number;
  currency?: string;
  isFree?: boolean;
  isPaid?: boolean;
  // Enrollment status (when customerId is provided)
  enrollmentStatus?: 'enrolled' | 'completed' | 'available';
  progress?: number;
  completedChapters?: string[];
  sections?: CourseSection[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  trackQuantity: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  images: string[];
  categoryId?: string;
  categoryName?: string;
  channelIds?: { _id: string; title: string }[];
  tags?: string[];
  isDigital: boolean;
  requiresShipping: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
}

export interface OrderCustomer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface DigitalAsset {
  name: string;
  url: string;
  type: string;
}

export interface DigitalLink {
  label: string;
  url: string;
  description?: string;
}

export interface OrderItem {
  type: 'product' | 'course';
  id: string;
  name: string;
  image?: string;
  isDigital?: boolean;
  requiresShipping?: boolean;
  digitalAssets?: DigitalAsset[];
  digitalLinks?: DigitalLink[];
}

export interface OrderFulfillment {
  status: 'pending_fulfillment' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface Order {
  _id: string;
  orderNumber: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  itemType: 'product' | 'course';
  itemId: string;
  description?: string;
  quantity: number;
  createdAt: Date;
  updatedAt?: Date;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  customer: OrderCustomer | null;
  item: OrderItem | null;
  fulfillment: OrderFulfillment | null;
}

export interface OrdersResponse {
  orders: Order[];
  store: {
    _id: string;
    name: string;
    slug: string;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

async function fetchFromCustomerApp<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${CUSTOMER_APP_URL}${endpoint}`, {
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getStoreChannels(storeId: string): Promise<{ channels: Channel[] }> {
  return fetchFromCustomerApp(`/api/public/stores/${storeId}/channels`);
}

export async function getStorePosts(
  storeId: string,
  options?: {
    channelId?: string;
    customerId?: string;
    customerEmail?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  posts: Post[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> {
  const params = new URLSearchParams();
  if (options?.channelId) params.append('channelId', options.channelId);
  if (options?.customerId) params.append('customerId', options.customerId);
  if (options?.customerEmail) params.append('customerEmail', options.customerEmail);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const query = params.toString();
  const url = `/api/public/stores/${storeId}/posts${query ? `?${query}` : ''}`;

  return fetchFromCustomerApp(url);
}

export async function getStoreWorkshops(storeId: string, customerId?: string): Promise<{ workshops: Workshop[] }> {
  const url = customerId
    ? `/api/public/stores/${storeId}/workshops?customerId=${customerId}`
    : `/api/public/stores/${storeId}/workshops`;
  return fetchFromCustomerApp(url);
}

export async function enrollInFreeWorkshop(
  storeId: string,
  workshopId: string,
  customerData: {
    customerId?: string;
    customerEmail: string;
    customerName?: string;
  }
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  const response = await fetch(
    `${CUSTOMER_APP_URL}/api/public/stores/${storeId}/workshops/${workshopId}/enroll`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EXTERNAL_API_KEY,
      },
      body: JSON.stringify(customerData),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to enroll in workshop');
  }

  return data;
}

export async function getStoreCourses(
  storeId: string,
  customerId?: string,
  customerEmail?: string
): Promise<{ courses: Course[] }> {
  const params = new URLSearchParams();
  if (customerId) params.append('customerId', customerId);
  if (customerEmail) params.append('customerEmail', customerEmail);

  const query = params.toString();
  const url = `/api/public/stores/${storeId}/courses${query ? `?${query}` : ''}`;
  return fetchFromCustomerApp(url);
}

export async function getCourseDetail(
  storeId: string,
  courseId: string,
  customerId?: string,
  customerEmail?: string
): Promise<{ course: Course }> {
  const params = new URLSearchParams();
  if (customerId) params.append('customerId', customerId);
  if (customerEmail) params.append('customerEmail', customerEmail);

  const query = params.toString();
  const url = `/api/public/stores/${storeId}/courses/${courseId}${query ? `?${query}` : ''}`;
  return fetchFromCustomerApp(url);
}

export async function getStoreProducts(storeId: string): Promise<{ products: Product[] }> {
  return fetchFromCustomerApp(`/api/public/stores/${storeId}/products`);
}

export async function getStoreOrders(
  storeId: string,
  options?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'completed' | 'all';
    type?: 'product' | 'course' | 'all';
    search?: string;
    customerId?: string;
    customerEmail?: string;
  }
): Promise<OrdersResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.status) params.append('status', options.status);
  if (options?.type) params.append('type', options.type);
  if (options?.search) params.append('search', options.search);
  if (options?.customerId) params.append('customerId', options.customerId);
  if (options?.customerEmail) params.append('customerEmail', options.customerEmail);

  const query = params.toString();
  const url = `/api/public/stores/${storeId}/orders${query ? `?${query}` : ''}`;

  return fetchFromCustomerApp(url);
}

// Post interactions
export async function createPost(data: {
  storeId: string;
  content: string;
  channelIds: string[];
  tags?: string[];
  attachments?: {
    type: 'image' | 'video' | 'document';
    url: string;
    name: string;
  }[];
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  authorType?: 'admin' | 'customer';
}): Promise<{ post: Post }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/stores/${data.storeId}/posts/create`, {
    method: 'POST',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function updatePost(
  postId: string,
  data: {
    content?: string;
    tags?: string[];
    attachments?: {
      type: 'image' | 'video' | 'document';
      url: string;
      name: string;
    }[];
    authorId?: string;
    authorEmail?: string;
  }
): Promise<{ post: Post }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function deletePost(
  postId: string,
  authorData: { authorId?: string; authorEmail?: string }
): Promise<{ success: boolean }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(authorData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function likePost(
  storeId: string,
  postId: string,
  customerData?: { customerId: string; customerName: string; customerEmail?: string }
): Promise<{ success: boolean }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/posts/${postId}/like`, {
    method: 'POST',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData || {}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function commentOnPost(
  postId: string,
  data: { content: string; customerId?: string; customerName?: string; customerEmail?: string }
): Promise<{ comment: any }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getPostComments(postId: string): Promise<{ comments: any[]; total: number }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/posts/${postId}/comments`, {
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function subscribeToChannel(data: {
  channelId: string;
  customerId?: string;  // Optional - can use email lookup instead
  customerName: string;
  customerEmail: string;
}): Promise<{ message: string; subscription: any }> {
  const response = await fetch(`${CUSTOMER_APP_URL}/api/public/channels/${data.channelId}/subscribe`, {
    method: 'POST',
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(data.customerId && { customerId: data.customerId }),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getCustomerSubscriptions(
  customerIdOrEmail: string,  // Can be customerId or email
  storeId?: string
): Promise<{ subscriptions: any[]; store?: any; stores?: any[] }> {
  // URL encode email if it contains @
  const encodedId = customerIdOrEmail.includes('@')
    ? encodeURIComponent(customerIdOrEmail)
    : customerIdOrEmail;
  const url = storeId
    ? `${CUSTOMER_APP_URL}/api/public/customers/${encodedId}/subscriptions?storeId=${storeId}`
    : `${CUSTOMER_APP_URL}/api/public/customers/${encodedId}/subscriptions`;

  const response = await fetch(url, {
    headers: {
      'x-api-key': EXTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Simplified interface for subscribed channels
export interface SubscribedChannel {
  channelId: string;
  channelTitle: string;
  status: string;
  paymentCycle?: string;
  joinedAt: Date;
}

// Get channels the customer is subscribed to for a specific store
export async function getSubscribedChannels(
  customerIdOrEmail: string,  // Can be customerId or email
  storeId: string
): Promise<{ channels: SubscribedChannel[] }> {
  const data = await getCustomerSubscriptions(customerIdOrEmail, storeId);
  return { channels: data.subscriptions || [] };
}

// =============== Wallet & Affiliate APIs (Authenticated) ===============

// Helper for authenticated requests to customer-app
async function fetchAuthenticatedFromCustomerApp<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${CUSTOMER_APP_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Wallet interfaces
export interface WalletData {
  _id: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

export interface WalletTransaction {
  _id: string;
  amount: number;
  type: 'transfer' | 'credit' | 'debit' | 'load' | 'withdraw';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  isOutgoing?: boolean;
  isIncoming?: boolean;
  isCredit?: boolean;
  isDebit?: boolean;
  otherUser?: {
    _id: string;
    name: string;
    email: string;
  } | null;
}

export interface WalletResponse {
  wallet: WalletData;
  recentTransactions: WalletTransaction[];
}

// Get wallet data (store or commission wallet)
export async function getWallet(
  token: string,
  walletType: 'store' | 'commission',
  storeId?: string
): Promise<WalletResponse> {
  const params = new URLSearchParams({ walletType });
  if (walletType === 'store' && storeId) {
    params.append('storeId', storeId);
  }

  return fetchAuthenticatedFromCustomerApp(`/api/wallet?${params.toString()}`, token);
}

// Transfer credits to another user
export async function transferCredits(
  token: string,
  data: {
    storeId?: string;
    toUserId: string;
    amount: number;
    description?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  return fetchAuthenticatedFromCustomerApp('/api/wallet/transfer', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get store users for transfer
export interface StoreUser {
  _id: string;
  name: string;
  email: string;
  userType: 'admin' | 'customer';
  avatar?: string | null;
  joinedAt: string;
}

export async function getStoreUsers(
  token: string,
  storeId: string,
  search?: string
): Promise<{ users: StoreUser[] }> {
  const params = new URLSearchParams({ storeId });
  if (search) params.append('search', search);

  return fetchAuthenticatedFromCustomerApp(`/api/wallet/store-users?${params.toString()}`, token);
}

// Affiliate interfaces
export interface AffiliateNode {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  level: number;
  totalReferrals: number;
  directReferrals: number;
  status: 'active' | 'inactive';
  avatar?: string;
  children?: AffiliateNode[];
  userType?: 'admin' | 'customer';
  earnings?: number;
}

export interface AffiliateStats {
  totalReferrals: number;
  directReferrals: number;
  activeReferrals: number;
  monthlyEarnings: number;
  networkDepth: number;
  activeLinks?: number;
}

// Get affiliate network tree
export async function getAffiliateNetwork(
  token: string,
  storeId: string
): Promise<{ network: AffiliateNode | null }> {
  // Use garage app proxy instead of calling customer-app directly
  const response = await fetch(`/api/revenue-network/affiliate/network?storeId=${storeId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch affiliate network');
  }

  return response.json();
}

// Get affiliate stats
export async function getAffiliateStats(
  token: string,
  storeId: string
): Promise<AffiliateStats> {
  // Use garage app proxy instead of calling customer-app directly
  const response = await fetch(`/api/revenue-network/affiliate/stats?storeId=${storeId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch affiliate stats');
  }

  return response.json();
}
