"use client";

// Read-only venue map for the public event page (and the builder preview).
//
// Renders the exact pin the organizer dropped in the wizard. Falls back to the
// styled placeholder when there are no coordinates or no Mapbox token, so the
// section never collapses to an empty box.

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function EventVenueMap({
  coordinates,
  label,
  height = 320,
  variant = "dark",
  pinColor = "#ef4444",
}: {
  coordinates?: { lat?: number; lng?: number };
  label?: string;
  height?: number;
  /** Matches the map tiles and the placeholder to the site's palette. */
  variant?: "light" | "dark";
  /** `#rrggbb`. Read once, when the marker is placed. */
  pinColor?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [failed, setFailed] = useState(false);

  const lat = coordinates?.lat;
  const lng = coordinates?.lng;
  const hasPoint = typeof lat === "number" && typeof lng === "number";
  const styleUrl =
    variant === "light"
      ? "mapbox://styles/mapbox/streets-v12"
      : "mapbox://styles/mapbox/dark-v11";

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || !hasPoint || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [lng as number, lat as number],
        zoom: 15,
        attributionControl: false,
        // Attendees are reading, not exploring — scroll should scroll the page.
        scrollZoom: false,
      });
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );
      new mapboxgl.Marker({ color: pinColor })
        .setLngLat([lng as number, lat as number])
        .addTo(map);
      mapRef.current = map;
    } catch {
      setFailed(true);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // styleUrl is applied by the swap effect below, so a palette flip does not
    // tear down and rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPoint, lat, lng]);

  // Palette changes (the builder's theme picker) restyle the live map.
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setStyle(styleUrl);
    } catch {
      /* a failed restyle leaves the previous tiles up, which is fine */
    }
  }, [styleUrl]);

  if (!MAPBOX_TOKEN || !hasPoint || failed) {
    const grid =
      variant === "light"
        ? "repeating-linear-gradient(0deg,#f1f1ee 0px,#f1f1ee 39px,#e2e2dc 40px), repeating-linear-gradient(90deg,#f1f1ee 0px,#f1f1ee 39px,#e2e2dc 40px)"
        : "repeating-linear-gradient(0deg,#16161d 0px,#16161d 39px,#1d1d26 40px), repeating-linear-gradient(90deg,#16161d 0px,#16161d 39px,#1d1d26 40px)";
    return (
      <div className="relative w-full" style={{ height, background: grid }}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: pinColor, boxShadow: `0 10px 15px -3px ${pinColor}4d` }}
          >
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div
            className={[
              "mt-2 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
              variant === "light"
                ? "bg-white/90 text-[#15151a]"
                : "bg-[#0c0c0e]/90 text-white",
            ].join(" ")}
          >
            {label || "Event centre"}
          </div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
