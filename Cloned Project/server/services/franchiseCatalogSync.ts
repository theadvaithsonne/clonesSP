import mongoose, { Types } from "mongoose";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";

/**
 * Write Garage's authoritative ownership state onto the roam-admin global
 * catalog docs (`FranchiseCountry` / `FranchiseTerritory` /
 * `FranchiseSubTerritory`).
 *
 * BACKGROUND — historical two-writer split
 * ---------------------------------------
 * The catalog collections are logically owned by roam-admin-prod, which used
 * to be the ONLY writer to `ownerEmail`. When we shipped invoice-based
 * self-buy (System A) in July 2026 we kept Garage's ownership state in a
 * separate `FranchiseGlobalAssignment` collection so we wouldn't clobber
 * roam-admin's writes. That preserved the read-only contract but created a
 * divergence: entities Garage sold weren't reflected in roam-admin's UI,
 * which still reads catalog `ownerEmail` directly.
 *
 * WHY WE NOW WRITE
 * ----------------
 * Founder decision (2026-07-22): Garage is authoritative for global sales
 * going forward. Any Garage-sold entity's ownership MUST also appear on the
 * catalog doc so external consumers (roam-admin UI, and anyone reading the
 * DB directly) see the current owner without needing to consume the
 * `/franchise-api/*` endpoints.
 *
 * SEMANTICS
 * ---------
 *   activate  → set catalog `ownerEmail` = new owner's email
 *   cancel    → clear catalog `ownerEmail`
 *   lapse     → leave catalog alone (buyer might renew; commission
 *                distributor treats lapsed as "no owner" via the assignment
 *                table anyway, so catalog stays as a "recent owner" hint)
 *   resale    → set catalog `ownerEmail` = new owner's email (fresh sale)
 *
 * BEST-EFFORT
 * -----------
 * All calls are wrapped by callers in try/catch. If the catalog write fails
 * for any reason (network, model schema drift, etc.), the FULFILMENT must
 * still succeed — the buyer paid, the assignment is real. Catalog is a
 * denormalised mirror; use the backfill script to catch up.
 */

type EntityLevel = "country" | "territory" | "subTerritory";

/**
 * Set (or clear) the catalog `ownerEmail` for a given global entity.
 *
 * Passing `ownerEmail: null` clears the field. Passing a string sets it,
 * lowercased + trimmed for consistency with model definitions.
 *
 * Returns `true` if the catalog doc existed (regardless of whether the value
 * changed). Returns `false` if the doc doesn't exist (unknown entityId).
 * NEVER throws — errors are caught and logged; caller doesn't need to guard.
 */
/**
 * Collection name for each geo level. Kept in sync with the model's
 * `collection:` option.
 */
const COLLECTION_BY_LEVEL: Record<EntityLevel, string> = {
  country: "franchise_countries",
  territory: "franchise_territorymasters",
  subTerritory: "franchise_sub_territories",
};

export async function syncCatalogOwner(
  geoLevel: EntityLevel,
  geoEntityId: string,
  ownerEmail: string | null
): Promise<boolean> {
  try {
    const normalized = ownerEmail
      ? ownerEmail.trim().toLowerCase()
      : null;
    const Model =
      geoLevel === "country"
        ? FranchiseCountry
        : geoLevel === "territory"
          ? FranchiseTerritory
          : FranchiseSubTerritory;

    // Write ownerEmail AND status in the same update:
    //   set ownerEmail → status: "taken"     (owned via Garage)
    //   clear ownerEmail → status: "available"  (row is free again)
    // Catalog consumers (roam-admin UI, public franchise API) read both
    // fields — writing only ownerEmail leaves `status: "available"` stale.
    const update = normalized
      ? { $set: { ownerEmail: normalized, status: "taken" } }
      : { $set: { status: "available" }, $unset: { ownerEmail: "" } };

    // Some catalog rows have `_id: String` (legacy roam-admin seed convention);
    // others have `_id: ObjectId` (newer admin-tool inserts, e.g. Almora).
    // Try the String path first (Mongoose model, honors schema), fall back to
    // a raw driver update with the id as an ObjectId if the id is a valid
    // 24-char hex. Same tolerance pattern as `loadCatalogEntity`.
    const stringResult = await (Model as any).updateOne(
      { _id: geoEntityId },
      update,
    );
    if ((stringResult?.matchedCount ?? 0) > 0) {
      console.log(
        `[franchise-catalog-sync] ${geoLevel} ${geoEntityId} → ownerEmail=${normalized ?? "(cleared)"}, status=${normalized ? "taken" : "available"}`,
      );
      return true;
    }

    if (/^[a-f0-9]{24}$/i.test(geoEntityId)) {
      const coll = mongoose.connection.db?.collection(
        COLLECTION_BY_LEVEL[geoLevel],
      );
      if (coll) {
        const oidResult = await coll.updateOne(
          { _id: new Types.ObjectId(geoEntityId) as any },
          update,
        );
        if ((oidResult?.matchedCount ?? 0) > 0) {
          console.log(
            `[franchise-catalog-sync] ${geoLevel} ${geoEntityId} (ObjectId path) → ownerEmail=${normalized ?? "(cleared)"}, status=${normalized ? "taken" : "available"}`,
          );
          return true;
        }
      }
    }

    console.warn(
      `[franchise-catalog-sync] catalog doc not found: level=${geoLevel} id=${geoEntityId} (skipping)`,
    );
    return false;
  } catch (err) {
    console.error(
      `[franchise-catalog-sync] error syncing ${geoLevel}/${geoEntityId}:`,
      err,
    );
    return false;
  }
}
