import { create } from "zustand";
import Cookies from "js-cookie";

interface UserProfile {
    _id: string;
    name: string;
    email: string;
    [key: string]: any;
}

interface UserStore {
    userProfile: UserProfile | null;
    isUserProfileFetched: boolean;
    isLoading: boolean;
    error: string | null;
    fetchUserProfile: (token?: string) => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
    userProfile: null,
    isUserProfileFetched: false,
    isLoading: false,
    error: null,

    fetchUserProfile: async (token?: string) => {
        set({ isLoading: true, error: null });
        try {
            const authToken = token || localStorage.getItem("garage_tok");
            if (!authToken) {
                console.warn("No auth token, cannot fetch profile");
                set({ isLoading: false, isUserProfileFetched: false, error: "No auth token" });
                return;
            }

            const response = await fetch("https://uatapi.garage.app/flowboard/v1/users/profile", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();

            if (result?.status && result?.data) {
                // Maintain existing behavior of setting cookie
                Cookies.set("flowboadUserdata", JSON.stringify(result.data));

                set({
                    userProfile: result.data,
                    isUserProfileFetched: true,
                    isLoading: false
                });
            } else {
                set({
                    isUserProfileFetched: false,
                    isLoading: false,
                    error: result?.message || "Failed to load user data"
                });
            }
        } catch (err) {
            console.error("Error in fetchUserProfile:", err);
            set({
                isUserProfileFetched: false,
                isLoading: false,
                error: "Network error or exception"
            });
        }
    },
}));
