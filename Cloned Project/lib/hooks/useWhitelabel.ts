"use client";

import { useState, useEffect } from "react";
import {
  WhitelabelConfig,
  getCurrentDomain,
  isWhitelabelDomain,
  fetchWhitelabelOrg,
} from "@/lib/whitelabel";

const DEFAULT_CONFIG: WhitelabelConfig = {
  isWhitelabel: false,
  domain: "",
  orgId: null,
  orgName: null,
  orgIcon: null,
  primaryColor: "#FBD10D",
  secondaryColor: "#FBD10D",
  coverPhoto: null,
  whitelabelActive: true,
  isLoading: true,
  error: null,
};

export function useWhitelabel(): WhitelabelConfig {
  const [config, setConfig] = useState<WhitelabelConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    async function detectWhitelabel() {
      const domain = getCurrentDomain();

      if (!isWhitelabelDomain(domain)) {
        setConfig({
          ...DEFAULT_CONFIG,
          domain,
          isLoading: false,
        });
        return;
      }

      // This is a whitelabel domain - fetch org data
      const orgData = await fetchWhitelabelOrg(domain);

      if (!orgData) {
        setConfig({
          ...DEFAULT_CONFIG,
          domain,
          isWhitelabel: true,
          isLoading: false,
          error: "Failed to fetch organization data for this domain",
        });
        return;
      }

      setConfig({
        isWhitelabel: true,
        domain,
        orgId: orgData.orgId,
        orgName: orgData.orgName,
        orgIcon: orgData.orgIcon,
        primaryColor: orgData.primaryColor,
        secondaryColor: orgData.secondaryColor,
        coverPhoto: orgData.coverPhoto,
        whitelabelActive: orgData.whitelabelActive,
        isLoading: false,
        error: null,
      });
    }

    detectWhitelabel();
  }, []); // Empty deps - fetch fresh on each page load

  return config;
}
