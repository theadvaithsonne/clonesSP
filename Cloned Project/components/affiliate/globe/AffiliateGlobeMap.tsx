"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { GlobeMarkerData, AffiliateUser, getLocationString } from "./types";

interface AffiliateGlobeMapProps {
  markers: GlobeMarkerData[];
  focusedUser: AffiliateUser | null;
  onMarkerClick: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  isLoading: boolean;
}

export function AffiliateGlobeMap({
  markers,
  focusedUser,
  onMarkerClick,
  onViewProfile,
  isLoading,
}: AffiliateGlobeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const spinAnimationRef = useRef<number | null>(null);
  const userInteractingRef = useRef(false);
  const [isSpinning, setIsSpinning] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const isSpinningRef = useRef(isSpinning);

  // Keep ref in sync
  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Clear all markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    popupsRef.current.forEach((popup) => popup.remove());
    popupsRef.current = [];
  }, []);

  // Create marker element
  const createMarkerElement = (marker: GlobeMarkerData): HTMLDivElement => {
    const el = document.createElement("div");
    const planClass = marker.purchases?.proPlan ? "pro-plan" : marker.purchases?.basicPlan ? "basic-plan" : "";
    el.className = `affiliate-globe-marker ${marker.hasChildren ? "has-children" : ""} ${marker.userType === "founder" ? "founder" : ""} ${marker.isFocused ? "focused" : ""} ${planClass}`.replace(/\s+/g, " ").trim();

    const isFounder = marker.userType === "founder";
    const gradient = isFounder
      ? "linear-gradient(135deg, #d97706, #ea580c)"
      : "linear-gradient(135deg, #8b5cf6, #6366f1)";

    if (marker.avatar) {
      el.style.background = "white";
      const img = document.createElement("img");
      img.src = marker.avatar;
      img.alt = marker.name;
      img.className = "affiliate-globe-marker-img";
      img.onerror = () => {
        el.innerHTML = `<span class="affiliate-globe-marker-initial">${marker.name?.charAt(0) || "?"}</span>`;
        el.style.background = gradient;
      };
      el.appendChild(img);
    } else {
      el.style.background = gradient;
      el.innerHTML = `<span class="affiliate-globe-marker-initial">${marker.name?.charAt(0) || "?"}</span>`;
    }

    return el;
  };

  // Create popup HTML
  const createPopupHTML = (marker: GlobeMarkerData): string => {
    const isFounderPopup = marker.userType === "founder";
    const avatarClass = isFounderPopup ? "affiliate-popup-avatar founder" : "affiliate-popup-avatar";
    const placeholderClass = isFounderPopup ? "affiliate-popup-avatar-placeholder founder" : "affiliate-popup-avatar-placeholder";
    const avatarHtml = marker.avatar
      ? `<img src="${marker.avatar}" alt="${marker.name}" class="${avatarClass}" />`
      : `<div class="${placeholderClass}">${marker.name?.charAt(0) || "?"}</div>`;

    const statusClass = isFounderPopup ? "type-founder" : (marker.status === "active" ? "status-active" : "status-inactive");
    const typeLabel = isFounderPopup ? "Founder" : "Member";
    const focusedLabel = marker.isFocused ? " (You)" : "";

    // Build purchase badges HTML
    const purchaseBadges = [
      marker.purchases?.unilevelPlus ? '<span class="affiliate-popup-badge purchase-unilevel">$25</span>' : "",
      marker.purchases?.basicPlan ? '<span class="affiliate-popup-badge purchase-basic">Basic</span>' : "",
      marker.purchases?.proPlan ? '<span class="affiliate-popup-badge purchase-pro">Pro</span>' : "",
    ].filter(Boolean).join(" ");

    // For focused user, show "View Profile" button only
    // For others, show both "View Network" (if has children) and "View Profile" buttons
    let buttonHtml: string;
    if (marker.isFocused) {
      buttonHtml = `
        <button class="affiliate-popup-button affiliate-popup-button-profile" data-profile-id="${marker.id}">
          View Profile
        </button>
      `;
    } else {
      buttonHtml = `
        <div class="affiliate-popup-buttons">
          ${marker.hasChildren ? `
            <button class="affiliate-popup-button affiliate-popup-button-network" data-user-id="${marker.id}">
              View Network
            </button>
          ` : ""}
          <button class="affiliate-popup-button affiliate-popup-button-profile${marker.hasChildren ? " secondary" : ""}" data-profile-id="${marker.id}">
            View Profile
          </button>
        </div>
      `;
    }

    return `
      <div class="affiliate-popup-content">
        <div class="affiliate-popup-header">
          ${avatarHtml}
          <div class="affiliate-popup-info">
            <h3 class="affiliate-popup-name">${marker.name}${focusedLabel}</h3>
            <div class="affiliate-popup-badges">
              <span class="affiliate-popup-badge ${statusClass}">${typeLabel}</span>
              ${purchaseBadges}
            </div>
          </div>
        </div>
        <div class="affiliate-popup-stats">
          <div class="affiliate-popup-stat">
            <span class="affiliate-popup-stat-value">${marker.directReferrals}</span>
            <span class="affiliate-popup-stat-label">Referrals</span>
          </div>
        </div>
        ${buttonHtml}
      </div>
    `;
  };

  // Add markers
  const addMarkers = useCallback(() => {
    if (!mapRef.current || !mapLoaded) return;

    clearMarkers();

    markers.forEach((markerData) => {
      const el = createMarkerElement(markerData);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([markerData.longitude, markerData.latitude])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: "300px",
        className: "affiliate-popup",
      }).setHTML(createPopupHTML(markerData));

      popupsRef.current.push(popup);

      // Click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();

        // Close all other popups
        popupsRef.current.forEach((p) => p.remove());

        // Show this popup
        popup
          .setLngLat([markerData.longitude, markerData.latitude])
          .addTo(mapRef.current!);

        // Stop spinning and fly to location
        setIsSpinning(false);
        mapRef.current?.flyTo({
          center: [markerData.longitude, markerData.latitude],
          zoom: Math.max(mapRef.current.getZoom(), 3),
          duration: 1500,
        });
      });
    });
  }, [markers, mapLoaded, clearMarkers]);

  // Handle popup button clicks
  useEffect(() => {
    const handlePopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".affiliate-popup-button") as HTMLElement;

      if (!button) return;

      // Handle "View Network" button
      const userId = button.dataset.userId;
      if (userId) {
        // Close all popups
        popupsRef.current.forEach((p) => p.remove());
        onMarkerClick(userId);
        return;
      }

      // Handle "View Profile" button
      const profileId = button.dataset.profileId;
      if (profileId) {
        // Close all popups
        popupsRef.current.forEach((p) => p.remove());
        onViewProfile(profileId);
      }
    };

    document.addEventListener("click", handlePopupClick);
    return () => document.removeEventListener("click", handlePopupClick);
  }, [onMarkerClick, onViewProfile]);

  // Globe spinning animation
  const spinGlobe = useCallback(() => {
    if (!mapRef.current || !isSpinningRef.current || userInteractingRef.current)
      return;

    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();

    // Slow down rotation at higher zoom levels
    const speedFactor = Math.max(0.1, 1 - zoom / 10);
    const secondsPerRevolution = 120;
    const degreesPerSecond = (360 / secondsPerRevolution) * speedFactor;

    center.lng += degreesPerSecond / 60;
    map.setCenter(center);

    spinAnimationRef.current = requestAnimationFrame(spinGlobe);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
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
        color: "rgb(20, 20, 30)",
        "high-color": "rgb(80, 60, 180)",
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
    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
      }
      window.removeEventListener("resize", handleResize);
      clearMarkers();
      map.remove();
    };
  }, [mapboxToken, spinGlobe, clearMarkers]);

  // Handle spinning state changes
  useEffect(() => {
    if (isSpinning && mapLoaded && !userInteractingRef.current) {
      spinGlobe();
    } else if (!isSpinning && spinAnimationRef.current) {
      cancelAnimationFrame(spinAnimationRef.current);
      spinAnimationRef.current = null;
    }
  }, [isSpinning, mapLoaded, spinGlobe]);

  // Update markers when data changes
  useEffect(() => {
    addMarkers();
  }, [addMarkers]);

  // Reset view when focused user changes
  useEffect(() => {
    if (mapRef.current && mapLoaded && focusedUser) {
      // If focused user has location, fly there
      if (focusedUser.location.latitude && focusedUser.location.longitude) {
        mapRef.current.flyTo({
          center: [focusedUser.location.longitude, focusedUser.location.latitude],
          zoom: 2,
          duration: 2000,
        });
      } else {
        // Reset to world view
        mapRef.current.flyTo({
          center: [0, 20],
          zoom: 1.5,
          duration: 2000,
        });
      }
    }
  }, [focusedUser?.id, mapLoaded]);

  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
        <p className="text-zinc-500">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      )}

      {/* Globe controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setIsSpinning(!isSpinning)}
          className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg text-white transition-colors"
          title={isSpinning ? "Pause rotation" : "Resume rotation"}
        >
          {isSpinning ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </button>
        <button
          onClick={() => {
            mapRef.current?.flyTo({
              center: [0, 20],
              zoom: 1.5,
              duration: 1500,
            });
          }}
          className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg text-white transition-colors"
          title="Reset view"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>

      {/* No referrals message */}
      {!isLoading && markers.length === 0 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800/90 text-white px-4 py-2 rounded-lg z-10">
          No referrals to display on the globe
        </div>
      )}
    </div>
  );
}
