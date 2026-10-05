"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  HQOrganization,
  NewFounder,
  Stakeholder,
  HQOrganizationsResponse,
  FoundersResponse,
  StakeholdersResponse,
  CountryGroup,
  TickerMessage,
  TabType,
} from "@/components/discover/globe/types";
import {
  getCountryCode,
  isValidCoordinate,
  getEntityLocation,
} from "@/components/discover/globe/types";

interface UseGlobeDataReturn {
  hqOrganizations: HQOrganization[];
  founders: NewFounder[];
  stakeholders: Stakeholder[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getCountryGroups: (tab: TabType) => CountryGroup[];
  getTickerMessages: (tab: TabType) => TickerMessage[];
}

export function useGlobeData(): UseGlobeDataReturn {
  const [hqOrganizations, setHqOrganizations] = useState<HQOrganization[]>([]);
  const [founders, setFounders] = useState<NewFounder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [hqRes, foundersRes, stakeholdersRes] = await Promise.all([
        api<HQOrganizationsResponse>("/public/hq-organizations"),
        api<FoundersResponse>("/public/all-founders"),
        api<StakeholdersResponse>("/public/all-stakeholders"),
      ]);

      if (hqRes.success) {
        setHqOrganizations(hqRes.organizations || []);
      }
      if (foundersRes.success) {
        setFounders(foundersRes.founders || []);
      }
      if (stakeholdersRes.success) {
        setStakeholders(stakeholdersRes.stakeholders || []);
      }
    } catch (err) {
      console.error("Error fetching globe data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group entities by country
  const getCountryGroups = useCallback(
    (tab: TabType): CountryGroup[] => {
      let items: (HQOrganization | NewFounder | Stakeholder)[] = [];

      switch (tab) {
        case "hqs":
          items = hqOrganizations;
          break;
        case "founders":
          items = founders;
          break;
        case "stakeholders":
          items = stakeholders;
          break;
      }

      // Filter items with valid coordinates
      const validItems = items.filter((item) =>
        isValidCoordinate(item.latitude, item.longitude)
      );

      // Group by country
      const groups: Record<string, CountryGroup> = {};

      for (const item of validItems) {
        const country = item.country || "Unknown";
        if (!groups[country]) {
          groups[country] = {
            country,
            countryCode: getCountryCode(country),
            items: [],
          };
        }
        groups[country].items.push(item);
      }

      // Sort by country name and return as array
      return Object.values(groups).sort((a, b) =>
        a.country.localeCompare(b.country)
      );
    },
    [hqOrganizations, founders, stakeholders]
  );

  // Generate ticker messages
  const getTickerMessages = useCallback(
    (tab: TabType): TickerMessage[] => {
      const messages: TickerMessage[] = [];

      switch (tab) {
        case "hqs":
          for (const org of hqOrganizations) {
            messages.push({
              id: org._id,
              message: `${org.name} - ${getEntityLocation(org)}`,
              icon: org.icon,
              name: org.name,
              companyName: org.name,
              locationText: getEntityLocation(org),
              latitude: org.latitude,
              longitude: org.longitude,
            });
          }
          break;

        case "founders":
          for (const founder of founders) {
            const orgName =
              founder.organizations?.[0]?.organization?.name || "";
            messages.push({
              id: founder._id,
              message: `${founder.name}${orgName ? ` - ${orgName}` : ""} - ${getEntityLocation(founder)}`,
              icon: founder.profilePicture,
              name: founder.name,
              companyName: orgName || founder.name,
              locationText: getEntityLocation(founder),
              latitude: founder.latitude,
              longitude: founder.longitude,
            });
          }
          break;

        case "stakeholders":
          for (const stakeholder of stakeholders) {
            const orgName =
              stakeholder.organizations?.[0]?.organization?.name || "";
            messages.push({
              id: stakeholder._id,
              message: `${stakeholder.name}${orgName ? ` - ${orgName}` : ""} - ${getEntityLocation(stakeholder)}`,
              icon: stakeholder.profilePicture,
              name: stakeholder.name,
              companyName: orgName || stakeholder.name,
              locationText: getEntityLocation(stakeholder),
              latitude: stakeholder.latitude,
              longitude: stakeholder.longitude,
            });
          }
          break;
      }

      return messages;
    },
    [hqOrganizations, founders, stakeholders]
  );

  return {
    hqOrganizations,
    founders,
    stakeholders,
    loading,
    error,
    refetch: fetchData,
    getCountryGroups,
    getTickerMessages,
  };
}
