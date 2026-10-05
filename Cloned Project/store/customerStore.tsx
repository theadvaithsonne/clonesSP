import { create } from "zustand";

export interface CustomerData {
  _id: string;
  app_name?: string;
  app_code: string;
  app_icon?: string;
  total_holdings?: number | string;
  liquid_holdings?: number | string;
  userData?: {
    profile_img?: string;
    name?: string;
    username?: string;
    email?: string;
  };
  refUserData?: {
    profile_img?: string;
    name?: string;
    email?: string;
  };
  date: string | Date;
}

interface CustomerStore {
  selectedCustomer: CustomerData | null;
  setSelectedCustomer: (customer: CustomerData) => void;
  clearSelectedCustomer: () => void;
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  selectedCustomer: null,
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
  clearSelectedCustomer: () => set({ selectedCustomer: null }),
}));
