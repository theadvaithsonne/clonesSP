"use client";

// Shared product context for the admin observability pages — the
// NetworkChains ⇄ Garage switch. Both /admin/posthog (Replays) and /admin/sentry
// read this, so flipping it on one page carries to the other.
//
// PostHog: all products share ONE project (554016); the `apps` here are the
// `app` super-property values each product's clients register, used to filter
// recordings server-side.
// Sentry: each project carries its own `product` tag (from SENTRY_PROJECTS), and
// the page shows only the matching product's projects.
import { useEffect, useState } from "react";

export type AdminProduct =
  | "networkchains"
  | "garage"
  | "garage-store"
  | "garage-admin"
  | "garage-pay"
  | "garage-pay-seller";

// Each product's `id` must match the SENTRY_PROJECTS `@product` tag; `apps` are
// the PostHog `app` super-property values its clients register (for the Replays
// filter). Add an entry here to add a toggle. garage-store is its own product
// (tagged @garage-store), distinct from garage HQ.
export const ADMIN_PRODUCTS: {
  id: AdminProduct;
  /** Full name. Used in prose ("across the Garage Store Sentry projects"). */
  label: string;
  /**
   * Name inside the switch, where the family divider already supplies the
   * "Garage" half — repeating it in five adjacent buttons is noise, and the
   * short forms are what let six products sit in the header without crowding
   * it. Falls back to `label`.
   */
  short?: string;
  /** Groups the switch. NetworkChains is one platform; the rest are Garage. */
  family: "networkchains" | "garage";
  /**
   * Which platforms this product actually ships, when that is known and
   * settled. Controls whether the All/Web/Mobile switch is worth showing —
   * NOT how recordings are filtered (see appsFor).
   *
   * Omitted means "not stated", and every device option stays available. That
   * default is deliberate: the last per-product platform table claimed Garage
   * had no mobile client and silently returned nothing for Garage + Mobile.
   * Only fill this in for a product whose clients you can name in full.
   */
  platforms?: Exclude<AdminDevice, "all">[];
  apps: string[];
}[] = [
  {
    id: "networkchains",
    label: "NetworkChains",
    family: "networkchains",
    apps: ["nc-web", "nc-mobile"],
  },
  {
    id: "garage",
    label: "Garage",
    family: "garage",
    apps: ["garage-web", "garage-chat"],
  },
  {
    id: "garage-store",
    label: "Garage Store",
    short: "Store",
    family: "garage",
    apps: ["garage-store"],
  },
  // The three Expo apps are their own products, not Garage surfaces: each is a
  // separate audience with its own release train, and "what's wrong with the
  // seller app" is a different question from "what's wrong with Garage".
  //
  // One app each today, hence one `apps` entry — a web counterpart would just
  // be appended here. A recording whose `app` value appears in no product is
  // filtered out of EVERY tab, so a new surface has to be added alongside
  // shipping it.
  {
    id: "garage-admin",
    label: "Admin App",
    short: "Admin",
    family: "garage",
    platforms: ["web", "mobile"],
    // The console is its own surface even though it ships from the garage-web
    // repo: admin.garage.app tags `garage-admin-web`, my.garage.app tags
    // `garage-web`, so staff sessions stop landing in the Garage tab next to
    // members'.
    apps: ["garage-admin-mobile", "garage-admin-web"],
  },
  {
    id: "garage-pay",
    label: "Pay Buyer",
    short: "Buyer",
    family: "garage",
    // One Expo app, no web counterpart — so there is no device axis to offer.
    platforms: ["mobile"],
    apps: ["garage-pay-mobile"],
  },
  {
    id: "garage-pay-seller",
    label: "Pay Seller",
    short: "Seller",
    family: "garage",
    // One Expo app, no web counterpart — so there is no device axis to offer.
    platforms: ["mobile"],
    apps: ["garage-pay-seller-mobile"],
  },
];

const KEY = "nc_admin_product";
const EVT = "admin-product-changed";
const DEVICE_KEY = "nc_admin_device";
const DEVICE_EVT = "admin-device-changed";

export function getStoredProduct(): AdminProduct {
  if (typeof window === "undefined") return "networkchains";
  const v = localStorage.getItem(KEY);
  return ADMIN_PRODUCTS.some((p) => p.id === v)
    ? (v as AdminProduct)
    : "networkchains";
}

export type AdminDevice = "all" | "web" | "mobile";

export const ADMIN_DEVICES: { id: AdminDevice; label: string }[] = [
  { id: "all", label: "All" },
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
];

/** The `app` super-property values for a product (PostHog recording filter).
 *
 *  Device is deliberately NOT handled here. Narrowing by app name would mean
 *  maintaining a table of which product ships on which platform — and that
 *  table was wrong the moment it was written: it claimed Garage had no mobile
 *  client, which silently blocked Garage + Mobile entirely. The device filter
 *  uses PostHog's own `$lib` property instead, set automatically by every SDK
 *  ("web" vs "posthog-react-native"), so it needs no per-product knowledge. */
export function appsFor(product: AdminProduct): string[] {
  return ADMIN_PRODUCTS.find((p) => p.id === product)?.apps ?? [];
}

/**
 * The device options worth offering for a product.
 *
 * A product that ships on one platform has no device axis: "All" and "Mobile"
 * would mean the same list and "Web" could only ever be empty, so the switch
 * is hidden for it entirely rather than left as three buttons where two are
 * decoration and one is a dead end.
 */
export function devicesFor(product: AdminProduct): typeof ADMIN_DEVICES {
  const platforms = ADMIN_PRODUCTS.find((p) => p.id === product)?.platforms;
  if (!platforms) return ADMIN_DEVICES;
  return ADMIN_DEVICES.filter(
    (d) => d.id === "all" || platforms.includes(d.id as "web" | "mobile"),
  );
}

/** False when the product ships a single platform — hide the switch. */
export function hasDeviceChoice(product: AdminProduct): boolean {
  return devicesFor(product).length > 2;
}

/** Shared, persisted product selection. Switching on one admin page reflects on
 *  the other (via a custom event same-tab + `storage` cross-tab). */
export function useAdminProduct(): [AdminProduct, (p: AdminProduct) => void] {
  const [product, setProduct] = useState<AdminProduct>("networkchains");
  useEffect(() => {
    // Hydrate from localStorage AFTER mount — reading it in the initializer would
    // desync SSR ("networkchains") from a client that stored "garage".
    setProduct(getStoredProduct());
    const apply = () => setProduct(getStoredProduct());
    window.addEventListener("storage", apply);
    window.addEventListener(EVT, apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener(EVT, apply);
    };
  }, []);
  const set = (p: AdminProduct) => {
    localStorage.setItem(KEY, p);
    // Drop a device the new product cannot have. Otherwise picking Web on
    // Garage and then switching to Seller leaves a hidden Web filter pinned on
    // a mobile-only product: an empty list with no visible control explaining
    // it.
    if (!devicesFor(p).some((d) => d.id === localStorage.getItem(DEVICE_KEY))) {
      localStorage.setItem(DEVICE_KEY, "all");
      window.dispatchEvent(new CustomEvent(DEVICE_EVT));
    }
    setProduct(p);
    window.dispatchEvent(new CustomEvent(EVT));
  };
  return [product, set];
}

/**
 * Clamped against the current product: a device left over from a product that
 * had the axis would otherwise filter a single-platform product down to
 * nothing — the switch is hidden there, so nobody could see why the list was
 * empty, let alone fix it.
 */
function getStoredDevice(): AdminDevice {
  if (typeof window === "undefined") return "all";
  const v = localStorage.getItem(DEVICE_KEY);
  const stored = devicesFor(getStoredProduct()).some((d) => d.id === v)
    ? (v as AdminDevice)
    : "all";
  return stored;
}

/** Shared, persisted device selection — same plumbing as useAdminProduct so the
 *  choice survives a reload and stays in step across tabs. */
export function useAdminDevice(): [AdminDevice, (d: AdminDevice) => void] {
  const [device, setDevice] = useState<AdminDevice>("all");
  useEffect(() => {
    // Hydrated after mount, like the product hook: reading localStorage in the
    // initializer would desync SSR ("all") from a client that stored "mobile".
    setDevice(getStoredDevice());
    const apply = () => setDevice(getStoredDevice());
    window.addEventListener("storage", apply);
    window.addEventListener(DEVICE_EVT, apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener(DEVICE_EVT, apply);
    };
  }, []);
  const set = (d: AdminDevice) => {
    localStorage.setItem(DEVICE_KEY, d);
    setDevice(d);
    window.dispatchEvent(new CustomEvent(DEVICE_EVT));
  };
  return [device, set];
}
