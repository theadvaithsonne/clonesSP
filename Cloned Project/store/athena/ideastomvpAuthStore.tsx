import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Base API configuration
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://finaid2.accountants.io:8443/api/v1";

// Types
export interface IdeasToMVPUser {
  id: string;
  username: string;
  email: string;
  token: string;
}

export interface IdeasToMVPAuthState {
  // State
  user: IdeasToMVPUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: IdeasToMVPUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initializeAuth: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  getAuthFromLocalStorage: () => {
    hasToken: boolean;
    hasUser: boolean;
    hasAuth: boolean;
    user: IdeasToMVPUser | null;
  };
}

export const useIdeasToMVPAuthStore = create<IdeasToMVPAuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) => {
        console.log("🔐 Store: setUser called with:", {
          user: !!user,
          isAuthenticated: !!user,
        });
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        });

        // Store token in localStorage for API calls
        if (user?.token) {
          localStorage.setItem("ideastomvp-token", user.token);
        } else {
          localStorage.removeItem("ideastomvp-token");
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Get auth state directly from localStorage as fallback
      getAuthFromLocalStorage: () => {
        if (typeof window !== "undefined") {
          const storedToken = localStorage.getItem("ideastomvp-token");
          const storedUser = localStorage.getItem("ideastomvp-user");
          const storedAuth = localStorage.getItem("ideastomvp-isAuthenticated");

          return {
            hasToken: !!storedToken,
            hasUser: !!storedUser,
            hasAuth: storedAuth === "true",
            user: storedUser ? JSON.parse(storedUser) : null,
          };
        }
        return { hasToken: false, hasUser: false, hasAuth: false, user: null };
      },

      // Initialize auth state from localStorage on app start
      initializeAuth: async () => {
        if (typeof window !== "undefined") {
          const storedToken = localStorage.getItem("ideastomvp-token");
          const storedUser = localStorage.getItem("ideastomvp-user");
          const storedAuth = localStorage.getItem("ideastomvp-isAuthenticated");

          console.log("🔐 Store: Initializing auth from localStorage:", {
            hasToken: !!storedToken,
            hasUser: !!storedUser,
            hasAuth: !!storedAuth,
          });

          if (storedToken && storedUser && storedAuth === "true") {
            try {
              const user = JSON.parse(storedUser);
              console.log("🔐 Store: Parsed user from localStorage:", {
                id: user.id,
                username: user.username,
                email: user.email,
                hasToken: !!user.token,
              });
              // Verify the token is still valid by checking if it exists
              if (user.token === storedToken) {
                set({
                  user,
                  isAuthenticated: true,
                  error: null,
                });
                console.log("✅ Auth state initialized from stored data");
              } else {
                // Token mismatch, clear everything
                console.log("❌ Token mismatch, clearing auth state");
                set({
                  user: null,
                  isAuthenticated: false,
                  error: null,
                });
                localStorage.removeItem("ideastomvp-token");
                localStorage.removeItem("ideastomvp-user");
                localStorage.removeItem("ideastomvp-isAuthenticated");
              }
            } catch (error) {
              console.error("Error parsing stored user data:", error);
              localStorage.removeItem("ideastomvp-token");
              localStorage.removeItem("ideastomvp-user");
              localStorage.removeItem("ideastomvp-isAuthenticated");
              set({
                user: null,
                isAuthenticated: false,
                error: null,
              });
            }
          } else {
            console.log("🧹 No stored auth data found or incomplete");
            set({
              user: null,
              isAuthenticated: false,
              error: null,
            });
          }
        }
      },

      login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Use the external API endpoint
          console.log("🔐 Attempting login with:", {
            email: identifier,
            password,
          });
          const response = await fetch(`${API_BASE_URL}/user/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ identifier, password }),
          });

          console.log("🔐 Login response status:", response.status);
          const result = await response.json();
          console.log("🔐 Login response data:", result);
          console.log("🔐 Success check:", result.success);
          console.log("🔐 JWT check:", !!result.data?.jwt);
          console.log("🔐 User data:", result.data?.user);
          console.log("🔐 Username from API:", result.data?.user?.username);
          console.log("🔐 Email from API:", result.data?.user?.email);

          if (result.success && result.data?.jwt) {
            // Ensure username and email are consistent
            const userEmail = result.data.user?.email || identifier;
            const user: IdeasToMVPUser = {
              id: result.data.user?.id?.toString() || "",
              username: result.data.user?.username || userEmail, // Use email as fallback for username
              email: userEmail,
              token: result.data.jwt,
            };

            console.log("🔐 Final user object created:", {
              id: user.id,
              username: user.username,
              email: user.email,
              hasToken: !!user.token,
            });

            // Store user data in localStorage FIRST
            localStorage.setItem("ideastomvp-user", JSON.stringify(user));
            localStorage.setItem("ideastomvp-token", user.token);
            localStorage.setItem("ideastomvp-isAuthenticated", "true");

            // Set user and authentication state in Zustand
            const newState = {
              user,
              isAuthenticated: true,
              error: null,
              isLoading: false,
            };

            console.log("🔐 Store: Setting new state:", newState);
            set(newState);

            console.log("🔐 Store: State set, verifying current state:", get());

            // Verify localStorage was set correctly
            const storedUser = localStorage.getItem("ideastomvp-user");
            const storedToken = localStorage.getItem("ideastomvp-token");
            const storedAuth = localStorage.getItem(
              "ideastomvp-isAuthenticated"
            );

            console.log("🔐 Store: localStorage verification:", {
              storedUser: !!storedUser,
              storedToken: !!storedToken,
              storedAuth: storedAuth,
            });

            return true;
          } else {
            // Handle failed login response
            const errorMessage =
              result.error?.error?.message || result.message || "Login failed";
            throw new Error(errorMessage);
          }
        } catch (error: any) {
          const errorMessage =
            error.message || "An error occurred during login";
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
        localStorage.removeItem("ideastomvp-token");
        localStorage.removeItem("ideastomvp-user");
        localStorage.removeItem("ideastomvp-isAuthenticated");
      },
    }),
    {
      name: "ideastomvp-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for better performance
export const useIdeasToMVPUser = () =>
  useIdeasToMVPAuthStore((state) => state.user);
export const useIdeasToMVPIsAuthenticated = () =>
  useIdeasToMVPAuthStore((state) => state.isAuthenticated);
export const useIdeasToMVPLogin = () =>
  useIdeasToMVPAuthStore((state) => state.login);
export const useIdeasToMVPLogout = () =>
  useIdeasToMVPAuthStore((state) => state.logout);
export const useIdeasToMVPError = () =>
  useIdeasToMVPAuthStore((state) => state.error);
