"use client";

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useWhitelabel } from "@/lib/hooks/useWhitelabel";
import { WhitelabelConfig } from "@/lib/whitelabel";

const WhitelabelContext = createContext<WhitelabelConfig | null>(null);

// Default Garage brand color
const DEFAULT_PRIMARY_COLOR = "#fbd10d";
// Garage's own second brand colour (globals.css --secondary), restored
// whenever the site is not white-labelled or the provider unmounts.
const DEFAULT_SECONDARY_COLOR = "#fba70a";

export function WhitelabelProvider({ children }: { children: ReactNode }) {
  const whitelabelConfig = useWhitelabel();

  // Dynamically set CSS --primary variable for whitelabel branding
  useEffect(() => {
    if (whitelabelConfig.isWhitelabel && whitelabelConfig.primaryColor) {
      document.documentElement.style.setProperty(
        "--primary",
        whitelabelConfig.primaryColor
      );
      // Several surfaces are a primary→secondary gradient (the login button
      // among them), so leaving --secondary at Garage yellow made a branded
      // site fade into someone else's colour.
      document.documentElement.style.setProperty(
        "--secondary",
        whitelabelConfig.secondaryColor || whitelabelConfig.primaryColor
      );
    } else {
      // Reset to default when not whitelabel
      document.documentElement.style.setProperty(
        "--primary",
        DEFAULT_PRIMARY_COLOR
      );
      document.documentElement.style.setProperty(
        "--secondary",
        DEFAULT_SECONDARY_COLOR
      );
    }

    // Cleanup on unmount
    return () => {
      document.documentElement.style.setProperty(
        "--primary",
        DEFAULT_PRIMARY_COLOR
      );
      document.documentElement.style.setProperty(
        "--secondary",
        DEFAULT_SECONDARY_COLOR
      );
    };
  }, [
    whitelabelConfig.isWhitelabel,
    whitelabelConfig.primaryColor,
    whitelabelConfig.secondaryColor,
  ]);

  /**
   * The office's white-label add-on has lapsed.
   *
   * The domain deliberately keeps resolving — pulling a client's public site
   * because an invoice was missed punishes their visitors rather than whoever
   * owes. So the page still loads and still carries their branding, but a
   * blocking notice sits over it and nothing underneath can be used.
   *
   * Only ever shown on a white-label domain, and only once the lookup has
   * finished: rendering it while loading would flash a lockout at every
   * visitor on every page load.
   */
  /**
   * Expired-subscription lockout — intentionally NOT rendered.
   *
   * `whitelabelActive` is still reported by the domain lookup, but nothing
   * blocks on it: no office currently holds the white-label add-on, so
   * enforcing it would black out every branded site at once — and the first
   * person to notice would be a client's customer, not us.
   *
   * Re-enable only once the add-on is actually being sold and held.
   */
  return (
    <WhitelabelContext.Provider value={whitelabelConfig}>
      {children}
    </WhitelabelContext.Provider>
  );
}

/**
 * Same as useWhitelabelContext but returns null instead of throwing when no
 * provider is present.
 *
 * Some components — the mobile app gate among them — render on routes that
 * sit outside WhitelabelProvider, including during prerender. Those callers
 * want "is this a white-label site?" as a question that may have no answer,
 * not an exception that fails the build.
 */
export function useWhitelabelOptional(): WhitelabelConfig | null {
  return useContext(WhitelabelContext);
}

export function useWhitelabelContext(): WhitelabelConfig {
  const context = useContext(WhitelabelContext);
  if (!context) {
    throw new Error(
      "useWhitelabelContext must be used within WhitelabelProvider"
    );
  }
  return context;
}
