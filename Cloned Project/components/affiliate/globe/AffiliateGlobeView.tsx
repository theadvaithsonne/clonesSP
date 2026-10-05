"use client";

import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { AffiliateGlobeMap } from "./AffiliateGlobeMap";
import { AffiliateAccordionSidebar } from "./AffiliateAccordionSidebar";
import { useAffiliateGlobe } from "./hooks/useAffiliateGlobe";

export function AffiliateGlobeView() {
  const [mapExpanded, setMapExpanded] = useState(false);
  const {
    focusedUser,
    directChildren,
    markersData,
    navigationHistory,
    isLoading,
    isLoadingMore,
    error,
    selectUser,
    goBack,
    navigateToHistoryIndex,
    refresh,
    // Pagination
    hasMore,
    totalCount,
    loadMoreChildren,
    // Search
    searchQuery,
    searchChildren,
    // Email deep search
    searchByEmail,
    isEmailSearching,
    emailSearchError,
    // Profile overlay
    openProfileOverlay,
    closeProfileOverlay,
  } = useAffiliateGlobe();

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900">
        <div className="text-center px-4">
          <p className="text-red-400 mb-4 text-sm sm:text-base">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-zinc-900 overflow-x-hidden">
      {/* Globe - below sidebar on mobile, left side on desktop */}
      <div
        className={`order-2 md:order-1 w-full md:w-3/4 relative md:h-full ${
          mapExpanded
            ? "fixed inset-0 z-50 h-full"
            : "h-[200px] shrink-0 sm:h-[250px]"
        }`}
      >
        <AffiliateGlobeMap
          markers={markersData}
          focusedUser={focusedUser}
          onMarkerClick={selectUser}
          onViewProfile={openProfileOverlay}
          isLoading={isLoading}
        />
        {/* Mobile fullscreen toggle */}
        <button
          onClick={() => setMapExpanded((v) => !v)}
          className="md:hidden absolute top-2 right-2 z-10 p-2 rounded-lg bg-black/60 backdrop-blur-sm border border-zinc-700 text-white active:scale-95 transition-transform"
        >
          {mapExpanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Sidebar - above map on mobile, right side on desktop */}
      <div className="order-1 md:order-2 flex-1 min-h-0 md:flex-none md:w-1/4 border-b md:border-b-0 md:border-l border-zinc-800 overflow-hidden">
        <AffiliateAccordionSidebar
          focusedUser={focusedUser}
          directChildren={directChildren}
          navigationHistory={navigationHistory}
          onSelectUser={selectUser}
          onViewProfile={openProfileOverlay}
          onGoBack={goBack}
          onNavigateToIndex={navigateToHistoryIndex}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          totalCount={totalCount}
          onLoadMore={loadMoreChildren}
          searchQuery={searchQuery}
          onSearch={searchChildren}
          onSearchByEmail={searchByEmail}
          isEmailSearching={isEmailSearching}
          emailSearchError={emailSearchError}
        />
      </div>

    </div>
  );
}
