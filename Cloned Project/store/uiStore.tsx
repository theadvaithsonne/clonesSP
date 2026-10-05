import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Types
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

export interface Modal {
  id: string;
  isOpen: boolean;
  data?: Record<string, unknown>;
}

export interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  
  // Navigation
  currentPage: string;
  breadcrumbs: { label: string; href?: string }[];
  
  // Modals & Dialogs
  modals: Record<string, Modal>;
  
  // Notifications
  notifications: Notification[];
  
  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;
  
  // Theme
  theme: "light" | "dark" | "system";
  
  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Actions - Navigation
  setCurrentPage: (page: string) => void;
  setBreadcrumbs: (breadcrumbs: { label: string; href?: string }[]) => void;
  
  // Actions - Modals
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string, data?: Record<string, unknown>) => void;
  isModalOpen: (id: string) => boolean;
  getModalData: (id: string) => Record<string, unknown> | undefined;
  
  // Actions - Notifications
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Actions - Loading
  setGlobalLoading: (loading: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;
  clearLoadingStates: () => void;
  
  // Actions - Theme
  setTheme: (theme: "light" | "dark" | "system") => void;
  
  // Helper methods
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      currentPage: "",
      breadcrumbs: [],
      modals: {},
      notifications: [],
      globalLoading: false,
      loadingStates: {},
      theme: "system",

      // Sidebar Actions
      toggleSidebar: () => set((state) => ({ 
        sidebarCollapsed: !state.sidebarCollapsed 
      })),
      
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Navigation Actions
      setCurrentPage: (page) => set({ currentPage: page }),
      
      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

      // Modal Actions
      openModal: (id, data) => set((state) => ({
        modals: {
          ...state.modals,
          [id]: { id, isOpen: true, data }
        }
      })),
      
      closeModal: (id) => set((state) => ({
        modals: {
          ...state.modals,
          [id]: { ...state.modals[id], isOpen: false }
        }
      })),
      
      toggleModal: (id, data) => {
        const modal = get().modals[id];
        if (modal?.isOpen) {
          get().closeModal(id);
        } else {
          get().openModal(id, data);
        }
      },
      
      isModalOpen: (id) => {
        return get().modals[id]?.isOpen || false;
      },
      
      getModalData: (id) => {
        return get().modals[id]?.data;
      },

      // Notification Actions
      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          duration: notification.duration || 5000,
        };
        
        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }));
        
        // Auto-remove notification after duration
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, newNotification.duration);
        }
      },
      
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      
      clearNotifications: () => set({ notifications: [] }),

      // Loading Actions
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
      
      setLoading: (key, loading) => set((state) => ({
        loadingStates: {
          ...state.loadingStates,
          [key]: loading
        }
      })),
      
      isLoading: (key) => {
        return get().loadingStates[key] || false;
      },
      
      clearLoadingStates: () => set({ loadingStates: {} }),

      // Theme Actions
      setTheme: (theme) => set({ theme }),

      // Helper methods
      showSuccess: (title, message) => {
        get().addNotification({
          type: "success",
          title,
          message,
        });
      },
      
      showError: (title, message) => {
        get().addNotification({
          type: "error",
          title,
          message,
          duration: 7000, // Longer duration for errors
        });
      },
      
      showWarning: (title, message) => {
        get().addNotification({
          type: "warning",
          title,
          message,
        });
      },
      
      showInfo: (title, message) => {
        get().addNotification({
          type: "info",
          title,
          message,
        });
      },
    }),
    {
      name: "ui-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist certain UI preferences
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

// Selectors for better performance
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed);
export const useCurrentPage = () => useUIStore((state) => state.currentPage);
export const useBreadcrumbs = () => useUIStore((state) => state.breadcrumbs);
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useGlobalLoading = () => useUIStore((state) => state.globalLoading);
export const useTheme = () => useUIStore((state) => state.theme);
