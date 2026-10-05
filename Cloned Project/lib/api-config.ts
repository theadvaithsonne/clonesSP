// Simple API configuration - just the base URL
export const API_CONFIG = {
  // External API base URL - change this to switch environments
  // EXTERNAL_BASE_URL: "https://uatapi.garage.app/api",
  // EXTERNAL_BASE_URL: "https://test.garage.app/api",
  // EXTERNAL_BASE_URL: "http://localhost:3001/api",
  EXTERNAL_BASE_URL: "https://uatapi.garage.app/api",
  // Internal API base URL (for Next.js API routes)
  INTERNAL_BASE_URL: "/api",
};

// Helper function to build full external API URLs
export const buildExternalUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_CONFIG.EXTERNAL_BASE_URL}/${cleanEndpoint}`;
};

// Helper function to build internal API URLs
export const buildInternalUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_CONFIG.INTERNAL_BASE_URL}/${cleanEndpoint}`;
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
  RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504, 0], // 0 for network errors
};
