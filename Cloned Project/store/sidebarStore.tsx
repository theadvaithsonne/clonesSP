import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Types for sidebar items
export interface SidebarItem {
  programtypeid: string;
  companyName: string;
  // Add other properties as needed
}

export interface SidebarState {
  // Data
  mvpSidebarItems: SidebarItem[];
  programManagerSidebarItems: SidebarItem[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setMvpSidebarItems: (items: SidebarItem[]) => void;
  setProgramManagerSidebarItems: (items: SidebarItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // API calls
  fetchMvpSidebarItems: (email: string) => Promise<void>;
  fetchProgramManagerSidebarItems: (email: string) => Promise<void>;
  
  // Helper methods
  getMvpItemById: (id: string) => SidebarItem | undefined;
  getProgramManagerItemById: (id: string) => SidebarItem | undefined;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // Initial state
      mvpSidebarItems: [],
      programManagerSidebarItems: [],
      isLoading: false,
      error: null,

      // Actions
      setMvpSidebarItems: (items) => set({ mvpSidebarItems: items }),
      
      setProgramManagerSidebarItems: (items) => set({ programManagerSidebarItems: items }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),

      // API calls
      fetchMvpSidebarItems: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Replace with your actual API endpoint
          const response = await fetch(`/api/mvp-sidebar?email=${email}`);
          if (!response.ok) {
            throw new Error('Failed to fetch MVP sidebar items');
          }
          
          const items = await response.json();
          set({ mvpSidebarItems: items, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch MVP sidebar items';
          set({ error: errorMessage, isLoading: false });
        }
      },

      fetchProgramManagerSidebarItems: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Replace with your actual API endpoint
          const response = await fetch(`/api/program-manager-sidebar?email=${email}`);
          if (!response.ok) {
            throw new Error('Failed to fetch Program Manager sidebar items');
          }
          
          const items = await response.json();
          set({ programManagerSidebarItems: items, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Program Manager sidebar items';
          set({ error: errorMessage, isLoading: false });
        }
      },

      // Helper methods
      getMvpItemById: (id: string) => {
        return get().mvpSidebarItems.find(item => item.programtypeid === id);
      },

      getProgramManagerItemById: (id: string) => {
        return get().programManagerSidebarItems.find(item => item.programtypeid === id);
      },
    }),
    {
      name: "sidebar-storage",
      storage: createJSONStorage(() => localStorage),
      // Persist the sidebar data
      partialize: (state) => ({ 
        mvpSidebarItems: state.mvpSidebarItems,
        programManagerSidebarItems: state.programManagerSidebarItems,
      }),
    }
  )
);

// Selectors for better performance
export const useMvpSidebarItems = () => useSidebarStore((state) => state.mvpSidebarItems);
export const useProgramManagerSidebarItems = () => useSidebarStore((state) => state.programManagerSidebarItems);
export const useSidebarLoading = () => useSidebarStore((state) => state.isLoading);
export const useSidebarError = () => useSidebarStore((state) => state.error);
