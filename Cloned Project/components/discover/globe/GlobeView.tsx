"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import { Menu, X } from "lucide-react";
import { useGlobeData } from "@/lib/hooks/useGlobeData";
import { GlobeMap } from "./GlobeMap";
import { GlobeTabs } from "./GlobeTabs";
import { GlobeControls } from "./GlobeControls";
import { GlobeTicker } from "./GlobeTicker";
import { GlobeSearch } from "./GlobeSearch";
import { GlobeSidebar } from "./GlobeSidebar";
import { slugify } from "@/lib/utils";
import type {
  TabType,
  EntityType,
  TickerMessage,
  CountryGroup,
  HQOrganization,
  NewFounder,
  Stakeholder,
} from "./types";
import { isValidCoordinate } from "./types";

export function GlobeView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("hqs");
  const [isSpinning, setIsSpinning] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Open by default on desktop
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const {
    hqOrganizations,
    founders,
    stakeholders,
    loading,
    getCountryGroups,
    getTickerMessages,
  } = useGlobeData();

  // Handle View HQ click - navigate to guest page
  const handleViewHQ = useCallback(
    (org: HQOrganization) => {
      const orgSlug = org.slug || slugify(org.name);
      router.push(`/guest/${orgSlug}`);
    },
    [router]
  );

  // Handle View Founder click - navigate to their org's guest page
  const handleViewFounder = useCallback(
    (founder: NewFounder) => {
      // Navigate to the founder's organization if available
      const orgName = founder.organizations?.[0]?.organization?.name;
      if (orgName) {
        router.push(`/guest/${slugify(orgName)}`);
      }
    },
    [router]
  );

  // Handle View Stakeholder click - navigate to their org's guest page
  const handleViewStakeholder = useCallback(
    (stakeholder: Stakeholder) => {
      // Navigate to the stakeholder's organization if available
      const orgName = stakeholder.organizations?.[0]?.organization?.name;
      if (orgName) {
        router.push(`/guest/${slugify(orgName)}`);
      }
    },
    [router]
  );

  // Handle entity click from map or sidebar
  const handleEntityClick = useCallback((entity: EntityType) => {
    if (
      !mapRef.current ||
      !isValidCoordinate(entity.latitude, entity.longitude)
    )
      return;

    mapRef.current.flyTo({
      center: [entity.longitude!, entity.latitude!],
      zoom: Math.max(mapRef.current.getZoom(), 4),
      duration: 1500,
    });
  }, []);

  // Handle search result click
  const handleSearchResultClick = useCallback(
    (entity: HQOrganization | NewFounder | Stakeholder) => {
      handleEntityClick(entity);
    },
    [handleEntityClick]
  );

  // Handle ticker message click
  const handleTickerClick = useCallback((message: TickerMessage) => {
    if (
      !mapRef.current ||
      !isValidCoordinate(message.latitude, message.longitude)
    )
      return;

    mapRef.current.flyTo({
      center: [message.longitude!, message.latitude!],
      zoom: 4,
      duration: 1500,
    });
  }, []);

  // Handle country click from sidebar
  const handleCountryClick = useCallback((group: CountryGroup) => {
    if (!mapRef.current || group.items.length === 0) return;

    // If single item, fly to it
    if (group.items.length === 1) {
      const item = group.items[0];
      if (isValidCoordinate(item.latitude, item.longitude)) {
        mapRef.current.flyTo({
          center: [item.longitude!, item.latitude!],
          zoom: 4,
          duration: 1500,
        });
      }
      return;
    }

    // Multiple items - fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    group.items.forEach((item) => {
      if (isValidCoordinate(item.latitude, item.longitude)) {
        bounds.extend([item.longitude!, item.latitude!]);
      }
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, {
        padding: 100,
        duration: 1500,
      });
    }
  }, []);

  // Map control handlers
  const handleZoomIn = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomIn({ duration: 300 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomOut({ duration: 300 });
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [0, 20],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    }
  }, []);

  const handleToggleSpin = useCallback(() => {
    setIsSpinning((prev) => !prev);
  }, []);

  // Get counts for tabs
  const counts = {
    hqs: hqOrganizations.filter((o) =>
      isValidCoordinate(o.latitude, o.longitude)
    ).length,
    founders: founders.filter((f) => isValidCoordinate(f.latitude, f.longitude))
      .length,
    stakeholders: stakeholders.filter((s) =>
      isValidCoordinate(s.latitude, s.longitude)
    ).length,
  };

  const tickerMessages = getTickerMessages(activeTab);
  const countryGroups = getCountryGroups(activeTab);

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#0c0c0e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading globe data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-[#0c0c0e]">
      {/* Ticker at very top */}
      <div className="pt-16">
        <GlobeTicker
          messages={tickerMessages}
          activeTab={activeTab}
          onMessageClick={handleTickerClick}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar with Tabs above */}
        <div
          className={`absolute lg:relative left-0 top-0 h-full z-40 transition-transform duration-300 ${
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:-translate-x-full"
          }`}
        >
          {/* Sidebar container */}
          <div className="w-[320px] h-full bg-[#0c0c0e] border-r border-zinc-800 flex flex-col">
            {/* Tabs at top of sidebar */}
            <div className="p-3 border-b border-zinc-800">
              <GlobeTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={counts}
              />
            </div>

            {/* Search below tabs */}
            <div className="p-3 border-b border-zinc-800">
              <GlobeSearch
                hqOrganizations={hqOrganizations}
                founders={founders}
                stakeholders={stakeholders}
                activeTab={activeTab}
                onResultClick={handleSearchResultClick}
              />
            </div>

            {/* Country list */}
            <div className="flex-1 overflow-hidden">
              <GlobeSidebar
                isOpen={true}
                onClose={() => setIsSidebarOpen(false)}
                countryGroups={countryGroups}
                activeTab={activeTab}
                onEntityClick={handleEntityClick}
                onCountryClick={handleCountryClick}
                embedded={true}
              />
            </div>
          </div>
        </div>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Map area */}
        <div className="flex-1 relative">
          <GlobeMap
            hqOrganizations={hqOrganizations}
            founders={founders}
            stakeholders={stakeholders}
            activeTab={activeTab}
            isSpinning={isSpinning}
            onEntityClick={handleEntityClick}
            onViewHQ={handleViewHQ}
            onViewFounder={handleViewFounder}
            onViewStakeholder={handleViewStakeholder}
            mapRef={mapRef}
          />

          {/* Floating controls - top right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <GlobeControls
              isSpinning={isSpinning}
              onToggleSpin={handleToggleSpin}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetView={handleResetView}
            />

            {/* Sidebar toggle */}
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile sidebar toggle - bottom left */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`lg:hidden absolute bottom-4 left-4 p-3 rounded-lg bg-brand-2 text-brand-foreground shadow-lg ${
              isSidebarOpen ? "hidden" : ""
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
