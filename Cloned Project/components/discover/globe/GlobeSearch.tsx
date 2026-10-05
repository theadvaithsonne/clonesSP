"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Search, X, Building2, MapPin } from "lucide-react";
import type {
  HQOrganization,
  NewFounder,
  Stakeholder,
  TabType,
} from "./types";
import { getEntityLocation, isValidCoordinate } from "./types";

type SearchableEntity = HQOrganization | NewFounder | Stakeholder;

interface GlobeSearchProps {
  hqOrganizations: HQOrganization[];
  founders: NewFounder[];
  stakeholders: Stakeholder[];
  activeTab: TabType;
  onResultClick: (entity: SearchableEntity) => void;
}

export function GlobeSearch({
  hqOrganizations,
  founders,
  stakeholders,
  activeTab,
  onResultClick,
}: GlobeSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchableEntity[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current data based on active tab
  const getCurrentData = (): SearchableEntity[] => {
    switch (activeTab) {
      case "hqs":
        return hqOrganizations;
      case "founders":
        return founders;
      case "stakeholders":
        return stakeholders;
    }
  };

  // Search function
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const data = getCurrentData();

    const filtered = data.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const city = item.city?.toLowerCase() || "";
      const country = item.country?.toLowerCase() || "";

      return (
        name.includes(searchTerm) ||
        city.includes(searchTerm) ||
        country.includes(searchTerm)
      );
    });

    // Filter to only items with valid coordinates
    const withCoordinates = filtered.filter((item) =>
      isValidCoordinate(item.latitude, item.longitude)
    );

    setResults(withCoordinates.slice(0, 10));
  }, [query, activeTab, hqOrganizations, founders, stakeholders]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (entity: SearchableEntity) => {
    onResultClick(entity);
    setQuery("");
    setIsOpen(false);
  };

  const getIcon = (entity: SearchableEntity) => {
    if ("icon" in entity && entity.icon) {
      return entity.icon;
    }
    if ("profilePicture" in entity && entity.profilePicture) {
      return entity.profilePicture;
    }
    return null;
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case "hqs":
        return "Search HQs...";
      case "founders":
        return "Search founders...";
      case "stakeholders":
        return "Search stakeholders...";
    }
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={getPlaceholder()}
          className="w-full pl-10 pr-10 py-2.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-2/50 focus:ring-1 focus:ring-brand-2/25 transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
        >
          {results.map((entity) => {
            const icon = getIcon(entity);
            return (
              <button
                key={entity._id}
                onClick={() => handleResultClick(entity)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
              >
                {/* Icon/Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-brand-2/50 bg-zinc-800">
                  {icon ? (
                    <Image
                      src={icon}
                      alt={entity.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-zinc-500" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {entity.name}
                  </p>
                  <p className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {getEntityLocation(entity)}
                  </p>
                </div>

                {/* Tab indicator */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === "hqs"
                      ? "bg-brand-2/20 text-brand-2"
                      : activeTab === "founders"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {activeTab === "hqs"
                    ? "HQ"
                    : activeTab === "founders"
                      ? "Founder"
                      : "Stakeholder"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && query && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 p-4 text-center"
        >
          <p className="text-sm text-zinc-500">
            No results found for &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
