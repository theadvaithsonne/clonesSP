"use client";

/**
 * Paints the app chrome (top tab bar, left sidebar, right panel) in the
 * office's own accent colour instead of Garage yellow.
 *
 * The colour is `branding.primaryColor` on the organization — the same value
 * the whitelabel branding step writes via PUT /org/:orgId/branding. Until now
 * that colour only applied on a custom white-label domain; this provider
 * applies it on my.garage.app too, for whichever office is currently selected.
 *
 * It writes `--brand` / `--brand-2` / `--brand-foreground` on <html>, which the
 * `brand` Tailwind colour in globals.css reads. Deliberately NOT `--primary`:
 * `.deals-primary-scope` re-points `--primary` at purple for a whole subtree
 * and the chrome must keep the office colour underneath it.
 *
 * On a white-label domain the domain lookup already knows the colours, so that
 * wins and no extra request is made.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "@/lib/api";
import { getOrgId, getToken } from "@/lib/auth";
import { useWhitelabelOptional } from "@/lib/whitelabel-context";

export const GARAGE_BRAND = "#FBD10D";
export const GARAGE_BRAND_2 = "#FBA70A";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return HEX_RE.test(withHash) ? withHash.toUpperCase() : null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

/**
 * Text colour to sit on a solid brand fill. Garage yellow takes black; a dark
 * accent (navy, maroon) would render black-on-dark and be unreadable, so the
 * label flips to white below the midpoint.
 */
function foregroundFor(hex: string): string {
  return luminance(hex) > 0.35 ? "#000000" : "#FFFFFF";
}

export interface BrandColors {
  brand: string;
  brand2: string;
  brandForeground: string;
  /** False until the office's colours have been resolved. */
  isLoaded: boolean;
}

const DEFAULTS: BrandColors = {
  brand: GARAGE_BRAND,
  brand2: GARAGE_BRAND_2,
  brandForeground: "#000000",
  isLoaded: false,
};

const BrandColorContext = createContext<BrandColors>(DEFAULTS);

/**
 * Cached per org so switching back to an office already visited in this tab
 * repaints immediately rather than flashing Garage yellow while the request
 * is in flight.
 */
const cache = new Map<string, { brand: string; brand2: string }>();

export function BrandColorProvider({ children }: { children: ReactNode }) {
  const whitelabel = useWhitelabelOptional();
  const [colors, setColors] = useState<BrandColors>(DEFAULTS);

  const apply = useCallback((brand: string, brand2: string) => {
    setColors({
      brand,
      brand2,
      brandForeground: foregroundFor(brand),
      isLoaded: true,
    });
  }, []);

  const load = useCallback(async () => {
    // A white-label domain resolved its colours from the domain lookup —
    // reuse them rather than firing a second, authenticated request that a
    // logged-out visitor could not make anyway.
    if (whitelabel?.isWhitelabel) {
      if (whitelabel.isLoading) return;
      const p = normalizeHex(whitelabel.primaryColor) || GARAGE_BRAND;
      apply(p, normalizeHex(whitelabel.secondaryColor) || p);
      return;
    }

    const orgId = getOrgId();
    if (!orgId || !getToken()) {
      apply(GARAGE_BRAND, GARAGE_BRAND_2);
      return;
    }

    const cached = cache.get(orgId);
    if (cached) apply(cached.brand, cached.brand2);

    try {
      const res = await api<{
        branding?: { primaryColor?: string; secondaryColor?: string };
      }>(`/org/${orgId}/branding`);
      const p = normalizeHex(res?.branding?.primaryColor) || GARAGE_BRAND;
      // A one-colour brand renders flat rather than blending into somebody
      // else's hue — same rule as lib/whitelabel.ts. The exception is an org
      // still on the Garage default, which keeps Garage's own second colour
      // so untouched offices look exactly as they did before.
      const s =
        normalizeHex(res?.branding?.secondaryColor) ||
        (p === GARAGE_BRAND ? GARAGE_BRAND_2 : p);
      cache.set(orgId, { brand: p, brand2: s });
      apply(p, s);
    } catch {
      // Branding is cosmetic — a read failure must never blank the chrome.
      if (!cached) apply(GARAGE_BRAND, GARAGE_BRAND_2);
    }
  }, [
    apply,
    whitelabel?.isWhitelabel,
    whitelabel?.isLoading,
    whitelabel?.primaryColor,
    whitelabel?.secondaryColor,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // Switching office, signing in and signing out all change which colours
  // apply without unmounting this provider.
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener("garage:org-change", onChange);
    window.addEventListener("garage:token-change", onChange);
    window.addEventListener("garage:logout", onChange);
    window.addEventListener("garage:branding-change", onChange);
    return () => {
      window.removeEventListener("garage:org-change", onChange);
      window.removeEventListener("garage:token-change", onChange);
      window.removeEventListener("garage:logout", onChange);
      window.removeEventListener("garage:branding-change", onChange);
    };
  }, [load]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", colors.brand);
    root.style.setProperty("--brand-2", colors.brand2);
    root.style.setProperty("--brand-foreground", colors.brandForeground);
  }, [colors]);

  return (
    <BrandColorContext.Provider value={colors}>
      {children}
    </BrandColorContext.Provider>
  );
}

export function useBrandColors(): BrandColors {
  return useContext(BrandColorContext);
}

/**
 * Tell any mounted BrandColorProvider to re-read the office's colours.
 * Call after saving branding so the chrome repaints without a reload.
 */
export function notifyBrandingChanged(orgId?: string | null) {
  if (typeof window === "undefined") return;
  if (orgId) cache.delete(orgId);
  window.dispatchEvent(new CustomEvent("garage:branding-change"));
}

/**
 * The office's accent as a plain hex string, read off the live CSS variable.
 *
 * For handing the colour to something that is not CSS — the Razorpay and
 * Stripe checkout widgets take a `theme.color` / `colorPrimary` string and
 * cannot resolve `var(--brand)` themselves.
 */
export function getBrandHex(): string {
  if (typeof window === "undefined") return GARAGE_BRAND;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--brand")
    .trim();
  return normalizeHex(v) || GARAGE_BRAND;
}
