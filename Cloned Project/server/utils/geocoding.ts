export const getCoordinatesFromAddress = async (addressComponents: {
  streetAddress?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> => {
  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  // ── Tier 1: Google Geocoding (if key is configured) ──────────────────────
  if (GOOGLE_API_KEY) {
    try {
      console.log("Getting coordinates from Google for:", addressComponents);

      const fullAddress = [
        addressComponents.streetAddress,
        addressComponents.city,
        addressComponents.state,
        addressComponents.country,
        addressComponents.postalCode,
      ]
        .filter(Boolean)
        .join(", ");

      const encodedAddress = encodeURIComponent(fullAddress);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          const coordinates = {
            latitude: location.lat,
            longitude: location.lng,
          };
          if (!isNaN(coordinates.latitude) && !isNaN(coordinates.longitude)) {
            console.log("Successfully obtained coordinates from Google:", coordinates);
            return coordinates;
          }
        } else {
          console.warn(`[getCoordinatesFromAddress] Google returned ${data.status} for "${fullAddress}"`);
        }
      }
    } catch (error) {
      console.warn("[getCoordinatesFromAddress] Google Geocoding error:", error);
    }
  }

  // ── Tier 2: Postal Code resolution (Zippopotam / India Post) ─────────────
  if (addressComponents.postalCode?.trim()) {
    try {
      const resolved = await resolvePostalCode(
        addressComponents.postalCode.trim(),
        addressComponents.country
      );
      if (
        resolved &&
        typeof resolved.latitude === "number" &&
        typeof resolved.longitude === "number" &&
        (resolved.latitude !== 0 || resolved.longitude !== 0)
      ) {
        const coords = { latitude: resolved.latitude, longitude: resolved.longitude };
        console.log("Successfully obtained coordinates from postal code:", coords);
        return coords;
      }
    } catch (err) {
      console.warn("[getCoordinatesFromAddress] Postal code fallback tier failed:", err);
    }
  }

  // ── Tier 3: OpenStreetMap Nominatim (keyless, worldwide) ───────────────────
  try {
    const rawCity = addressComponents.city || "";
    const baseCity = rawCity.split(
      /\s+(North|South|East|West|Northeast|Northwest|Southeast|Southwest)/i
    )[0].trim();

    const candidateQueries = [
      [addressComponents.streetAddress, addressComponents.city, addressComponents.state, addressComponents.country]
        .filter(Boolean)
        .join(", "),
      [addressComponents.city, addressComponents.state, addressComponents.country]
        .filter(Boolean)
        .join(", "),
      baseCity && baseCity !== rawCity
        ? [baseCity, addressComponents.state, addressComponents.country].filter(Boolean).join(", ")
        : "",
      [addressComponents.city, addressComponents.country].filter(Boolean).join(", "),
    ].filter((q, i, arr): q is string => Boolean(q) && arr.indexOf(q) === i);

    for (const query of candidateQueries) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GarageApp-Geocoding/1.0",
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            const coords = { latitude: lat, longitude: lon };
            console.log(`Successfully obtained coordinates from Nominatim ("${query}"):`, coords);
            return coords;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[getCoordinatesFromAddress] Nominatim fallback tier failed:", err);
  }

  return null;
};

/**
 * Best-effort ISO 3166-1 alpha-2 for a country as the UI supplies it.
 *
 * The profile / org popovers send a country NAME ("United States") because
 * they're driven by the `country-state-city` package on the frontend, but the
 * postal-code providers want a 2-letter code. Covers the countries we actually
 * see plus a pass-through for anything already in alpha-2 form.
 */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  india: "IN",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  canada: "CA",
  "united kingdom": "GB",
  "great britain": "GB",
  uk: "GB",
  australia: "AU",
  germany: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  "new zealand": "NZ",
  singapore: "SG",
  "south africa": "ZA",
  mexico: "MX",
  brazil: "BR",
  japan: "JP",
  switzerland: "CH",
  "united arab emirates": "AE",
  uae: "AE",
};

export function countryToIso2(country?: string | null): string | undefined {
  const raw = String(country ?? "").trim();
  if (!raw) return undefined;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_ISO2[raw.toLowerCase()];
}

/**
 * Guess the country from the shape of the code when the caller didn't tell us.
 * Only used as a hint for the keyless provider, which needs a country in the
 * path — a wrong guess just means that tier misses and we fall through.
 */
function guessIso2FromCodeShape(code: string): string[] {
  const c = code.trim().toUpperCase();
  if (/^\d{6}$/.test(c)) return ["IN"];
  if (/^\d{5}(-\d{4})?$/.test(c)) return ["US"];
  // Canadian: full "M5V 3A8" or just the FSA "M5V".
  if (/^[A-Z]\d[A-Z]( ?\d[A-Z]\d)?$/.test(c)) return ["CA"];
  if (/^[A-Z]{1,2}\d[A-Z\d]?( ?\d[A-Z]{2})?$/.test(c)) return ["GB"];
  if (/^\d{4}$/.test(c)) return ["AU", "NZ", "ZA"];
  return [];
}

/**
 * Normalise a postal code for the keyless provider, which indexes Canada by
 * the 3-character Forward Sortation Area rather than the full 6-character
 * code ("M5V 3A8" is not a key; "M5V" is).
 */
function normalizeForZippopotam(code: string, iso2: string): string {
  const c = code.trim().toUpperCase();
  if (iso2 === "CA") return c.replace(/\s+/g, "").slice(0, 3);
  if (iso2 === "GB") return c.replace(/\s+/g, "").slice(0, 4);
  if (iso2 === "US") return c.slice(0, 5);
  return c;
}

export const resolvePostalCode = async (
  postalCode: string,
  country?: string
): Promise<{
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
} | null> => {
  const code = postalCode.trim();
  const iso2 = countryToIso2(country);

  // ── Tier 1: Google Maps Geocoding ──────────────────────────────────
  // Best quality when a key is configured, but it is NOT the safety net —
  // see Tier 2. Historically this was the only worldwide tier, and when the
  // key stopped working every non-Indian postal code silently 404'd while
  // India kept working off its own fallbacks. Failures are logged now.
  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_API_KEY) {
    console.warn(
      "[resolvePostalCode] GOOGLE_MAPS_API_KEY not set — skipping Google tier"
    );
  }
  try {
    if (!GOOGLE_API_KEY) throw new Error("no-key");

    // `components` biases the lookup to the country the user actually picked.
    // Without it a bare 5-digit code is ambiguous across several countries.
    const components = [
      iso2 ? `country:${iso2}` : "",
      `postal_code:${code}`,
    ]
      .filter(Boolean)
      .join("|");

    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(code)}` +
      `&components=${encodeURIComponent(components)}` +
      `&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.status !== "OK") {
        // REQUEST_DENIED / OVER_QUERY_LIMIT / ZERO_RESULTS — previously
        // swallowed, which is why a dead key went unnoticed.
        console.warn(
          `[resolvePostalCode] Google returned ${data.status} for "${code}"` +
            `${data.error_message ? `: ${data.error_message}` : ""}`
        );
      }
      if (data.status === "OK" && data.results?.length > 0) {
        const result = data.results[0];
        const components = result.address_components;

        let city = "";
        let state = "";
        let country = "";

        for (const comp of components) {
          if (comp.types.includes("locality")) {
            city = comp.long_name;
          } else if (comp.types.includes("administrative_area_level_2") && !city) {
            city = comp.long_name;
          } else if (comp.types.includes("administrative_area_level_1")) {
            state = comp.long_name;
          } else if (comp.types.includes("country")) {
            country = comp.long_name;
          }
        }

        const { lat, lng } = result.geometry.location;
        if (city || state || country) {
          return { city, state, country, latitude: lat, longitude: lng };
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.message !== "no-key") {
      console.warn(`[resolvePostalCode] Google tier failed for "${code}":`, err);
    }
    // fall through to next tier
  }

  // ── Tier 2: India-specific tiers ───────────────────────────────────
  // Run BEFORE the generic worldwide provider for Indian PINs: India Post
  // returns the district ("Bangalore"), whereas the generic provider returns
  // the individual post-office locality ("Rajbhavan"). Keeping this order
  // means existing Indian lookups return exactly what they always have.
  const looksIndian = /^\d{6}$/.test(code);
  if (looksIndian && (!iso2 || iso2 === "IN")) {
    const indian = await resolveIndianPin(code);
    if (indian) return indian;
  }

  // ── Tier 3: Zippopotam (keyless, worldwide) ────────────────────────
  // The safety net for every country. No API key, so it can't be taken out
  // by a credential problem the way the Google tier was. Needs a country in
  // the path — we use the one the caller passed, else infer from the code's
  // shape, else skip.
  const iso2Candidates = iso2 ? [iso2] : guessIso2FromCodeShape(code);
  for (const candidate of iso2Candidates) {
    try {
      const lookup = normalizeForZippopotam(code, candidate);
      const res = await fetch(
        `https://api.zippopotam.us/${candidate.toLowerCase()}/${encodeURIComponent(lookup)}`
      );
      if (!res.ok) continue; // 404 = not a valid code for this country
      const data: any = await res.json();
      const place = data?.places?.[0];
      if (!place) continue;
      // Canadian FSAs come back as "Downtown Toronto (CN Tower / King and
      // Spadina / Railway Lands / …)" — every neighbourhood in the sorting
      // area. Keep the leading place name; the parenthetical is unusable in
      // a city field.
      const placeName = String(place["place name"] || "").split(" (")[0].trim();
      return {
        city: placeName,
        state: place["state"] || "",
        country: data.country || "",
        latitude: Number(place.latitude) || 0,
        longitude: Number(place.longitude) || 0,
      };
    } catch (err) {
      console.warn(
        `[resolvePostalCode] Zippopotam tier failed for "${code}" (${candidate}):`,
        err
      );
    }
  }

  return null;
};

/**
 * India-only lookup: India Post first, then our own PincodeData collection.
 * Both return lat/lng 0 — they're address resolvers, not geocoders.
 */
async function resolveIndianPin(code: string): Promise<{
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
} | null> {
  // ── India Post API ─────────────────────────────────────────────────
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        return {
          city: po.District || po.Division || "",
          state: po.State || "",
          country: po.Country || "India",
          latitude: 0,
          longitude: 0,
        };
      }
    }
  } catch {
    // fall through to next tier
  }

  // ── PincodeData MongoDB collection ─────────────────────────────────
  try {
    const { PincodeData } = await import("../models/pincodeData.model");

    // Exact match first, then 4-digit prefix, then 3-digit prefix
    const doc =
      (await PincodeData.findOne({ code }).lean()) ||
      (await PincodeData.findOne({ prefix4: code.slice(0, 4) }).lean()) ||
      (await PincodeData.findOne({ prefix3: code.slice(0, 3) }).lean());

    if (doc) {
      return {
        city: (doc as any).city,
        state: (doc as any).state,
        country: (doc as any).country,
        latitude: 0,
        longitude: 0,
      };
    }
  } catch (error) {
    console.error("PincodeData DB lookup error:", error);
  }

  return null;
}
