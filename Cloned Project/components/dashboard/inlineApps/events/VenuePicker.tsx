"use client";

// Venue details with a real, interactive map.
//
// The map is the primary input, not decoration: searching, clicking the map,
// dragging the pin or hitting "Use my location" all reverse-geocode and fill
// the address fields, and editing the fields by hand re-locates the pin.
// Whatever the founder ends up with, `coordinates` is saved alongside the text
// — the public page and the directions link both read it.
//
// Two locate buttons, deliberately: "Use my location" asks the DEVICE where it
// is, "Locate from address" geocodes the fields above. They were one button
// once, which answered neither question well.
//
// Uses the Mapbox token the globe views already ship with
// (NEXT_PUBLIC_MAPBOX_TOKEN). With no token the component degrades to plain
// address fields rather than breaking the wizard.

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { GOLD } from "./ui";

export interface VenueValue {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
}

interface Suggestion {
  id: string;
  label: string;
  context: string;
  center: [number, number];
  parsed: Omit<VenueValue, "coordinates">;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GEOCODE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

/** Sensible opening view when nothing is picked yet: the whole world. */
const DEFAULT_CENTER: [number, number] = [10, 25];
const DEFAULT_ZOOM = 1.4;

/**
 * Flatten a Mapbox feature into our venue shape.
 *
 * `context` is an ordered array of parent places whose ids are prefixed by
 * type (`place.123`, `region.456`), which is the only reliable way to tell a
 * city from a state — the array positions are not stable.
 */
function parseFeature(f: any): Omit<VenueValue, "coordinates"> {
  const ctx: any[] = f.context || [];
  const byType = (type: string) =>
    ctx.find((c) => String(c.id).startsWith(`${type}.`))?.text || "";

  // POIs carry their own name; a plain address does not.
  const isPoi = String(f.id).startsWith("poi.");
  const streetLine =
    f.properties?.address && f.text
      ? `${f.properties.address} ${f.text}`
      : f.address && f.text
        ? `${f.address} ${f.text}`
        : isPoi
          ? byType("address") || ""
          : f.text || "";

  return {
    name: isPoi ? f.text || "" : "",
    addressLine1: streetLine,
    city: byType("place") || byType("locality") || "",
    state: byType("region"),
    postcode: byType("postcode"),
    country: byType("country"),
  };
}

/** Founder-form field chrome, identical to Create Product / Create Community. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1A1A1A] border border-[#262626] text-white text-sm h-10 rounded-lg px-3 outline-none focus:border-brand/50 placeholder:text-zinc-600"
      />
    </div>
  );
}

export default function VenuePicker({
  value,
  onChange,
}: {
  value: VenueValue;
  onChange: (next: VenueValue) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  // The silent auto-locate is a once-per-mount thing; a founder who then
  // clears the pin on purpose should not have it put back.
  const autoLocatedRef = useRef(false);

  // `onChange` is usually an inline arrow, so it is a new identity every
  // render. Held in a ref so the map effects can call it without re-running
  // and tearing the map down on every keystroke.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  // ── Reverse geocode: a point on the map becomes an address ─────────────
  const applyPoint = useCallback(async (lng: number, lat: number) => {
    const current = valueRef.current;
    // Write the coordinates immediately — even if the reverse lookup fails,
    // the pin the founder placed is the truth for the directions link.
    onChangeRef.current({ ...current, coordinates: { lat, lng } });
    if (!MAPBOX_TOKEN) return;

    try {
      const res = await fetch(
        `${GEOCODE}/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place&limit=1`
      );
      const data = await res.json();
      const f = data?.features?.[0];
      if (!f) return;
      const parsed = parseFeature(f);
      const latest = valueRef.current;
      onChangeRef.current({
        ...latest,
        // Never clobber a venue name the founder typed themselves.
        name: latest.name || parsed.name,
        addressLine1: parsed.addressLine1 || latest.addressLine1,
        city: parsed.city || latest.city,
        state: parsed.state || latest.state,
        postcode: parsed.postcode || latest.postcode,
        country: parsed.country || latest.country,
        coordinates: { lat, lng },
      });
    } catch {
      // Offline or rate-limited — the coordinates above still stand.
    }
  }, []);

  /**
   * Drop the pin on the device's own position.
   *
   * `silent` is for the automatic run on open: no toasts, because a founder
   * who never asked to be located should not be told that locating them
   * failed. The interactive button is never silent — a dead-looking button is
   * exactly the bug this is fixing.
   */
  const locateMe = useCallback(
    (opts?: { silent?: boolean }) =>
      new Promise<void>((resolve) => {
        const silent = !!opts?.silent;
        const fail = (message: string) => {
          if (!silent) toast.error(message);
          setGeoLocating(false);
          resolve();
        };

        if (typeof navigator === "undefined" || !navigator.geolocation) {
          fail("This browser can't share a location. Click the map instead.");
          return;
        }
        // Chrome and Safari refuse geolocation outside a secure context, and
        // do it by never calling either callback on some versions — check up
        // front so the button reports the real reason.
        if (typeof window !== "undefined" && !window.isSecureContext) {
          fail("Location needs an https page. Click the map to place the pin.");
          return;
        }

        setGeoLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            // Writes the coordinates and reverse-geocodes the address fields.
            void applyPoint(longitude, latitude);
            mapRef.current?.flyTo({
              center: [longitude, latitude],
              zoom: 16,
              duration: 900,
            });
            if (!silent) toast.success("Pin moved to your location");
            setGeoLocating(false);
            resolve();
          },
          (err) => {
            fail(
              err.code === err.PERMISSION_DENIED
                ? "Location is blocked for this site — allow it in your browser's address bar, or click the map."
                : "Could not get your location. Click the map to place the pin."
            );
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 }
        );
      }),
    [applyPoint]
  );

  // ── Automatic locate on open ───────────────────────────────────────────
  //
  // Only when permission was ALREADY granted. Firing getCurrentPosition
  // unprompted would throw a browser permission dialog at a founder halfway
  // through typing an event name, and a denial there is remembered — it would
  // break the button permanently to save one click.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapReady || autoLocatedRef.current) return;
    const current = valueRef.current;
    // Never override a pin or an address the founder already has.
    if (current.coordinates || current.addressLine1?.trim() || current.city?.trim())
      return;

    autoLocatedRef.current = true;
    const permissions = (navigator as any)?.permissions;
    if (!permissions?.query) return;
    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status: any) => {
        if (status.state === "granted") void locateMe({ silent: true });
      })
      .catch(() => {
        // Permissions API unsupported (older Safari). The button still works.
      });
  }, [mapReady, locateMe]);

  // ── Map bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const start = valueRef.current.coordinates;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: start ? [start.lng, start.lat] : DEFAULT_CENTER,
      zoom: start ? 15 : DEFAULT_ZOOM,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapReady(true));

    // Click anywhere to drop / move the pin.
    map.on("click", (e) => {
      void applyPoint(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, [applyPoint]);

  // ── Keep the marker in sync with the value ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const c = value.coordinates;

    if (!c) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ color: "#ef4444", draggable: true })
        .setLngLat([c.lng, c.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        void applyPoint(lng, lat);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([c.lng, c.lat]);
    }

    // A pin set from outside the map — an event being edited, the geolocate
    // button, a typed address — used to land wherever the viewport happened
    // to be, which is how you get a pin on Bengaluru while the map shows half
    // of south India. Only moves when the point is actually off-screen, so it
    // never fights a founder who has panned deliberately.
    if (!map.getBounds()?.contains([c.lng, c.lat])) {
      map.easeTo({
        center: [c.lng, c.lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: 600,
      });
    }
  }, [value.coordinates, mapReady, applyPoint]);

  // ── Forward search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${GEOCODE}/${encodeURIComponent(
            query.trim()
          )}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place&limit=5`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setSuggestions(
          (data?.features || []).map((f: any) => ({
            id: f.id,
            label: f.text,
            context: f.place_name,
            center: f.center,
            parsed: parseFeature(f),
          }))
        );
      } catch {
        // Aborted or failed — leave the previous list alone.
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  function choose(s: Suggestion) {
    const [lng, lat] = s.center;
    onChange({
      ...value,
      // A searched POI names the venue; keep a manual name if there is one.
      name: value.name || s.parsed.name || s.label,
      addressLine1: s.parsed.addressLine1 || value.addressLine1,
      city: s.parsed.city,
      state: s.parsed.state,
      postcode: s.parsed.postcode,
      country: s.parsed.country,
      coordinates: { lat, lng },
    });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 900 });
    setQuery("");
    setSuggestions([]);
  }

  /**
   * Geocode whatever is currently in the address fields.
   *
   * Tries progressively coarser queries rather than one all-or-nothing string.
   * A venue name is a poor geocoder input — "Test Convention Centre, 11th Main"
   * matches nothing, and the old single-shot query then returned silently, so
   * the button looked dead. Falling back to street → name → city means a
   * half-filled form still moves the pin somewhere useful.
   *
   * The `types` filter is also gone: it excluded `postcode` and `region`, so a
   * perfectly good "Bengaluru, Karnataka, 560070" scored zero results.
   */
  async function locateFromFields() {
    if (!MAPBOX_TOKEN) {
      toast.error("Map lookup needs NEXT_PUBLIC_MAPBOX_TOKEN to be set");
      return;
    }

    const line = (parts: Array<string | undefined>) =>
      parts.map((p) => (p || "").trim()).filter(Boolean).join(", ");

    const attempts = Array.from(
      new Set(
        [
          line([value.addressLine1, value.city, value.state, value.postcode, value.country]),
          line([value.name, value.city, value.country]),
          line([value.city, value.state, value.country]),
          line([value.postcode, value.country]),
        ].filter((q) => q.length >= 3)
      )
    );

    if (attempts.length === 0) {
      toast.error("Fill in an address, city or venue name first");
      return;
    }

    setLocating(true);
    try {
      for (const q of attempts) {
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          limit: "1",
        });
        // Bias towards the existing pin, so re-locating a venue in a city with
        // a dozen "Main Road"s lands near where the founder already is.
        const near = value.coordinates;
        if (near) params.set("proximity", `${near.lng},${near.lat}`);

        const res = await fetch(
          `${GEOCODE}/${encodeURIComponent(q)}.json?${params.toString()}`
        );
        if (!res.ok) throw new Error(`Mapbox returned ${res.status}`);
        const data = await res.json();
        const f = data?.features?.[0];
        if (!f) continue;

        const [lng, lat] = f.center;
        const parsed = parseFeature(f);
        onChange({
          ...value,
          // Only fill blanks — a founder who typed a field keeps it.
          name: value.name || parsed.name,
          addressLine1: value.addressLine1 || parsed.addressLine1,
          city: value.city || parsed.city,
          state: value.state || parsed.state,
          postcode: value.postcode || parsed.postcode,
          country: value.country || parsed.country,
          coordinates: { lat, lng },
        });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 900 });
        toast.success(`Pin moved to ${f.place_name || q}`);
        return;
      }
      toast.error(
        "Could not find that address. Click the map to place the pin instead."
      );
    } catch (err: any) {
      toast.error(err?.message || "Address lookup failed");
    } finally {
      setLocating(false);
    }
  }

  const set = (patch: Partial<VenueValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      {/* Search — the fastest path to a filled-in venue */}
      {MAPBOX_TOKEN && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a venue or address"
            className="w-full rounded-lg border border-[#262626] bg-[#1A1A1A] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand/50"
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-600" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#262626] bg-[#1A1A1A] shadow-2xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#262626]"
                  >
                    <MapPin
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: GOLD }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {s.label}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">
                        {s.context}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Field
        label="Venue Name"
        required
        value={value.name}
        onChange={(v) => set({ name: v })}
        placeholder="The Garage Convention Centre"
      />
      <Field
        label="Address"
        value={value.addressLine1}
        onChange={(v) => set({ addressLine1: v })}
        placeholder="221B Innovation Drive"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="City"
          required
          value={value.city}
          onChange={(v) => set({ city: v })}
        />
        <Field
          label="State / Region"
          value={value.state}
          onChange={(v) => set({ state: v })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Postcode"
          value={value.postcode}
          onChange={(v) => set({ postcode: v })}
        />
        <Field
          label="Country"
          value={value.country}
          onChange={(v) => set({ country: v })}
        />
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-xl border border-[#26262f]">
        {MAPBOX_TOKEN ? (
          <>
            <div ref={containerRef} className="h-72 w-full" />

            {!value.coordinates && mapReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="pointer-events-auto rounded-lg bg-[#1A1A1A]/95 px-4 py-2.5 text-center backdrop-blur">
                  <p className="text-xs text-zinc-400">
                    Click the map to drop the event pin
                  </p>
                  <button
                    type="button"
                    onClick={() => void locateMe()}
                    disabled={geoLocating}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ color: GOLD }}
                  >
                    {geoLocating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3 w-3" />
                    )}
                    {geoLocating ? "Finding you…" : "Or use my current location"}
                  </button>
                </div>
              </div>
            )}

            {value.coordinates && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-[#1A1A1A]/95 px-2.5 py-1.5 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white">
                  Event center
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-[#7c7d94]">
                  {value.coordinates.lat.toFixed(5)},{" "}
                  {value.coordinates.lng.toFixed(5)}
                </div>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex gap-2">
              {value.coordinates && (
                <button
                  type="button"
                  onClick={() => set({ coordinates: undefined })}
                  className="rounded-lg border border-[#262626] bg-[#1A1A1A]/95 px-3 py-1.5 text-xs text-[#e7e7ef] backdrop-blur transition-colors hover:bg-white/10"
                >
                  Clear pin
                </button>
              )}
              <button
                type="button"
                onClick={() => void locateMe()}
                disabled={geoLocating}
                title="Drop the pin where you are right now"
                className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#1A1A1A]/95 px-3 py-1.5 text-xs text-[#e7e7ef] backdrop-blur transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {geoLocating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <LocateFixed className="h-3 w-3" />
                )}
                Use my location
              </button>
              <button
                type="button"
                onClick={locateFromFields}
                disabled={locating}
                title="Move the pin to the address typed above"
                className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#1A1A1A]/95 px-3 py-1.5 text-xs text-[#e7e7ef] backdrop-blur transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {locating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Crosshair className="h-3 w-3" />
                )}
                Locate from address
              </button>
            </div>
          </>
        ) : (
          // No token configured — keep the form usable rather than blocking it.
          <div className="flex h-40 flex-col items-center justify-center gap-2 bg-[#1A1A1A] px-6 text-center">
            <MapPin className="h-6 w-6 text-[#3a3a48]" strokeWidth={1.5} />
            <p className="text-xs text-zinc-600">
              Map preview needs NEXT_PUBLIC_MAPBOX_TOKEN. The address above is
              still saved and used for directions.
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-5 text-zinc-600">
        Search, use your current location, click the map, or drag the pin — the
        address fills in automatically. Attendees get directions from this exact
        point.
      </p>
    </div>
  );
}
