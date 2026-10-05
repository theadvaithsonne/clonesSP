import axios from "axios";
import * as Sentry from "@sentry/nextjs";
import { getToken, clearToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://backend.networkchains.com";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      if (typeof window !== "undefined") {
        console.error("Authentication error - redirecting to login");
        clearToken();
      }
    }
    // Surface the server-provided error message so toasts show the
    // precise reason (e.g., AI rate-limit / billing) instead of the
    // generic axios "Request failed with status code N".
    const serverMsg =
      error.response?.data?.error ||
      error.response?.data?.message;
    if (typeof serverMsg === "string" && serverMsg.trim().length > 0) {
      error.message = serverMsg;
    }
    const status = error?.response?.status;
    if (!error?.response || status >= 500) {
      Sentry.captureException(error, {
        tags: { feature: "api", action: "request" },
        contexts: { http: { url: error?.config?.url, method: error?.config?.method, status_code: status } },
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
