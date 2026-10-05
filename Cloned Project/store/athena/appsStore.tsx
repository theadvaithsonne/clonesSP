import { create } from "zustand";

export interface Apps {
  _id: string;
  app_name?: string;
  app_code: string;
  app_icon?: string;
  operatorData?: {
    email?: string;
  };
  date: string | Date;
}

interface AppsStore {
  apps: Apps[];
  setApps: (apps: Apps[]) => void;
  shouldReload: boolean;
  setShouldReload: (reload: boolean) => void;
}

export const useAppsStore = create<AppsStore>((set) => ({
  apps: [],
  setApps: (apps) => set({ apps }),
  shouldReload: true,
  setShouldReload: (reload) => set({ shouldReload: reload }),
}));

// GX User Auth Response Type
export interface GxAuthResponse {
  status: boolean;
  message: string;
  user: {
    _id: string;
    name: string;
    email: string;
    affiliate_id: string;
    ref_affiliate: string;
    username: string;
    cognito_username: string;
    signedup_app: string;
    profile_img: string;
  };
  device_key: string;
  tokenExpiresIn: number;
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

interface GxUserStore {
  gxUser: GxAuthResponse | null;
  setGxUser: (user: GxAuthResponse | null) => void;
  syncLocalStorageWithGxUser: () => void;
}

export const useGxUserStore = create<GxUserStore>((set, get) => ({
  gxUser: null,
  setGxUser: (user) => {
    set({ gxUser: user });
    // Update all localStorage instances of gx-auth-response
    if (typeof window !== "undefined" && user) {
      localStorage.setItem("gx-auth-response", JSON.stringify(user));
    }
  },
  syncLocalStorageWithGxUser: () => {
    if (typeof window !== "undefined") {
      const user = get().gxUser;
      if (user) {
        localStorage.setItem("gx-auth-response", JSON.stringify(user));
      } else {
        localStorage.removeItem("gx-auth-response");
      }
    }
  },
}));
