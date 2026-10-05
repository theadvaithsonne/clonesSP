"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, X, Building2, MapPin } from "lucide-react";
import type {
  CountryGroup,
  EntityType,
  HQOrganization,
  NewFounder,
  Stakeholder,
  TabType,
} from "./types";
import { getEntityLocation, isHQOrganization } from "./types";

interface GlobeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  countryGroups: CountryGroup[];
  activeTab: TabType;
  onEntityClick: (entity: EntityType) => void;
  onCountryClick: (country: CountryGroup) => void;
  embedded?: boolean; // When true, renders without wrapper/overlay (used when embedded in parent container)
}

export function GlobeSidebar({
  isOpen,
  onClose,
  countryGroups,
  activeTab,
  onEntityClick,
  onCountryClick,
  embedded = false,
}: GlobeSidebarProps) {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(
    new Set()
  );

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  const getIcon = (entity: EntityType): string | null => {
    if (isHQOrganization(entity)) {
      return (entity as HQOrganization).icon || null;
    }
    return (
      (entity as NewFounder | Stakeholder).profilePicture || null
    );
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case "hqs":
        return "HQs";
      case "founders":
        return "Founders";
      case "stakeholders":
        return "Stakeholders";
    }
  };

  const getTotalCount = () => {
    return countryGroups.reduce((sum, group) => sum + group.items.length, 0);
  };

  // When embedded, just render the content without wrapper
  if (embedded) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">
            {getTabLabel()} by Country
          </h2>
          <p className="text-xs text-zinc-500">
            {getTotalCount()} {getTabLabel().toLowerCase()} in {countryGroups.length} countries
          </p>
        </div>

        {/* Country List */}
        <div className="flex-1 overflow-y-auto p-2">
          {countryGroups.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No locations available</p>
            </div>
          ) : (
            countryGroups.map((group) => (
              <div key={group.country} className="mb-1">
                {/* Country Header */}
                <button
                  onClick={() => {
                    toggleCountry(group.country);
                    onCountryClick(group);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Flag */}
                  <Image
                    src={`https://flagcdn.com/24x18/${group.countryCode.toLowerCase()}.png`}
                    alt={group.country}
                    width={24}
                    height={18}
                    className="rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />

                  {/* Country Name */}
                  <span className="flex-1 text-left text-sm font-medium text-white">
                    {group.country}
                  </span>

                  {/* Count */}
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>

                  {/* Expand Icon */}
                  {expandedCountries.has(group.country) ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                </button>

                {/* Country Items */}
                {expandedCountries.has(group.country) && (
                  <div className="ml-4 pl-4 border-l border-zinc-800 mt-1 mb-2">
                    {group.items.map((entity) => {
                      const icon = getIcon(entity);
                      return (
                        <button
                          key={entity._id}
                          onClick={() => onEntityClick(entity)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-brand-2/30 bg-zinc-800">
                            {icon ? (
                              <Image
                                src={icon}
                                alt={entity.name}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-zinc-500" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-white truncate">
                              {entity.name}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {getEntityLocation(entity)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`globe-sidebar ${isOpen ? "open" : "closed"} z-50`}
        style={{ paddingTop: "0" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0c0c0e] border-b border-zinc-800 px-4 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {getTabLabel()} by Country
              </h2>
              <p className="text-sm text-zinc-500">
                {getTotalCount()} {getTabLabel().toLowerCase()} in{" "}
                {countryGroups.length} countries
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Country List */}
        <div className="p-2">
          {countryGroups.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No locations available</p>
            </div>
          ) : (
            countryGroups.map((group) => (
              <div key={group.country} className="mb-1">
                {/* Country Header */}
                <button
                  onClick={() => {
                    toggleCountry(group.country);
                    onCountryClick(group);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Flag */}
                  <Image
                    src={`https://flagcdn.com/24x18/${group.countryCode.toLowerCase()}.png`}
                    alt={group.country}
                    width={24}
                    height={18}
                    className="rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />

                  {/* Country Name */}
                  <span className="flex-1 text-left text-sm font-medium text-white">
                    {group.country}
                  </span>

                  {/* Count */}
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>

                  {/* Expand Icon */}
                  {expandedCountries.has(group.country) ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                </button>

                {/* Country Items */}
                {expandedCountries.has(group.country) && (
                  <div className="ml-4 pl-4 border-l border-zinc-800 mt-1 mb-2">
                    {group.items.map((entity) => {
                      const icon = getIcon(entity);
                      return (
                        <button
                          key={entity._id}
                          onClick={() => onEntityClick(entity)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-brand-2/30 bg-zinc-800">
                            {icon ? (
                              <Image
                                src={icon}
                                alt={entity.name}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-zinc-500" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-white truncate">
                              {entity.name}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {getEntityLocation(entity)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
