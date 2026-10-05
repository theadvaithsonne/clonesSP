// Central config for module-level RBAC.
//
// A founder can delegate admin control of individual product surfaces to
// non-founder, non-guest members. Access is binary per module: you are an
// admin of it or you are not — there is no viewer/editor tier.
//
// Adding a new module is 3 things: add it to RBAC_MODULES, add its label in
// MODULE_LABELS, and add the boolean to the modulePermissions sub-schema in
// models/user.model.ts. Everything else (routes, validation, the permission
// table) is driven off RBAC_MODULES and needs no change.

export const RBAC_MODULES = [
  "community",
  "courses",
  "live_streams",
  "digital_products",
] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];

export const MODULE_LABELS: Record<RbacModule, string> = {
  community: "Community",
  courses: "Courses",
  live_streams: "Live Streams",
  digital_products: "Digital Products",
};

/** A pending grant the member never responded to dies after this long. */
export const GRANT_TTL_MS = 24 * 60 * 60 * 1000;

export function isRbacModule(value: unknown): value is RbacModule {
  return (
    typeof value === "string" && (RBAC_MODULES as readonly string[]).includes(value)
  );
}

/** All modules off. Always build a fresh object — never share a mutable literal. */
export function emptyPermissions(): Record<RbacModule, boolean> {
  return Object.fromEntries(RBAC_MODULES.map((m) => [m, false])) as Record<
    RbacModule,
    boolean
  >;
}
