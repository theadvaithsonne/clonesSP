"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import { getUserData } from "@/utils/api";
import { toast } from "sonner";
import Cookies from "js-cookie";

interface Lead {
  _id: string;
  leadName: string;
  estimatedValue?: number;
  stage?: string;
  source?: string;
  createdAt: string;
  assignedTo?: string;
}

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  checkInterval: number; // in milliseconds
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  inAppEnabled: true,
  checkInterval: 30000, // 30 seconds
};

export function useLeadNotifications() {
  const [lastCheckedLeadId, setLastCheckedLeadId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("leadNotificationPreferences");
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading notification preferences:", e);
      }
    }

    const storedLastId = localStorage.getItem("lastCheckedLeadId");
    if (storedLastId) {
      setLastCheckedLeadId(storedLastId);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = (newPreferences: NotificationPreferences) => {
    setPreferences(newPreferences);
    localStorage.setItem("leadNotificationPreferences", JSON.stringify(newPreferences));
  };

  // Check for new leads
  const checkForNewLeads = async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const userData = getUserData();
      if (!userData) {
        isCheckingRef.current = false;
        return;
      }

      // Fetch the most recent leads
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/leads?skip=0&limit=10&sort=-createdAt"),
        { method: "GET" }
      );

      if (!response.ok) {
        isCheckingRef.current = false;
        return;
      }

      const data = await response.json();
      const leads: Lead[] = data.leads || data.data || [];

      if (leads.length === 0) {
        isCheckingRef.current = false;
        return;
      }

      // Get the most recent lead
      const mostRecentLead = leads[0];

      // If we have a last checked ID, find new leads
      if (lastCheckedLeadId) {
        // Check if the most recent lead is new
        if (mostRecentLead._id !== lastCheckedLeadId) {
          // Find all new leads since last check
          const lastCheckedIndex = leads.findIndex((l) => l._id === lastCheckedLeadId);
          const newLeadsSinceLastCheck = lastCheckedIndex >= 0 
            ? leads.slice(0, lastCheckedIndex)
            : [mostRecentLead];

          // Notify about each new lead (in reverse order to show newest first)
          for (const lead of newLeadsSinceLastCheck.reverse()) {
            await notifyNewLead(lead);
          }
        }
      } else {
        // First time checking - just store the ID, don't notify
        if (mostRecentLead._id) {
          setLastCheckedLeadId(mostRecentLead._id);
          localStorage.setItem("lastCheckedLeadId", mostRecentLead._id);
        }
      }

      // Update last checked ID
      if (mostRecentLead._id) {
        setLastCheckedLeadId(mostRecentLead._id);
        localStorage.setItem("lastCheckedLeadId", mostRecentLead._id);
      }
    } catch (error) {
      console.error("Error checking for new leads:", error);
    } finally {
      isCheckingRef.current = false;
    }
  };

  // Send notification for a new lead
  const notifyNewLead = async (lead: Lead) => {
    const userData = getUserData();
    if (!userData) return;

    // In-app notification
    if (preferences.inAppEnabled) {
      toast.success("New Lead Received!", {
        description: `${lead.leadName} - ${lead.source || "New lead"}`,
        duration: 5000,
        action: {
          label: "View",
          onClick: () => {
            window.location.href = `/deals/leads/${lead._id}`;
          },
        },
      });
    }

    // Email notification
    if (preferences.emailEnabled && userData.email) {
      try {
        await sendLeadNotificationEmail({
          to: userData.email,
          leadName: lead.leadName,
          estimatedValue: lead.estimatedValue || 0,
          stage: lead.stage || "Prospects",
          source: lead.source || "Unknown",
          leadId: lead._id,
          userName: userData.name || userData.firstName || "User",
        });
      } catch (error) {
        console.error("Error sending email notification:", error);
      }
    }
  };

  // Send email notification
  const sendLeadNotificationEmail = async ({
    to,
    leadName,
    estimatedValue,
    stage,
    source,
    leadId,
    userName,
  }: {
    to: string;
    leadName: string;
    estimatedValue: number;
    stage: string;
    source: string;
    leadId: string;
    userName: string;
  }) => {
    try {
      const response = await fetch("/api/notifications/lead-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          leadName,
          estimatedValue,
          stage,
          source,
          leadId,
          userName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send email notification");
      }
    } catch (error) {
      console.error("Error sending lead notification email:", error);
      throw error;
    }
  };

  // Start polling for new leads
  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!isEnabled || !preferences.inAppEnabled) {
      return;
    }

    // Initial check
    checkForNewLeads();

    // Set up interval
    intervalRef.current = setInterval(() => {
      checkForNewLeads();
    }, preferences.checkInterval);
  };

  // Stop polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Effect to start/stop polling
  useEffect(() => {
    if (isEnabled && preferences.inAppEnabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, preferences.checkInterval, preferences.inAppEnabled]);

  // Test notification function
  const testNotification = async () => {
    const userData = getUserData();
    if (!userData) {
      toast.error("User not logged in");
      return;
    }

    // Create a mock lead for testing
    const mockLead: Lead = {
      _id: `test-${Date.now()}`,
      leadName: "Test Lead (Notification Test)",
      estimatedValue: 200000,
      stage: "Prospects",
      source: "Test",
      createdAt: new Date().toISOString(),
      assignedTo: userData.userId || userData.id,
    };

    await notifyNewLead(mockLead);
    toast.success("Test notification sent! Check for toast and email.");
  };

  return {
    isEnabled,
    setIsEnabled,
    preferences,
    setPreferences: savePreferences,
    checkForNewLeads,
    startPolling,
    stopPolling,
    testNotification,
  };
}

