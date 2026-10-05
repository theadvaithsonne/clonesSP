import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Cookies from "js-cookie";
import { buildExternalUrl } from "@/lib/api-config";
import { jwtDecode } from "jwt-decode";

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
  phone?: string | null;
  phoneVerified?: boolean;
  // Impersonation fields
  originalUserId?: string;
  isSupportAgent?: boolean;
  impersonatedUserId?: string;
  impersonatedUserEmail?: string;
  impersonatedUserName?: string;
  impersonatedUserRole?: string;
}

interface JwtPayload {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  exp?: number;
  orgId?: string;
  iat?: number;
  userId?: string;
  [key: string]: any;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: Partial<User> | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initializeAuth: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  /** Re-read /auth/me and merge. Never signs anyone out. */
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  clearError: () => void;

  isAdmin: () => boolean;
  isEmployee: () => boolean;
  isClient: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Set user (supports partial updates)
      setUser: (user: Partial<User> | null) => {
        const currentUser = get().user;

        if (user) {
          const updatedUser = { ...currentUser, ...user };

          set({
            user: updatedUser,
            isAuthenticated: true,
            error: null,
          });

          console.log("👤 Setting user data cookie for:", updatedUser);

          // Preserve impersonation data if exists
          const impersonationData = currentUser?.impersonatedUserId
            ? {
                isImpersonated: currentUser.isSupportAgent,
                impersonationId: currentUser.impersonatedUserId,
                originalSupportUserId: currentUser.originalUserId,
                impersonatorId: currentUser.impersonatedUserId,
                impersonatorName: currentUser.impersonatedUserName,
                impersonatorRole: currentUser.impersonatedUserRole,
              }
            : {};

          const userData = {
            id: updatedUser.userId,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            organizationId: updatedUser.organizationId,
            employeeId: updatedUser.employeeId || "",
            clientId: updatedUser.clientId || "",
            startupbrokerRole: updatedUser.startupbrokerRole || "",
            phoneNumber: updatedUser.phoneNumber || "",
            ...impersonationData,
          };

          Cookies.set("user-data", JSON.stringify(userData), {
            path: "/",
            secure: true,
            sameSite: "none",
            expires: 7,
          });

          console.log("✅ user-data cookie set successfully");
        } else {
          console.log("🗑️ Clearing user and cookies");
          set({ user: null, isAuthenticated: false });
          Cookies.remove("user-data", { path: "/" });
          Cookies.remove("auth-token", { path: "/" });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      initializeAuth: () => {
        if (typeof window !== "undefined") {
          const storedToken = localStorage.getItem("auth-token");
          const userData = localStorage.getItem("garage_tok");

          if ((storedToken || userData) && userData) {
            try {
              const parsedUserData = jwtDecode<JwtPayload>(userData);
              const user: User = {
                userId: parsedUserData._id,
                email: parsedUserData.email,
                name: parsedUserData.name,
                role: parsedUserData.role,
                organizationId: parsedUserData.orgId,
                employeeId: parsedUserData.employeeId,
                clientId: parsedUserData.clientId,
                startupbrokerRole: parsedUserData.startupbrokerRole,
                phoneNumber: parsedUserData.phoneNumber,
              };
              get().setUser(user);
            } catch (error) {
              localStorage.removeItem("auth-token");
              Cookies.remove("auth-token", { path: "/" });
              Cookies.remove("user-data", { path: "/" });
              get().setUser(null);
            }
          } else {
            get().setUser(null);
          }
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(buildExternalUrl("auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            credentials: "include",
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Login failed");
          }

          const data = await response.json();
          const authToken = data.user?.token || data.token;

          if (authToken) {
            Cookies.set("auth-token", authToken, {
              path: "/",
              secure: true,
              sameSite: "none",
              expires: 7,
            });
            localStorage.setItem("auth-token", authToken);
          }

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
            phone: data.user.phone || null,
            phoneVerified: !!data.user.phoneVerified,
          };

          get().setUser(user);
          set({ isLoading: false });
          return true;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Login failed", isLoading: false });
          return false;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await fetch(buildExternalUrl("auth/logout"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.warn("Logout API failed:", error);
        }

        get().setUser(null);
        Cookies.remove("auth-token", { path: "/" });
        Cookies.remove("user-data", { path: "/" });
        const facebookLeadsSession = localStorage.getItem("facebook_leads_integration");
        localStorage.clear();
        if (facebookLeadsSession) {
          localStorage.setItem("facebook_leads_integration", facebookLeadsSession);
        }
        set({ isLoading: false });
      },

      /**
       * Pull fresh user fields from the server and merge them in.
       *
       * The store is persisted to localStorage, so values written at login
       * (phoneVerified, name, …) go stale the moment they change elsewhere —
       * and `checkAuth` only runs in the garage-admin layout. This is the
       * safe counterpart for the main app: on any failure it leaves the
       * cached user exactly as it was rather than signing anyone out.
       */
      refreshUser: async () => {
        const authToken =
          localStorage.getItem("garage_tok") || localStorage.getItem("auth-token");
        if (!authToken) return;
        try {
          const response = await fetch(buildExternalUrl("auth/me"), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
          if (!response.ok) return;
          const body = await response.json();
          const me = body?.user || body;
          const current = get().user;
          if (!me || !current) return;
          get().setUser({
            ...current,
            name: me.name ?? current.name,
            phone: me.phone ?? current.phone ?? null,
            phoneVerified: !!me.phoneVerified,
          });
        } catch {
          // Offline or a blip — keep whatever we already had.
        }
      },

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        const authToken = localStorage.getItem("garage_tok") || localStorage.getItem("auth-token");
        const userData = localStorage.getItem("garage_tok");

        if (!authToken || !userData) {
          get().setUser(null);
          set({ isLoading: false });
          return;
        }

        try {
          const response = await fetch(buildExternalUrl("auth/me"), {
            method: "GET",
            headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
            credentials: "include",
          });

          if (!response.ok) {
            get().setUser(null);
            localStorage.removeItem("auth-token");
            Cookies.remove("auth-token", { path: "/" });
            Cookies.remove("user-data", { path: "/" });
            set({ isLoading: false });
            return;
          }

          const serverUser = await response.json();
          const me = serverUser.user || serverUser;
          const user: User = {
            userId: me.id || me.userId,
            email: me.email,
            name: me.name,
            role: me.role,
            organizationId: me.organizationId,
            employeeId: me.employeeId,
            clientId: me.clientId,
            startupbrokerRole: me.startupbrokerRole,
            phoneNumber: me.phoneNumber,
            phone: me.phone || null,
            phoneVerified: !!me.phoneVerified,
            originalUserId: me.originalUserId,
            isSupportAgent: me.isSupportAgent,
            impersonatedUserId: me.impersonatedUserId,
            impersonatedUserEmail: me.impersonatedUserEmail,
            impersonatedUserName: me.impersonatedUserName,
            impersonatedUserRole: me.impersonatedUserRole,
          };

          get().setUser(user);
          set({ isLoading: false });
        } catch (error) {
          get().setUser(null);
          localStorage.removeItem("auth-token");
          Cookies.remove("auth-token", { path: "/" });
          Cookies.remove("user-data", { path: "/" });
          set({ isLoading: false });
        }
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          get().setUser(updatedUser);
        }
      },

      isAdmin: () => get().user?.role === "admin",
      isEmployee: () => get().user?.role === "employee" || !!get().user?.employeeId,
      isClient: () => get().user?.role === "client" || !!get().user?.clientId,
      hasRole: (role: string) => get().user?.role === role,
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);