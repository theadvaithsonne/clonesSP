"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import {
  AffiliateUser,
  GlobeMarkerData,
  DirectChildrenResponse,
  UserInfoResponse,
  SearchDownlineByEmailResponse,
  assignFallbackCoordinates,
  isValidCoordinate,
} from "../types";

export function useAffiliateGlobe() {
  const [focusedUser, setFocusedUser] = useState<AffiliateUser | null>(null);
  const [directChildren, setDirectChildren] = useState<AffiliateUser[]>([]);
  const [navigationHistory, setNavigationHistory] = useState<AffiliateUser[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const currentUserIdRef = useRef<string | null>(null);

  // Email search state
  const [isEmailSearching, setIsEmailSearching] = useState(false);
  const [emailSearchError, setEmailSearchError] = useState<string | null>(null);



  // Initialize with current logged-in user
  useEffect(() => {
    initializeWithCurrentUser();
  }, []);

  const initializeWithCurrentUser = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch current user's info using "me" endpoint
      const orgId = localStorage.getItem("garage_org_id");
      const userResponse = await api<UserInfoResponse>(
        `/affiliate/user-info/me${orgId ? `?orgId=${orgId}` : ""}`
      );

      if (userResponse.success && userResponse.user) {
        const validOffices = (userResponse.user.offices || []).filter(
          (o) =>
            o &&
            o.name &&
            typeof o.name === "string" &&
            o.name.trim() !== "" &&
            o.name.toLowerCase() !== "unknown" &&
            o.name.toLowerCase() !== "unknown organization"
        );
        const user: AffiliateUser = {
          ...userResponse.user,
          offices: validOffices,
          officesJoined: validOffices.length,
          hasChildren: userResponse.user.directReferrals > 0,
        };

        setFocusedUser(user);
        setNavigationHistory([user]);
        currentUserIdRef.current = user.id;

        // Fetch direct children (reset pagination)
        await fetchDirectChildren(user.id, 1, "", false);
      }
    } catch (err) {
      console.error("Error initializing affiliate globe:", err);
      setError("Failed to load affiliate network");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDirectChildren = async (
    userId: string,
    page: number = 1,
    search: string = "",
    append: boolean = false
  ) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });
      if (search.trim()) {
        params.append("search", search.trim());
      }
      const orgId = localStorage.getItem("garage_org_id");
      if (orgId) {
        params.append("orgId", orgId);
      }

      const response = await api<DirectChildrenResponse>(
        `/affiliate/direct-children/${userId}?${params.toString()}`
      );

      if (response.success) {
        // Assign fallback coordinates for users without location data
        const childrenWithCoords = response.children.map(
          assignFallbackCoordinates
        );

        if (append) {
          setDirectChildren((prev) => [...prev, ...childrenWithCoords]);
        } else {
          setDirectChildren(childrenWithCoords);
        }

        // Update pagination state
        setCurrentPage(response.pagination.page);
        setHasMore(response.pagination.hasMore);
        setTotalCount(response.pagination.total);
      }
    } catch (err) {
      console.error("Error fetching direct children:", err);
      setError("Failed to fetch referrals");
    }
  };

  // Load more children (for infinite scroll)
  const loadMoreChildren = useCallback(async () => {
    if (!focusedUser || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      await fetchDirectChildren(
        focusedUser.id,
        currentPage + 1,
        searchQuery,
        true
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [focusedUser, currentPage, searchQuery, isLoadingMore, hasMore]);

  // Search children (server-side)
  const searchChildren = useCallback(
    async (query: string) => {
      if (!focusedUser) return;

      setSearchQuery(query);
      setIsLoading(true);

      try {
        // Reset to page 1 when searching
        await fetchDirectChildren(focusedUser.id, 1, query, false);
      } finally {
        setIsLoading(false);
      }
    },
    [focusedUser]
  );

  const selectUser = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);
      setSearchQuery(""); // Clear search when navigating

      try {
        // Fetch user info
        const orgId = localStorage.getItem("garage_org_id");
        const userResponse = await api<UserInfoResponse>(
          `/affiliate/user-info/${userId}${orgId ? `?orgId=${orgId}` : ""}`
        );

        if (userResponse.success && userResponse.user) {
          const validOffices = (userResponse.user.offices || []).filter(
            (o) =>
              o &&
              o.name &&
              typeof o.name === "string" &&
              o.name.trim() !== "" &&
              o.name.toLowerCase() !== "unknown" &&
              o.name.toLowerCase() !== "unknown organization"
          );
          const newUser: AffiliateUser = {
            ...userResponse.user,
            offices: validOffices,
            officesJoined: validOffices.length,
            hasChildren: userResponse.user.directReferrals > 0,
          };

          setFocusedUser(newUser);
          setNavigationHistory((prev) => [...prev, newUser]);
          currentUserIdRef.current = userId;

          // Fetch their direct children (reset pagination)
          await fetchDirectChildren(userId, 1, "", false);
        }
      } catch (err) {
        console.error("Error selecting user:", err);
        setError("Failed to load user network");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const goBack = useCallback(async () => {
    if (navigationHistory.length > 1) {
      setIsLoading(true);
      setSearchQuery(""); // Clear search when navigating

      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current user
      const previousUser = newHistory[newHistory.length - 1];

      setNavigationHistory(newHistory);
      setFocusedUser(previousUser);
      currentUserIdRef.current = previousUser.id;

      // Fetch previous user's children (reset pagination)
      await fetchDirectChildren(previousUser.id, 1, "", false);
      setIsLoading(false);
    }
  }, [navigationHistory]);

  const goToRoot = useCallback(async () => {
    if (navigationHistory.length > 1) {
      setIsLoading(true);
      setSearchQuery(""); // Clear search when navigating

      const rootUser = navigationHistory[0];
      setNavigationHistory([rootUser]);
      setFocusedUser(rootUser);
      currentUserIdRef.current = rootUser.id;

      // Fetch root user's children (reset pagination)
      await fetchDirectChildren(rootUser.id, 1, "", false);
      setIsLoading(false);
    }
  }, [navigationHistory]);

  const navigateToHistoryIndex = useCallback(
    async (index: number) => {
      if (index >= 0 && index < navigationHistory.length - 1) {
        setIsLoading(true);
        setSearchQuery(""); // Clear search when navigating

        const targetUser = navigationHistory[index];
        const newHistory = navigationHistory.slice(0, index + 1);

        setNavigationHistory(newHistory);
        setFocusedUser(targetUser);
        currentUserIdRef.current = targetUser.id;

        // Fetch that user's children (reset pagination)
        await fetchDirectChildren(targetUser.id, 1, "", false);
        setIsLoading(false);
      }
    },
    [navigationHistory]
  );

  // Deep search by exact email across all downlines
  // On success, navigates directly into the found user's section (like clicking on them)
  const searchByEmail = useCallback(
    async (email: string): Promise<{ error: string } | { success: true }> => {
      if (!focusedUser) return { error: "No user loaded" };

      const rootUserId = navigationHistory[0]?.id || focusedUser.id;

      setIsEmailSearching(true);
      setEmailSearchError(null);

      try {
        const orgId = localStorage.getItem("garage_org_id");
        const searchParams = new URLSearchParams({
          email: email.trim(),
        });
        if (orgId) {
          searchParams.append("orgId", orgId);
        }
        const response = await api<SearchDownlineByEmailResponse>(
          `/affiliate/search-downline-by-email/${rootUserId}?${searchParams.toString()}`
        );

        if (!response.success) {
          setEmailSearchError("Search failed");
          return { error: "Search failed" };
        }

        if (!response.found) {
          const msg = response.message || "Not found in your network";
          setEmailSearchError(msg);
          return { error: msg };
        }

        if (response.isSelf) {
          // Navigate back to root
          const rootUser = navigationHistory[0];
          if (rootUser) {
            setNavigationHistory([rootUser]);
            setFocusedUser(rootUser);
            currentUserIdRef.current = rootUser.id;
            setSearchQuery("");
            await fetchDirectChildren(rootUser.id, 1, "", false);
          }
          return { success: true };
        }

        if (response.navigationPath && response.navigationPath.length > 0) {
          const path = response.navigationPath.map((u) => ({
            ...u,
            hasChildren: u.directReferrals > 0,
          }));

          // Navigate INTO the found user's section (the last item in path)
          const targetUser = path[path.length - 1];

          // The full path becomes the navigation history
          setNavigationHistory(path);
          setFocusedUser(targetUser);
          currentUserIdRef.current = targetUser.id;
          setSearchQuery("");

          // Fetch the found user's children (their referrals list)
          await fetchDirectChildren(targetUser.id, 1, "", false);

          return { success: true };
        }

        setEmailSearchError("User not found in your network");
        return { error: "User not found in your network" };
      } catch (err) {
        console.error("Error searching by email:", err);
        setEmailSearchError("Search failed");
        return { error: "Search failed" };
      } finally {
        setIsEmailSearching(false);
      }
    },
    [focusedUser, navigationHistory]
  );

  // Convert children to marker data for globe (only those with valid coordinates)
  // Also include the focused user as a distinct marker
  const markersData: GlobeMarkerData[] = useMemo(() => {
    const markers: GlobeMarkerData[] = [];

    // Add focused user as a marker (if they have valid coordinates)
    if (focusedUser) {
      const focusedWithCoords = assignFallbackCoordinates(focusedUser);
      if (
        isValidCoordinate(
          focusedWithCoords.location.latitude,
          focusedWithCoords.location.longitude
        )
      ) {
        markers.push({
          id: focusedUser.id,
          name: focusedUser.name,
          avatar: focusedUser.avatar,
          latitude: focusedWithCoords.location.latitude!,
          longitude: focusedWithCoords.location.longitude!,
          directReferrals: focusedUser.directReferrals,
          hasChildren: focusedUser.hasChildren,
          userType: focusedUser.userType,
          status: focusedUser.status,
          isFocused: true,
          purchases: focusedUser.purchases,
        });
      }
    }

    // Add direct children as markers
    directChildren.forEach((child) => {
      // Ensure each child has usable coordinates (fallbacks if API omitted them)
      const childWithCoords = assignFallbackCoordinates(child);

      if (
        isValidCoordinate(
          childWithCoords.location.latitude,
          childWithCoords.location.longitude
        )
      ) {
        markers.push({
          id: childWithCoords.id,
          name: childWithCoords.name,
          avatar: childWithCoords.avatar,
          latitude: childWithCoords.location.latitude!,
          longitude: childWithCoords.location.longitude!,
          directReferrals: childWithCoords.directReferrals,
          hasChildren: childWithCoords.hasChildren,
          userType: childWithCoords.userType,
          status: childWithCoords.status,
          isFocused: false,
          purchases: childWithCoords.purchases,
        });
      }
    });

    return markers;
  }, [focusedUser, directChildren]);

  // Profile overlay functions
  const openProfileOverlay = useCallback((userId: string) => {
    window.dispatchEvent(
      new CustomEvent("affiliate-profile:open", {
        detail: { userId },
      })
    );
  }, []);

  const closeProfileOverlay = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("affiliate-profile:open", {
        detail: { userId: null },
      })
    );
  }, []);

  return {
    focusedUser,
    directChildren,
    markersData,
    navigationHistory,
    isLoading,
    isLoadingMore,
    error,
    selectUser,
    goBack,
    goToRoot,
    navigateToHistoryIndex,
    refresh: initializeWithCurrentUser,
    // Pagination
    hasMore,
    totalCount,
    loadMoreChildren,
    // Search
    searchQuery,
    searchChildren,
    // Email deep search
    searchByEmail,
    isEmailSearching,
    emailSearchError,
    // Profile overlay
    openProfileOverlay,
    closeProfileOverlay,
  };
}
