"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Vacancy } from "../types";

export function useVacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVacancies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api<{ vacancies: Vacancy[] }>(
        "/careers/vacancies"
      );
      setVacancies(response.vacancies);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch vacancies"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const createVacancy = useCallback(
    async (data: Omit<Vacancy, "_id" | "orgId" | "createdAt" | "updatedAt">) => {
      try {
        setError(null);
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected");
          return;
        }

        const response = await api<{ vacancy: Vacancy }>(
          `/careers/vacancies?orgId=${orgId}`,
          {
            method: "POST",
            body: JSON.stringify(data),
          }
        );
        setVacancies((prev) => [response.vacancy, ...prev]);
        return response.vacancy;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create vacancy"
        );
        throw err;
      }
    },
    []
  );

  const updateVacancy = useCallback(
    async (id: string, data: Partial<Vacancy>) => {
      try {
        setError(null);
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected");
          return;
        }

        const response = await api<{ vacancy: Vacancy }>(
          `/careers/vacancies/${id}?orgId=${orgId}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );
        setVacancies((prev) =>
          prev.map((v) => (v._id === id ? response.vacancy : v))
        );
        return response.vacancy;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update vacancy"
        );
        throw err;
      }
    },
    []
  );

  const deleteVacancy = useCallback(async (id: string) => {
    try {
      setError(null);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      await api(`/careers/vacancies/${id}?orgId=${orgId}`, {
        method: "DELETE",
      });
      setVacancies((prev) => prev.filter((v) => v._id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete vacancy"
      );
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  return {
    vacancies,
    loading,
    error,
    createVacancy,
    updateVacancy,
    deleteVacancy,
    refetch: fetchVacancies,
  };
}
