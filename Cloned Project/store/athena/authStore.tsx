import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Cookies from "js-cookie";
import { buildExternalUrl, buildInternalUrl } from "@/lib/api-config";


// Types
export interface User {
  userId: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  employeeId?: string;
  clientId?: string;
  startupbrokerRole?: string;
  phoneNumber?: string;
  // Impersonation fields
  originalUserId?: string;
  isSupportAgent?: boolean;
  impersonatedUserId?: string;
  impersonatedUserEmail?: string;
  impersonatedUserName?: string;
  impersonatedUserRole?: string;
}

export interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initializeAuth: () => void;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  clearError: () => void;

  // Helper methods
  isAdmin: () => boolean;
  isEmployee: () => boolean;
  isClient: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(

  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          error: null
        });
        console.log("👤 Setting user data cookie for:", user);
        // Update cookies when user changes
        if (user) {
          console.log("👤 Setting user data cookie for:", user);
          // Preserve existing impersonation data if it exists
          const existingUserData = Cookies.get("user-data");
          let impersonationData = {};
          if (existingUserData) {
            try {
              const parsed = JSON.parse(existingUserData);
              if (parsed.isImpersonated) {
                impersonationData = {
                  isImpersonated: parsed.isImpersonated,
                  impersonationId: parsed.impersonationId,
                  originalSupportUserId: parsed.originalSupportUserId,
                  impersonatorId: parsed.impersonatorId,
                  impersonatorName: parsed.impersonatorName,
                  impersonatorRole: parsed.impersonatorRole,
                };
              }
            } catch (e) {
              console.error("Error parsing existing user-data:", e);
            }
          }

          const userData = {
            id: user.userId,
            name: user.name,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            employeeId: user.employeeId || '',
            clientId: user.clientId || '',
            startupbrokerRole: user.startupbrokerRole || '',
            phoneNumber: user.phoneNumber || '',
            ...impersonationData, // Preserve impersonation metadata
          };
          Cookies.set("user-data", JSON.stringify(userData), {
            path: "/",
            secure: true, // Required for SameSite=None
            sameSite: "none", // Allow cross-origin iframe access
            expires: 7, // 7 days
            // No domain specified to match server-side cookie setting
          });
          console.log("✅ user-data cookie set successfully");
          // Don't remove auth-token when setting user - it's managed separately
        } else {
          console.log("🗑️ Clearing cookies (logout)");
          // Only remove cookies when explicitly clearing user (logout)
          Cookies.remove("user-data", { path: "/" });
          Cookies.remove("auth-token", { path: "/" });
          // Fallback clearing
          Cookies.remove("user-data");
          Cookies.remove("auth-token");
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      // Initialize auth state from localStorage on app start
      initializeAuth: () => {
        if (typeof window !== 'undefined') {
          const storedToken = localStorage.getItem("auth-token");
          const authTokenCookie = Cookies.get("auth-token");
          const userData = Cookies.get("user-data");

          console.log("🔄 Initializing auth state...");
          console.log("  - localStorage token:", storedToken ? "exists" : "missing");
          console.log("  - auth-token cookie:", authTokenCookie ? "exists" : "missing");
          console.log("  - user-data cookie:", userData ? "exists" : "missing");

          // Only initialize if we have both token and user data
          if ((storedToken || authTokenCookie) && userData) {
            console.log("🔄 Initializing auth state from stored data");
            try {
              const parsedUserData = JSON.parse(userData);
              const user: User = {
                userId: parsedUserData.id,
                email: parsedUserData.email,
                name: parsedUserData.name,
                role: parsedUserData.role,
                organizationId: parsedUserData.organizationId,
                employeeId: parsedUserData.employeeId,
                clientId: parsedUserData.clientId,
                startupbrokerRole: parsedUserData.startupbrokerRole,
                phoneNumber: parsedUserData.phoneNumber,
              };
              get().setUser(user);
              console.log("✅ Auth state initialized from stored data");
            } catch (error) {
              console.error("❌ Error parsing stored user data:", error);
              // Clear invalid data
              localStorage.removeItem("auth-token");
              Cookies.remove("auth-token", { path: "/" });
              Cookies.remove("user-data", { path: "/" });
              get().setUser(null);
            }
          } else {
            console.log("🧹 Missing required auth data, clearing state");
            // Clear any partial/invalid auth state
            get().setUser(null);
            if (storedToken && !userData) {
              console.log("🧹 Clearing orphaned localStorage token");
              localStorage.removeItem("auth-token");
            }
            if (authTokenCookie && !userData) {
              console.log("🧹 Clearing orphaned auth-token cookie");
              Cookies.remove("auth-token", { path: "/" });
            }
          }
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(buildExternalUrl("auth/login"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Login failed");
          }

          const data = await response.json();
          console.log("✅ Login successful, received data:", data);

          // Set auth token cookie with proper configuration
          // The token is located at data.user.token, not data.token
          const authToken = data.user?.token || data.token;

          if (authToken) {
            console.log("🔑 Setting auth-token cookie:", authToken.substring(0, 20) + "...");
            console.log("🔍 Token length:", authToken.length);

            // For cross-origin requests, we need to set the cookie on the frontend domain
            // Use simple cookie settings that work with localhost
            try {
              Cookies.set("auth-token", authToken, {
                path: "/",
                secure: true, // Required for SameSite=None
                sameSite: "none", // Allow cross-origin iframe access
                expires: 7, // 7 days
              });

              console.log("✅ auth-token cookie set on frontend domain");

              // Verify the cookie was set
              const verifyCookie = Cookies.get("auth-token");
              console.log("🔍 Cookie verification:", verifyCookie ? "SUCCESS" : "FAILED");

              if (!verifyCookie) {
                console.log("⚠️ js-cookie failed, trying direct document.cookie...");
                // Fallback to direct document.cookie
                const expires = new Date();
                expires.setDate(expires.getDate() + 7);
                document.cookie = `auth-token=${authToken}; path=/; expires=${expires.toUTCString()}; SameSite=None; Secure`;

                // Check again
                const directCheck = Cookies.get("auth-token");
                console.log("🔍 Direct method result:", directCheck ? "SUCCESS" : "FAILED");
              }

            } catch (cookieError) {
              console.error("❌ Error setting auth-token cookie:", cookieError);
            }
            // Store token in localStorage for cross-origin API calls
            localStorage.setItem("auth-token", authToken);
            console.log("✅ Token stored in localStorage for cross-origin API calls");
          } else {
            console.log("❌ No token received from external API");
            console.log("🔍 Response data:", data);
          }

          // Set user data
          const user: User = {
            userId: data.user.id || data.user.userId,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            organizationId: data.user.organizationId,
            employeeId: data.user.employeeId,
            clientId: data.user.clientId,
            startupbrokerRole: data.user.startupbrokerRole,
            phoneNumber: data.user.phoneNumber,
          };

          get().setUser(user);
          set({ isLoading: false });

          // Final verification
          console.log("🔍 Final cookie check:");
          console.log("  - auth-token:", Cookies.get("auth-token") ? "exists" : "missing");
          console.log("  - user-data:", Cookies.get("user-data") ? "exists" : "missing");

          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Login failed";
          set({ error: errorMessage, isLoading: false });
          return null;
        }
      },

      logout: async () => {
        set({ isLoading: true });

        console.log("🚪 Starting logout process...");

        try {
          // Call external API logout endpoint
          const response = await fetch(buildExternalUrl("auth/logout"), {
            method: "POST",
            credentials: 'include',
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            console.log("✅ External API logout successful");
          } else {
            console.log("⚠️ External API logout failed, but continuing with local logout");
          }
        } catch (error) {
          console.error("⚠️ Logout API call failed:", error);
          // Continue with local logout even if API fails
        }

        // Clear local state first
        get().setUser(null);

        // Clear client-side cookies explicitly
        console.log("🧹 Clearing client-side cookies...");
        Cookies.remove("auth-token", { path: "/" });
        Cookies.remove("user-data", { path: "/" });
        Cookies.remove("flowboadUserdata", { path: "/" });
        // Also try without path specification
        Cookies.remove("auth-token");
        Cookies.remove("user-data");
        Cookies.remove("flowboadUserdata");
        // Clear localStorage while preserving Facebook Leads integration cache
        const facebookLeadsSession = localStorage.getItem("facebook_leads_integration");
        localStorage.clear();
        if (facebookLeadsSession) {
          localStorage.setItem("facebook_leads_integration", facebookLeadsSession);
        }

        console.log("✅ Logout process completed");
        set({ isLoading: false });
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });

        console.log("🔍 checkAuth called - checking cookies...");
        console.log("🍪 Current auth-token:", Cookies.get("auth-token") ? "exists" : "missing");
        console.log("🍪 Current user-data:", Cookies.get("user-data") ? "exists" : "missing");
        console.log("🍪 All cookies:", document.cookie);

        try {
          // First check if we have cookies
          const authToken = Cookies.get("auth-token") || localStorage.getItem("auth-token");
          const userData = Cookies.get("user-data");

          if (!authToken || !userData) {
            console.log("❌ Missing required auth data - clearing user state");
            console.log("  - Token:", authToken ? "exists" : "missing");
            console.log("  - User data:", userData ? "exists" : "missing");
            get().setUser(null);
            // Clean up any orphaned data
            if (authToken && !userData) {
              localStorage.removeItem("auth-token");
              Cookies.remove("auth-token", { path: "/" });
            }
            set({ isLoading: false });
            return;
          }

          // Verify with external server
          const response = await fetch(buildExternalUrl("auth/me"), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            credentials: 'include',
          });

          if (!response.ok) {
            console.log("❌ Server auth check failed - clearing user state");
            // Token is invalid, clear everything
            get().setUser(null);
            localStorage.removeItem("auth-token");
            Cookies.remove("auth-token", { path: "/" });
            Cookies.remove("user-data", { path: "/" });
            set({ isLoading: false });
            return;
          }

          const serverUser = await response.json();
          console.log("✅ Server auth check successful");

          // Update user data from server
          const user: User = {
            userId: serverUser.id || serverUser.userId,
            email: serverUser.email,
            name: serverUser.name,
            role: serverUser.role,
            organizationId: serverUser.organizationId,
            employeeId: serverUser.employeeId,
            clientId: serverUser.clientId,
            startupbrokerRole: serverUser.startupbrokerRole,
            phoneNumber: serverUser.phoneNumber,
            // Handle impersonation
            originalUserId: serverUser.originalUserId,
            isSupportAgent: serverUser.isSupportAgent,
            impersonatedUserId: serverUser.impersonatedUserId,
            impersonatedUserEmail: serverUser.impersonatedUserEmail,
            impersonatedUserName: serverUser.impersonatedUserName,
            impersonatedUserRole: serverUser.impersonatedUserRole,
          };

          get().setUser(user);
          set({ isLoading: false });
        } catch (error) {
          console.error("❌ Auth check failed:", error);
          get().setUser(null);
          // Clear potentially invalid auth data
          localStorage.removeItem("auth-token");
          Cookies.remove("auth-token", { path: "/" });
          Cookies.remove("user-data", { path: "/" });
          set({ isLoading: false });
        }
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          get().setUser(updatedUser);
        }
      },

      // Helper methods
      isAdmin: () => {
        const user = get().user;
        return user?.role === "admin";
      },

      isEmployee: () => {
        const user = get().user;
        return user?.role === "employee" || !!user?.employeeId;
      },

      isClient: () => {
        const user = get().user;
        return user?.role === "client" || !!user?.clientId;
      },

      hasRole: (role: string) => {
        const user = get().user;
        return user?.role === role;
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not loading states
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
