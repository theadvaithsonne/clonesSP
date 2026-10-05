"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Application } from "../types";

interface ApplicationFilters {
  vacancyId?: string;
  status?: string;
}

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(
    async (filters?: ApplicationFilters) => {
      try {
        setLoading(true);
        setError(null);
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected");
          return;
        }

        const params = new URLSearchParams({ orgId });
        if (filters?.vacancyId) params.set("vacancyId", filters.vacancyId);
        if (filters?.status) params.set("status", filters.status);

        const response = await api<{ applications: Application[] }>(
          `/careers/applications?${params.toString()}`
        );
        setApplications(response.applications);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch applications"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateApplicationStatus = useCallback(
    async (id: string, status: Application["status"]) => {
      try {
        setError(null);
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected");
          return;
        }

        const response = await api<{ application: Application }>(
          `/careers/applications/${id}?orgId=${orgId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          }
        );
        setApplications((prev) =>
          prev.map((a) => (a._id === id ? response.application : a))
        );
        return response.application;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update application status"
        );
        throw err;
      }
    },
    []
  );

  return {
    applications,
    loading,
    error,
    fetchApplications,
    updateApplicationStatus,
  };
}
