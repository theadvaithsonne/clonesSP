import Cookies from "js-cookie";
import {
  API_CONFIG,
  buildExternalUrl,
  RATE_LIMIT_CONFIG,
} from "@/lib/api-config";
import { jwtDecode } from "jwt-decode";
// Base API configuration
const API_BASE_URL = "/api";
interface JwtPayload {
  // Adjust these fields according to YOUR actual JWT payload
  sub?: string; // user ids
  name?: string;
  email?: string;
  role?: string;
  exp?: number;
  orgId?: string;
  iat?: number;
  userId?: string;
  // ... add any custom claims like garageId, permissions, etc.
  [key: string]: any;
}
// Calculated exponential backoff delay
function calculateBackoffDelay(attempt: number): number {
  const delay =
    RATE_LIMIT_CONFIG.BASE_DELAY *
    Math.pow(RATE_LIMIT_CONFIG.BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, RATE_LIMIT_CONFIG.MAX_DELAY);
}

// Check if error is retryable.
function isRetryableError(status: number): boolean {
  return RATE_LIMIT_CONFIG.RETRYABLE_STATUS_CODES.includes(status);
}

// Utility function for authenticated API calls with retry logic
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  retryAttempt: number = 0,
): Promise<Response> => {
  // Try to get token from localStorage/cookies. Prefer explicit auth-token,
  // but fall back to garage_tok so legacy flows still work.
  let authToken: any = null;
  const userData =
    typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;

  // Check if we're currently impersonating someone
  let isImpersonating = false;
  if (userData) {
    try {
      const parsedUserData = jwtDecode<JwtPayload>(userData);
      isImpersonating = parsedUserData.isImpersonated === true;
    } catch (e) {
      console.error("Error parsing user-data:", e);
    }
  }

  if (isImpersonating) {
    // During impersonation, prioritize cookie over localStorage
    // The cookie contains the impersonated user's token
    authToken = Cookies.get("auth-token");
    console.log("🎭 Impersonation detected - using cookie token");
  } else {
    // Normal operation: check auth-token in localStorage first (cross-origin)
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("auth-token");
    }

    // Fallback to cookies if localStorage doesn't have auth-token
    if (!authToken) {
      authToken = Cookies.get("auth-token");
    }

    // FINAL fallback: use garage_tok JWT directly if present
    if (!authToken && userData) {
      authToken = userData;
      console.log("🪪 Falling back to garage_tok for Authorization header");
    }
  }

  // Set up headers - if we have a token, use Bearer auth
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // IMPORTANT: For FormData requests, let the browser set multipart boundary.
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }

  // Add Authorization header if we have a token
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
    console.log("🔐 Using Bearer token for API call");
  } else if (userData) {
    // If we don't have auth-token but have user-data, we might be in a cross-origin scenario
    // The request will still be sent with credentials: 'include' to try httpOnly cookies
    console.log(
      "🔍 No auth-token cookie found, relying on httpOnly cookies for authentication",
    );
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      mode: "cors", // Explicitly set CORS mode
    });

    // Global auth expiry detection.
    try {
      const authCheckClone = response.clone();
      const text = await authCheckClone.text();
      const lower = (text || "").toLowerCase();
      const authTextIndicatesExpiry =
        lower.includes("expired token") ||
        lower.includes("token expired") ||
        lower.includes("jwt expired");

      // Only treat as expired if the response is actually an error.
      if (
        authTextIndicatesExpiry &&
        (!response.ok || response.status === 401 || response.status === 403)
      ) {
        try {
          Cookies.remove("auth-token");
          Cookies.remove("user-data");
          Cookies.remove("garage_tok");
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-token");
            localStorage.removeItem("garage_tok");
            localStorage.removeItem("user-data");
            sessionStorage.clear();
          }
        } catch (e) {
          console.error("Error while clearing auth storage on auth expiry:", e);
        }
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Authentication expired. Please log in again.");
      }
    } catch {
      // Ignore failures reading body for auth check
    }

    // Handle 429 Too Many Requests with retry logic
    if (
      response.status === 429 &&
      retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES
    ) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter
        ? parseInt(retryAfter) * 1000
        : calculateBackoffDelay(retryAttempt);

      console.log(
        `Rate limited (429). Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return authenticatedFetch(url, options, retryAttempt + 1);
    }

    // Handle other retryable errors
    if (
      isRetryableError(response.status) &&
      retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES
    ) {
      const delay = calculateBackoffDelay(retryAttempt);
      console.log(
        `Server error (${response.status}). Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return authenticatedFetch(url, options, retryAttempt + 1);
    }

    if (!response.ok) {
      console.error(
        `API call failed: ${url}`,
        response.status,
        response.statusText,
      );

      if (response.status === 401) {
        // Authentication failed - clear any client-side cookies and redirect to login
        try {
          Cookies.remove("auth-token");
          Cookies.remove("user-data");
          Cookies.remove("garage_tok");
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-token");
            localStorage.removeItem("garage_tok");
            localStorage.removeItem("user-data");
            sessionStorage.clear();
          }
        } catch (e) {
          console.error("Error while clearing auth storage on 401:", e);
        }
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Authentication expired. Please log in again.");
      }

      let errorMessage = `API call failed: ${response.status} ${response.statusText}`;
      try {
        const errorClone = response.clone();
        const contentType = errorClone.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const errorData = await errorClone.json();
          errorMessage =
            errorData?.message ||
            errorData?.error ||
            errorData?.details?.message ||
            errorData?.errors?.[0]?.message ||
            errorMessage;
        } else {
          const errorText = (await errorClone.text())?.trim();
          if (errorText) {
            errorMessage = errorText;
          }
        }
      } catch {
        // Keep default status message if error body is unreadable.
      }

      throw new Error(errorMessage);
    }

    return response;
  } catch (error) {
    // Handle network errors with retry logic
    if (retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES) {
      const delay = calculateBackoffDelay(retryAttempt);
      console.log(
        `Network error. Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return authenticatedFetch(url, options, retryAttempt + 1);
    }

    throw error;
  }
};

// Enhanced fetch function with retry logic for non-authenticated calls
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryAttempt: number = 0,
): Promise<Response> => {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
    });

    // Handle 429 Too Many Requests with retry logic
    if (
      response.status === 429 &&
      retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES
    ) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter
        ? parseInt(retryAfter) * 1000
        : calculateBackoffDelay(retryAttempt);

      console.log(
        `Rate limited (429). Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryAttempt + 1);
    }

    // Handle other retryable errors
    if (
      isRetryableError(response.status) &&
      retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES
    ) {
      const delay = calculateBackoffDelay(retryAttempt);
      console.log(
        `Server error (${response.status}). Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryAttempt + 1);
    }

    return response;
  } catch (error) {
    // Handle network errors with retry logic
    if (retryAttempt < RATE_LIMIT_CONFIG.MAX_RETRIES) {
      const delay = calculateBackoffDelay(retryAttempt);
      console.log(
        `Network error. Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${RATE_LIMIT_CONFIG.MAX_RETRIES})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryAttempt + 1);
    }

    throw error;
  }
};

// Simple external API fetch function - always tries authentication first
export const externalFetch = async (
  endpoint: string,
  options: RequestInit = {},
  retryAttempt: number = 0,
): Promise<Response> => {
  const fullUrl = buildExternalUrl(endpoint);

  // Always try authenticated fetch first (it will use httpOnly cookie if no client-side token)
  try {
    return await authenticatedFetch(fullUrl, options, retryAttempt);
  } catch (error) {
    // If authentication fails, fall back to non-authenticated request
    if (
      error instanceof Error &&
      error.message.includes("Authentication expired")
    ) {
      throw error; // Re-throw auth errors to trigger login redirect
    }
    return fetchWithRetry(fullUrl, options, retryAttempt);
  }
};

// Utility function to get user data from cookies
export const getUserData = () => {
  const userData = localStorage.getItem("garage_tok");
  if (!userData) return null;

  try {
    return jwtDecode<JwtPayload>(userData);
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
};

// Utility function to check if user is authenticated
export const isAuthenticated = () => {
  let authToken: any = null;
  const userData = localStorage.getItem("garage_tok");

  // Check if we're currently impersonating someone
  let isImpersonating = false;
  if (userData) {
    try {
      const parsedUserData = jwtDecode<JwtPayload>(userData);
      isImpersonating = parsedUserData.isImpersonated === true;
    } catch (e) {
      console.error("Error parsing user-data:", e);
    }
  }

  if (isImpersonating) {
    // During impersonation, prioritize cookie over localStorage
    authToken = Cookies.get("auth-token");
  } else {
    // Check localStorage first (works for cross-origin)
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("auth-token");
    }

    // Fallback to cookies
    if (!authToken) {
      authToken = Cookies.get("auth-token");
    }
  }

  // For external API setup, we consider user authenticated if we have either:
  // 1. auth-token (from localStorage or cookie)
  // 2. user-data cookie (fallback for cross-origin issues)
  return !!(authToken || userData);
};

// Enhanced API response handler
export const handleApiResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
      }
    }

    // Some legacy endpoints incorrectly use "Expired token" messages even when the main
    // auth token is still valid (and status is not 401/403). To avoid confusing users,
    // mask those specific messages unless this is a real auth failure.
    const lower = String(errorMessage).toLowerCase();
    const looksLikeTokenExpiry =
      lower.includes("expired token") ||
      lower.includes("token expired") ||
      lower.includes("jwt expired");
    if (
      looksLikeTokenExpiry &&
      response.status !== 401 &&
      response.status !== 403
    ) {
      errorMessage =
        "Something went wrong while processing the request. Please try again.";
    }

    throw new Error(errorMessage);
  }

  if (isJson) {
    return response.json();
  }

  return response.text() as T;
};

// User data interface
export interface UserData {
  name: string;
  role: string;
  email: string;
  id: string;
  employeeId?: string | null;
  clientId?: string | null;
  organizationId: string;
  startupbrokerRole?: string | null;
  phoneNumber?: string | null;
}

// Types for referrer functionality
export interface ReferrerUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  memberSince?: string;
}

// Referrer/Affiliate search and connection APIs
export const referrerApi = {
  search: async (query: string): Promise<ReferrerUser[]> => {
    const response = await fetchWithRetry(
      `/api/referrers/search?q=${encodeURIComponent(query)}`,
    );
    return handleApiResponse<ReferrerUser[]>(response);
  },

  getById: async (
    id: string,
  ): Promise<{ success: boolean; data?: ReferrerUser }> => {
    try {
      // const response = await fetchWithRetry(
      //   `/api/public/users?id=${encodeURIComponent(id)}`
      // );
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;

      // if (!orgId) {
      //   toast("orgId not found in localStorage");

      // }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/organizations/${orgId}/users?id=${encodeURIComponent(id)}`,
        {
          method: "GET",
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false };
      }

      // Transform the response to match ReferrerUser interface
      const transformedData: ReferrerUser = {
        id: result.data._id,
        name: result.data.name,
        email: result.data.email,
        role: result.data.role,
        phoneNumber: result.data.phoneNumber,
        address: result.data.address,
        city: result.data.city,
        state: result.data.state,
        memberSince: result.data.memberSince,
      };

      return { success: true, data: transformedData };
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return { success: false };
    }
  },

  searchByEmail: async (
    email: string,
  ): Promise<{ success: boolean; data?: ReferrerUser }> => {
    try {
      const orgId =
        typeof window !== "undefined"
          ? localStorage.getItem("garage_org_id")
          : null;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/organizations/${orgId}/users?email=${encodeURIComponent(email)}`,
        {
          method: "GET",
        },
      );

      // const response = await fetchWithRetry(
      //   `/api/public/users?email=${encodeURIComponent(email)}`
      // );
      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false };
      }

      // Transform the response to match ReferrerUser interface
      const transformedData: ReferrerUser = {
        id: result.data._id,
        name: result.data.name,
        email: result.data.email,
        role: result.data.role,
        phoneNumber: result.data.phoneNumber,
        address: result.data.address,
        city: result.data.city,
        state: result.data.state,
        memberSince: result.data.memberSince,
      };

      return { success: true, data: transformedData };
    } catch (error) {
      console.error("Error searching user by email:", error);
      return { success: false };
    }
  },

  connect: async (
    referrerId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await authenticatedFetch(`/api/referrers/connect`, {
      method: "POST",
      body: JSON.stringify({ referrerId }),
    });
    return handleApiResponse<{ success: boolean; message: string }>(response);
  },

  getConnections: async (): Promise<ReferrerUser[]> => {
    const response = await authenticatedFetch("/api/referrers/connections");
    return handleApiResponse<ReferrerUser[]>(response);
  },
};

// Program type clone API
export const programTypeCloneApi = {
  getProgramTypeClone: async (
    email: string,
    programTypeId: string,
  ): Promise<any> => {
    try {
      const response = await fetchWithRetry(
        `https://startupbrokers.marketsverse.com/api/getprogramtypeclone?email=${encodeURIComponent(email)}&programtypeid=${encodeURIComponent(programTypeId)}`,
      );
      return handleApiResponse<any>(response);
    } catch (error) {
      console.error("Error fetching program type clone:", error);
      throw error;
    }
  },
};
