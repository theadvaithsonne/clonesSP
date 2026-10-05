"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type {
  HQOrganization,
  NewFounder,
  Stakeholder,
  TabType,
  EntityType,
} from "./types";
import { isValidCoordinate, getEntityLocation, isHQOrganization } from "./types";

interface GlobeMapProps {
  hqOrganizations: HQOrganization[];
  founders: NewFounder[];
  stakeholders: Stakeholder[];
  activeTab: TabType;
  isSpinning: boolean;
  onEntityClick: (entity: EntityType) => void;
  onViewHQ?: (org: HQOrganization) => void;
  onViewFounder?: (founder: NewFounder) => void;
  onViewStakeholder?: (stakeholder: Stakeholder) => void;
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>;
}

export function GlobeMap({
  hqOrganizations,
  founders,
  stakeholders,
  activeTab,
  isSpinning,
  onEntityClick,
  onViewHQ,
  onViewFounder,
  onViewStakeholder,
  mapRef: externalMapRef,
}: GlobeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const internalMapRef = useRef<mapboxgl.Map | null>(null);
  const mapRef = externalMapRef || internalMapRef;
  const markers = useRef<mapboxgl.Marker[]>([]);
  const popups = useRef<mapboxgl.Popup[]>([]);
  const spinAnimationRef = useRef<number | null>(null);
  const userInteractingRef = useRef(false);
  const isSpinningRef = useRef(isSpinning); // Track current spin state for event handlers
  const [mapLoaded, setMapLoaded] = useState(false);

  // Keep ref in sync with prop
  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  // Get Mapbox token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Clear all markers
  const clearMarkers = useCallback(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    popups.current.forEach((popup) => popup.remove());
    popups.current = [];
  }, []);

  // Create popup HTML for HQ
  const createHQPopupHTML = (org: HQOrganization): string => {
    const iconHtml = org.icon
      ? `<img src="${org.icon}" alt="${org.name}" class="globe-popup-avatar" />`
      : `<div class="globe-popup-avatar-placeholder">${org.name?.charAt(0) || "?"}</div>`;

    return `
      <div class="globe-popup-content">
        <div class="globe-popup-header">
          ${iconHtml}
          <div class="globe-popup-info">
            <h3>${org.name}</h3>
            <span class="globe-popup-badge globe-popup-badge-hq">HQ</span>
          </div>
        </div>
        <p class="globe-popup-location">${getEntityLocation(org)}</p>
        ${org.description ? `<p class="globe-popup-description">${org.description.slice(0, 100)}${org.description.length > 100 ? "..." : ""}</p>` : ""}
        <div class="globe-popup-stats">
          <div class="globe-popup-stat">
            <span class="globe-popup-stat-value">${org.founders?.length || 0}</span>
            <span>Founders</span>
          </div>
          ${org.stakeholders ? `<div class="globe-popup-stat"><span class="globe-popup-stat-value">${org.stakeholders}</span><span>Stakeholders</span></div>` : ""}
        </div>
        <button class="globe-popup-button" data-action="view" data-id="${org._id}" data-type="hq">
          View HQ
        </button>
      </div>
    `;
  };

  // Create popup HTML for Founder
  const createFounderPopupHTML = (founder: NewFounder): string => {
    const iconHtml = founder.profilePicture
      ? `<img src="${founder.profilePicture}" alt="${founder.name}" class="globe-popup-avatar" />`
      : `<div class="globe-popup-avatar-placeholder">${founder.name?.charAt(0) || "?"}</div>`;

    const orgName = founder.organizations?.[0]?.organization?.name || "";

    return `
      <div class="globe-popup-content">
        <div class="globe-popup-header">
          ${iconHtml}
          <div class="globe-popup-info">
            <h3>${founder.name}</h3>
            <span class="globe-popup-badge globe-popup-badge-founder">Founder</span>
          </div>
        </div>
        <p class="globe-popup-location">${getEntityLocation(founder)}</p>
        ${orgName ? `<p class="globe-popup-description">Founder at ${orgName}</p>` : ""}
        <button class="globe-popup-button" data-action="view" data-id="${founder._id}" data-type="founder">
          View Profile
        </button>
      </div>
    `;
  };

  // Create popup HTML for Stakeholder
  const createStakeholderPopupHTML = (stakeholder: Stakeholder): string => {
    const iconHtml = stakeholder.profilePicture
      ? `<img src="${stakeholder.profilePicture}" alt="${stakeholder.name}" class="globe-popup-avatar" />`
      : `<div class="globe-popup-avatar-placeholder">${stakeholder.name?.charAt(0) || "?"}</div>`;

    const orgName = stakeholder.organizations?.[0]?.organization?.name || "";

    return `
      <div class="globe-popup-content">
        <div class="globe-popup-header">
          ${iconHtml}
          <div class="globe-popup-info">
            <h3>${stakeholder.name}</h3>
            <span class="globe-popup-badge globe-popup-badge-stakeholder">Stakeholder</span>
          </div>
        </div>
        <p class="globe-popup-location">${getEntityLocation(stakeholder)}</p>
        ${orgName ? `<p class="globe-popup-description">Stakeholder at ${orgName}</p>` : ""}
        <button class="globe-popup-button" data-action="view" data-id="${stakeholder._id}" data-type="stakeholder">
          View Profile
        </button>
      </div>
    `;
  };

  // Create marker element
  const createMarkerElement = (
    entity: EntityType,
    type: TabType
  ): HTMLDivElement => {
    const el = document.createElement("div");
    el.className = `globe-marker ${type === "stakeholders" ? "globe-marker-stakeholder" : ""}`;

    const icon = isHQOrganization(entity)
      ? (entity as HQOrganization).icon
      : (entity as NewFounder | Stakeholder).profilePicture;

    if (icon) {
      el.style.background = "white";
      const img = document.createElement("img");
      img.src = icon;
      img.alt = entity.name;
      img.onerror = () => {
        el.innerHTML = `<span class="globe-marker-initial">${entity.name?.charAt(0) || "?"}</span>`;
        el.style.background = "linear-gradient(45deg, #fbbf24, #f59e0b)";
      };
      el.appendChild(img);
    } else {
      el.style.background = "linear-gradient(45deg, #fbbf24, #f59e0b)";
      el.innerHTML = `<span class="globe-marker-initial">${entity.name?.charAt(0) || "?"}</span>`;
    }

    return el;
  };

  // Add markers based on active tab
  const addMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoaded) return;

    clearMarkers();

    let entities: EntityType[] = [];
    let createPopupHTML: (entity: EntityType) => string;

    switch (activeTab) {
      case "hqs":
        entities = hqOrganizations;
        createPopupHTML = (e) => createHQPopupHTML(e as HQOrganization);
        break;
      case "founders":
        entities = founders;
        createPopupHTML = (e) => createFounderPopupHTML(e as NewFounder);
        break;
      case "stakeholders":
        entities = stakeholders;
        createPopupHTML = (e) => createStakeholderPopupHTML(e as Stakeholder);
        break;
    }

    entities.forEach((entity) => {
      if (!isValidCoordinate(entity.latitude, entity.longitude)) {
        return;
      }

      const el = createMarkerElement(entity, activeTab);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([entity.longitude!, entity.latitude!])
        .addTo(mapRef.current!);

      markers.current.push(marker);

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: "380px",
      }).setHTML(createPopupHTML(entity));

      popups.current.push(popup);

      // Click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();

        // Close all other popups
        popups.current.forEach((p) => p.remove());

        // Show this popup
        popup.setLngLat([entity.longitude!, entity.latitude!]).addTo(mapRef.current!);

        // Fly to location
        mapRef.current?.flyTo({
          center: [entity.longitude!, entity.latitude!],
          zoom: Math.max(mapRef.current.getZoom(), 4),
          duration: 1500,
        });

        onEntityClick(entity);
      });

      // Touch handler for mobile
      el.addEventListener("touchend", (e) => {
        e.preventDefault();
        el.click();
      });
    });
  }, [
    activeTab,
    hqOrganizations,
    founders,
    stakeholders,
    mapLoaded,
    clearMarkers,
    onEntityClick,
  ]);

  // Globe spinning animation - use ref for checking spin state to avoid stale closures
  const spinGlobe = useCallback(() => {
    if (!mapRef.current || !isSpinningRef.current || userInteractingRef.current) return;

    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();

    // Slow down rotation at higher zoom levels
    const speedFactor = Math.max(0.1, 1 - zoom / 10);
    const secondsPerRevolution = 120;
    const degreesPerSecond = (360 / secondsPerRevolution) * speedFactor;

    center.lng += degreesPerSecond / 60; // 60 fps
    map.setCenter(center);

    spinAnimationRef.current = requestAnimationFrame(spinGlobe);
  }, []); // No dependencies - uses refs

  // Handle popup button clicks
  useEffect(() => {
    const handlePopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".globe-popup-button") as HTMLElement;

      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;
      const type = button.dataset.type;

      if (action !== "view" || !id || !type) return;

      if (type === "hq" && onViewHQ) {
        const org = hqOrganizations.find((o) => o._id === id);
        if (org) onViewHQ(org);
      } else if (type === "founder" && onViewFounder) {
        const founder = founders.find((f) => f._id === id);
        if (founder) onViewFounder(founder);
      } else if (type === "stakeholder" && onViewStakeholder) {
        const stakeholder = stakeholders.find((s) => s._id === id);
        if (stakeholder) onViewStakeholder(stakeholder);
      }
    };

    document.addEventListener("click", handlePopupClick);

    return () => {
      document.removeEventListener("click", handlePopupClick);
    };
  }, [hqOrganizations, founders, stakeholders, onViewHQ, onViewFounder, onViewStakeholder]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      projection: "globe",
      renderWorldCopies: false,
      antialias: true,
    });

    mapRef.current = map;

    // Add atmosphere effect
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(186, 210, 235)",
        "high-color": "rgb(36, 92, 223)",
        "horizon-blend": 0.02,
        "space-color": "rgb(11, 11, 25)",
        "star-intensity": 0.6,
      });
    });

    map.on("load", () => {
      setMapLoaded(true);
    });

    // Track user interaction to pause spinning
    const handleInteractionStart = () => {
      userInteractingRef.current = true;
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
        spinAnimationRef.current = null;
      }
    };

    const handleInteractionEnd = () => {
      userInteractingRef.current = false;
      // Use ref to get current spin state (not stale closure value)
      if (isSpinningRef.current) {
        spinGlobe();
      }
    };

    map.on("dragstart", handleInteractionStart);
    map.on("pitchstart", handleInteractionStart);
    map.on("rotatestart", handleInteractionStart);
    map.on("zoomstart", handleInteractionStart);
    map.on("dragend", handleInteractionEnd);
    map.on("pitchend", handleInteractionEnd);
    map.on("rotateend", handleInteractionEnd);
    map.on("zoomend", handleInteractionEnd);

    // Handle resize
    const handleResize = () => {
      map.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
      }
      window.removeEventListener("resize", handleResize);
      clearMarkers();
      map.remove();
    };
  }, [mapboxToken]);

  // Handle spinning state changes
  useEffect(() => {
    if (isSpinning && mapLoaded && !userInteractingRef.current) {
      spinGlobe();
    } else if (!isSpinning && spinAnimationRef.current) {
      cancelAnimationFrame(spinAnimationRef.current);
      spinAnimationRef.current = null;
    }
  }, [isSpinning, mapLoaded]); // spinGlobe is stable now (no deps)

  // Update markers when data or tab changes
  useEffect(() => {
    addMarkers();
  }, [addMarkers]);

  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
        <p className="text-zinc-500">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    />
  );
}
