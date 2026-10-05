import { create } from 'zustand';

interface DashboardState {
    columns: any[];
    setColumns: (columns: any[] | ((prev: any[]) => any[])) => void;
    isFetchingColumns: boolean;
    setIsFetchingColumns: (isFetching: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
    columns: [],
    setColumns: (updater) => set((state) => ({
        columns: typeof updater === 'function' ? updater(state.columns) : updater
    })),
    isFetchingColumns: false,
    setIsFetchingColumns: (isFetching) => set({ isFetchingColumns: isFetching })
}));
