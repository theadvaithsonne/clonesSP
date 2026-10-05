import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface DynamicEmailItem {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface EmailSectionItem {
  key: string;
  title: string;
  description: string;
}

export interface EmailSection {
  id: string;
  title: string;
  items: EmailSectionItem[];
}

export interface Settings {
  emailPreferences: Record<string, boolean>;
  officeDynamicEmails: DynamicEmailItem[];
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent double-init on strict mode / concurrent renders
  const initializingRef = useRef(false);
  // Prevent fetch if unmounted
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initSettings = useCallback(async (): Promise<Settings | null> => {
    // Guard against concurrent init calls
    if (initializingRef.current) return null;
    initializingRef.current = true;

    try {
      const response = await api<{ data: Settings }>(`/settings`, {
        method: "POST",
      });
      if (mountedRef.current) {
        setSettings(response.data);
      }
      return response.data;
    } catch (err: any) {
      // 409 = settings already exist (race condition), fetch instead
      if (err?.status === 409 || err?.statusCode === 409) {
        try {
          const response = await api<{ data: Settings }>(`/settings`);
          if (mountedRef.current) setSettings(response.data);
          return response.data;
        } catch {
          return null;
        }
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to create settings");
      }
      return null;
    } finally {
      initializingRef.current = false;
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const response = await api<{ data: Settings | null }>(`/settings`);

      if (!mountedRef.current) return;

      // Backend auto-creates on GET, but if somehow data is null — init explicitly
      if (!response.data) {
        await initSettings();
        return;
      }

      setSettings(response.data);
    } catch (err: any) {
      if (!mountedRef.current) return;

      // 404 = new user, no settings doc yet — auto-create
      if (err?.status === 404 || err?.statusCode === 404) {
        await initSettings();
        return;
      }

      // 401 = not authenticated, don't show generic error
      if (err?.status === 401 || err?.statusCode === 401) {
        return;
      }

      setError(err instanceof Error ? err.message : "Failed to fetch settings");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [initSettings]);

  const updateEmailPreferences = useCallback(
    async (emailPreferences: Record<string, boolean>) => {
      if (!mountedRef.current) return;

      try {
        setUpdating(true);
        setError(null);

        const response = await api<{ data: Settings }>(`/settings`, {
          method: "PATCH",
          body: JSON.stringify({ emailPreferences }),
        });

        if (mountedRef.current) setSettings(response.data);
        return response.data;
      } catch (err: any) {
        if (!mountedRef.current) return;

        // If settings don't exist yet, init first then retry
        if (err?.status === 404 || err?.statusCode === 404) {
          await initSettings();
          return updateEmailPreferences(emailPreferences);
        }

        setError(err instanceof Error ? err.message : "Failed to update email preferences");
        throw err;
      } finally {
        if (mountedRef.current) setUpdating(false);
      }
    },
    [initSettings]
  );

  const updateOfficeDynamicEmails = useCallback(
    async (officeDynamicEmails: DynamicEmailItem[]) => {
      if (!mountedRef.current) return;

      try {
        setUpdating(true);
        setError(null);

        const response = await api<{ data: Settings }>(`/settings`, {
          method: "PATCH",
          body: JSON.stringify({ officeDynamicEmails }),
        });

        if (mountedRef.current) setSettings(response.data);
        return response.data;
      } catch (err: any) {
        if (!mountedRef.current) return;

        if (err?.status === 404 || err?.statusCode === 404) {
          await initSettings();
          return updateOfficeDynamicEmails(officeDynamicEmails);
        }

        setError(err instanceof Error ? err.message : "Failed to update dynamic emails");
        throw err;
      } finally {
        if (mountedRef.current) setUpdating(false);
      }
    },
    [initSettings]
  );

  const toggleEmailPreference = useCallback(
    async (key: string, enabled: boolean) => {
      if (!settings) return;

      // Snapshot for revert
      const previousSettings = settings;

      // Optimistic update
      setSettings((prev) =>
        prev
          ? { ...prev, emailPreferences: { ...prev.emailPreferences, [key]: enabled } }
          : prev
      );

      try {
        setUpdating(true);
        setError(null);

        const response = await api<{ data: Settings }>(`/settings`, {
          method: "PATCH",
          body: JSON.stringify({ emailPreferences: { [key]: enabled } }),
        });

        if (mountedRef.current) setSettings(response.data);
        return response.data;
      } catch (err: any) {
        if (!mountedRef.current) return;

        // Revert to snapshot, not just flipping the bool
        setSettings(previousSettings);

        // If settings don't exist yet, init and retry
        if (err?.status === 404 || err?.statusCode === 404) {
          await initSettings();
          return toggleEmailPreference(key, enabled);
        }

        setError(err instanceof Error ? err.message : "Failed to toggle preference");
        throw err;
      } finally {
        if (mountedRef.current) setUpdating(false);
      }
    },
    [settings, initSettings]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    updating,
    error,
    initSettings,
    updateEmailPreferences,
    updateOfficeDynamicEmails,
    toggleEmailPreference,
    refetch: fetchSettings,
  };
}