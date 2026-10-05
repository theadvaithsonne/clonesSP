import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface ProviderKey {
  providerId: string;
  maskedKey: string;
  createdAt: string;
}

export interface AIProviderConfig {
  keys: ProviderKey[];
  selectedProvider: string | null;
  isLoading: boolean;
  hasAnyKey: boolean;
  hasProvider: (providerId: string) => boolean;
  refetch: () => Promise<void>;
  setSelectedProvider: (providerId: string) => void;
  // New fields for role-based access
  role: "founder" | "stakeholder" | null;
  isFounder: boolean;
  isStakeholder: boolean;
  availableProviders: string[];
}

const SELECTED_PROVIDER_KEY = "garage_selected_ai_provider";

export function useAIProvider(): AIProviderConfig {
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProviderState] = useState<string | null>(null);
  const [role, setRole] = useState<"founder" | "stakeholder" | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const orgId = localStorage.getItem("garage_org_id");
      const token = getToken();

      if (!orgId || !token) {
        setKeys([]);
        setRole(null);
        setAvailableProviders([]);
        return;
      }

      const res = await api<{
        keys?: ProviderKey[];
        data?: {
          keys: ProviderKey[];
          role?: string;
          hasKeys?: boolean;
          availableProviders?: string[];
        };
        role?: string;
        hasKeys?: boolean;
        availableProviders?: string[];
      }>(
        `/founder-ai-providers/keys?orgId=${orgId}`,
        {},
        token
      );

      // Handle both response formats: { keys: [...] } or { data: { keys: [...] } }
      const fetchedKeys = res.keys || res.data?.keys || [];
      const userRole = (res.role || res.data?.role || null) as "founder" | "stakeholder" | null;
      const providers = res.availableProviders || res.data?.availableProviders || fetchedKeys.map(k => k.providerId);

      setKeys(fetchedKeys);
      setRole(userRole);
      setAvailableProviders(providers);

      // Initialize selected provider from localStorage or default to first available
      const storedProvider = localStorage.getItem(SELECTED_PROVIDER_KEY);
      if (storedProvider && fetchedKeys.some(k => k.providerId === storedProvider)) {
        setSelectedProviderState(storedProvider);
      } else if (fetchedKeys.length > 0) {
        // Default priority: google-gemini > anthropic > openai
        const defaultOrder = ["google-gemini", "anthropic", "openai"];
        const defaultProvider = defaultOrder.find(p =>
          fetchedKeys.some(k => k.providerId === p)
        ) || fetchedKeys[0].providerId;
        setSelectedProviderState(defaultProvider);
        localStorage.setItem(SELECTED_PROVIDER_KEY, defaultProvider);
      }
    } catch (error) {
      console.error("Failed to fetch AI provider keys:", error);
      setKeys([]);
      setRole(null);
      setAvailableProviders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const hasProvider = useCallback((providerId: string) => {
    return keys.some(k => k.providerId === providerId);
  }, [keys]);

  const setSelectedProvider = useCallback((providerId: string) => {
    if (keys.some(k => k.providerId === providerId)) {
      setSelectedProviderState(providerId);
      localStorage.setItem(SELECTED_PROVIDER_KEY, providerId);
    }
  }, [keys]);

  return {
    keys,
    selectedProvider,
    isLoading,
    hasAnyKey: keys.length > 0,
    hasProvider,
    refetch: fetchKeys,
    setSelectedProvider,
    // Role-based access
    role,
    isFounder: role === "founder",
    isStakeholder: role === "stakeholder",
    availableProviders,
  };
}
