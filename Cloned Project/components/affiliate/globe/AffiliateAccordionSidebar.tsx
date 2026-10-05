"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Users,
  ArrowLeft,
  User,
  Search,
  X,
  Loader2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { AffiliateUser } from "./types";

interface AffiliateAccordionSidebarProps {
  focusedUser: AffiliateUser | null;
  directChildren: AffiliateUser[];
  navigationHistory: AffiliateUser[];
  onSelectUser: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  onGoBack: () => void;
  onNavigateToIndex: (index: number) => void;
  isLoading: boolean;
  // Pagination props
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  onLoadMore: () => void;
  // Search props
  searchQuery: string;
  onSearch: (query: string) => void;
  // Email deep search props
  onSearchByEmail: (email: string) => Promise<{ error: string } | { success: true }>;
  isEmailSearching: boolean;
  emailSearchError: string | null;
}

export function AffiliateAccordionSidebar({
  focusedUser,
  directChildren,
  navigationHistory,
  onSelectUser,
  onViewProfile,
  onGoBack,
  onNavigateToIndex,
  isLoading,
  isLoadingMore,
  hasMore,
  totalCount,
  onLoadMore,
  searchQuery,
  onSearch,
  onSearchByEmail,
  isEmailSearching,
  emailSearchError,
}: AffiliateAccordionSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [emailSearchMode, setEmailSearchMode] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local search with external search query (e.g., when navigating clears it)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Compute UP-active leg numbers for the focused user's direct children.
  // Mirrors `getActiveUpLegNumber` in
  // garagenew-backend/src/services/unilevelPlusCommission.ts:
  //   - Filter directs to those with active UnilevelPlusPurchase (= `purchases.unilevelPlus`)
  //   - Order by joinedAt ascending (= createdAt asc on the BE)
  //   - Position in that filtered list (1-based) = the leg number
  // The badge surfaces:
  //   - The number itself (founder can see "this is leg #4 of my UP-active directs")
  //   - The tier the leg qualifies upstream for, color-coded:
  //       L1-3 (gray)       — UP-active but no infinity eligibility
  //       L4-9 (blue)       — counts as a Tier 1 leg (if upline has ≥4 UP-active)
  //       L10+ (emerald)    — counts as a Tier 1 AND Tier 2 leg (if upline has ≥10)
  // When the list is paginated (`hasMore`) we can't compute accurate leg numbers
  // for the tail, but the leading positions we DO have are correct because
  // the BE returns directs in createdAt order.
  const { legNumberMap, totalUpActive } = useMemo(() => {
    const upActiveSorted = directChildren
      .filter((c) => c.purchases?.unilevelPlus)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      );
    const map = new Map<string, number>();
    upActiveSorted.forEach((c, i) => map.set(c.id, i + 1));
    return { legNumberMap: map, totalUpActive: upActiveSorted.length };
  }, [directChildren]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearchQuery(value);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onSearch("");
  }, [onSearch]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle email search submit
  const handleEmailSearch = useCallback(async () => {
    if (!emailInput.trim()) return;
    const result = await onSearchByEmail(emailInput.trim());
    if ("success" in result) {
      // Found - the hook navigates into their section automatically
      setEmailInput("");
      setEmailSearchMode(false);
    }
  }, [emailInput, onSearchByEmail]);

  // Infinite scroll detection
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Load more when user scrolls within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  const toggleExpand = (userId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedItems(newExpanded);
  };

  const canGoBack = navigationHistory.length > 1;
  const isAtRoot = navigationHistory.length <= 1;
  const isSearching = localSearchQuery.trim().length > 0;

  // Reset email search mode when navigating away from root
  useEffect(() => {
    if (!isAtRoot && emailSearchMode) {
      setEmailSearchMode(false);
      setEmailInput("");
    }
  }, [isAtRoot]);

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-white overflow-hidden">
      {/* Breadcrumb Navigation */}
      {navigationHistory.length > 1 && (
        <div className="px-3 py-2 border-b border-zinc-800 overflow-hidden">
          <div className="flex items-center gap-1 text-xs">
            {navigationHistory.slice(-3).map((user, index, arr) => {
              const actualIndex = navigationHistory.length - arr.length + index;
              return (
                <span key={user.id} className="flex items-center min-w-0">
                  {index > 0 && (
                    <ChevronRight className="w-3 h-3 mx-0.5 text-zinc-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={() => onNavigateToIndex(actualIndex)}
                    className={`truncate max-w-[60px] hover:text-purple-400 transition-colors ${
                      actualIndex === navigationHistory.length - 1
                        ? "text-purple-400 font-medium"
                        : "text-zinc-400"
                    }`}
                    disabled={actualIndex === navigationHistory.length - 1}
                    title={actualIndex === 0 ? "You" : user.name}
                  >
                    {actualIndex === 0 ? "You" : user.name}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Header with focused user */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-800/50">
        {canGoBack && (
          <button
            onClick={onGoBack}
            className="flex items-center text-xs text-purple-400 hover:text-purple-300 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </button>
        )}

        {focusedUser && (
          <div className="flex items-center gap-2">
            {focusedUser.avatar ? (
              <img
                src={focusedUser.avatar}
                alt={focusedUser.name}
                className={`w-10 h-10 rounded-full object-cover border-2 flex-shrink-0 ${
                  focusedUser.userType === "founder"
                    ? "border-amber-500"
                    : "border-purple-500"
                }`}
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 flex-shrink-0 ${
                focusedUser.userType === "founder"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-500"
                  : "bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-500"
              }`}>
                {focusedUser.name?.charAt(0) || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-white text-sm truncate">
                  {navigationHistory.length === 1 ? "You" : focusedUser.name}
                </h3>
                {focusedUser.userType === "founder" ? (
                  <span className="flex-shrink-0 px-1.5 py-px rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20">
                    Founder
                  </span>
                ) : (
                  <span className="flex-shrink-0 px-1.5 py-px rounded text-[9px] font-semibold bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/20">
                    Member
                  </span>
                )}
                {(focusedUser.purchases?.unilevelPlus || focusedUser.isPaidFounder) && (
                  <span className="flex-shrink-0 px-1.5 py-px rounded text-[9px] font-semibold bg-green-500/15 text-green-400 ring-1 ring-green-500/20">
                    $25
                  </span>
                )}
                {focusedUser.purchases?.basicPlan && (
                  <PlanBadge plan="basic" />
                )}
                {focusedUser.purchases?.proPlan && (
                  <PlanBadge plan="pro" />
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {focusedUser.directReferrals} referrals
                {focusedUser.totalReferrals !== undefined &&
                  focusedUser.totalReferrals > focusedUser.directReferrals && (
                    <span className="text-zinc-500">
                      {" "}
                      ({focusedUser.totalReferrals} total)
                    </span>
                  )}
              </p>
            </div>
            <button
              onClick={() => onViewProfile(focusedUser.id)}
              className="p-1.5 rounded hover:bg-zinc-700 transition-colors flex-shrink-0"
              title="View Profile"
            >
              <User className="w-4 h-4 text-zinc-400 hover:text-purple-400" />
            </button>
          </div>
        )}
      </div>

      {/* Search Mode Toggle + Search Bar */}
      <div className="px-2 py-1.5 border-b border-zinc-800 space-y-1.5">
        {/* Toggle between search modes - only at root level */}
        {isAtRoot && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setEmailSearchMode(false);
                setEmailInput("");
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                !emailSearchMode
                  ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                  : "text-zinc-500 hover:text-zinc-300 border border-zinc-700/50"
              }`}
            >
              <Search className="w-2.5 h-2.5" />
              Referrals
            </button>
            <button
              onClick={() => {
                setEmailSearchMode(true);
                handleClearSearch();
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                emailSearchMode
                  ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                  : "text-zinc-500 hover:text-zinc-300 border border-zinc-700/50"
              }`}
            >
              <Mail className="w-2.5 h-2.5" />
              Find by Email
            </button>
          </div>
        )}

        {/* Search input */}
        {isAtRoot && emailSearchMode ? (
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="absolute left-2 w-3 h-3 text-zinc-500" />
              <input
                type="email"
                placeholder="Enter full email address..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEmailSearch();
                }}
                className="placeholder:text-xs w-full pl-6 pr-8 py-1 bg-transparent border-0 text-[11px] text-white placeholder-zinc-500 focus:outline-none transition-colors"
                disabled={isEmailSearching}
              />
              {emailInput && !isEmailSearching && (
                <button
                  onClick={() => setEmailInput("")}
                  className="absolute right-1.5 p-0.5 hover:bg-zinc-700 rounded-sm transition-colors"
                >
                  <X className="w-2.5 h-2.5 text-zinc-400" />
                </button>
              )}
              {isEmailSearching && (
                <Loader2 className="absolute right-2 w-3 h-3 animate-spin text-purple-500" />
              )}
            </div>
            <button
              onClick={handleEmailSearch}
              disabled={!emailInput.trim() || isEmailSearching}
              className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors"
            >
              {isEmailSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching network...
                </>
              ) : (
                <>
                  Search entire network
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
            {emailSearchError && (
              <p className="text-[10px] text-red-400 px-1">{emailSearchError}</p>
            )}
            <p className="text-[9px] text-zinc-600 px-1">
              Searches all levels of your downline, not just direct referrals
            </p>
          </div>
        ) : (
          <div className="relative flex items-center">
            <Search className="absolute left-2 w-3 h-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, email, or location..."
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="placeholder:text-xs w-full pl-6 pr-6 py-1 bg-transparent border-0 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
            {localSearchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-1.5 p-0.5 hover:bg-zinc-700 rounded-sm transition-colors"
              >
                <X className="w-2.5 h-2.5 text-zinc-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Referrals List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {isLoading ? (
          <div className="p-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
          </div>
        ) : directChildren.length === 0 ? (
          <div className="p-6 text-center">
            {isSearching ? (
              <>
                <Search className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                <p className="text-zinc-500 text-sm">No members found</p>
                <p className="text-zinc-600 text-xs mt-1">
                  Try a different search
                </p>
              </>
            ) : (
              <>
                <Users className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-zinc-500 text-sm">No referrals yet</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {directChildren.map((child) => (
              <AccordionItem
                key={child.id}
                user={child}
                isExpanded={expandedItems.has(child.id)}
                onToggle={() => toggleExpand(child.id)}
                onSelect={() => onSelectUser(child.id)}
                onViewProfile={() => onViewProfile(child.id)}
                upActiveLegNumber={legNumberMap.get(child.id)}
                totalUpActiveDirects={totalUpActive}
              />
            ))}

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="p-3 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className="text-xs text-zinc-500">Loading more...</span>
              </div>
            )}

            {/* Load more button (fallback if scroll doesn't trigger) */}
            {hasMore && !isLoadingMore && (
              <button
                onClick={onLoadMore}
                className="w-full p-3 text-xs text-purple-400 hover:text-purple-300 hover:bg-zinc-800/50 transition-colors"
              >
                Load more ({directChildren.length} of {totalCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Footer - desktop only */}
      <div className="hidden md:block p-3 border-t border-zinc-800 bg-zinc-800/30">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <div className="text-xl font-bold text-purple-400">
              {isSearching ? (
                <span>
                  {directChildren.length}
                  <span className="text-sm font-normal text-zinc-500">
                    /{totalCount}
                  </span>
                </span>
              ) : (
                <span>
                  {directChildren.length}
                  {hasMore && (
                    <span className="text-sm font-normal text-zinc-500">
                      /{totalCount}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="text-[10px] text-zinc-500">
              {isSearching ? "Results" : "Loaded"}
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-400">
              {directChildren.filter((c) => c.hasChildren).length}
            </div>
            <div className="text-[10px] text-zinc-500">With Network</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanBadge({ plan, size = "md" }: { plan: "basic" | "pro"; size?: "sm" | "md" }) {
  const isBasic = plan === "basic";
  const letter = isBasic ? "D" : "F";
  const label = isBasic ? "Distributor's Office" : "Founder's Office";
  const colors = isBasic
    ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20"
    : "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20";
  const textSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  return (
    <span
      className={`group/badge relative flex-shrink-0 inline-flex items-center rounded font-semibold ${colors} ${textSize} cursor-default overflow-hidden transition-all duration-300 ease-in-out`}
      style={{ maxWidth: "fit-content" }}
    >
      <span className="relative px-1.5 py-px">
        <span className="inline-block transition-all duration-300 ease-in-out group-hover/badge:opacity-0 group-hover/badge:scale-75 group-hover/badge:absolute group-hover/badge:inset-0">
          {letter}
        </span>
        <span className="inline-block max-w-0 opacity-0 scale-95 whitespace-nowrap transition-all duration-300 ease-in-out group-hover/badge:max-w-[120px] group-hover/badge:opacity-100 group-hover/badge:scale-100">
          {label}
        </span>
      </span>
    </span>
  );
}

function LegBadge({
  legNumber,
  totalUpActive,
}: {
  legNumber: number;
  totalUpActive: number;
}) {
  // Tier eligibility logic matches services/unilevelPlusCommission.ts:
  //   INFINITY_T1_MIN_LEGS = 4  → leg must be at position ≥4 AND upline must have ≥4 UP-active directs
  //   INFINITY_T2_MIN_LEGS = 10 → same but for position ≥10 and count ≥10
  const isT2Leg = totalUpActive >= 10 && legNumber >= 10;
  const isT1Leg = totalUpActive >= 4 && legNumber >= 4;
  const colors = isT2Leg
    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
    : isT1Leg
      ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20"
      : "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30";
  const title = isT2Leg
    ? `UP-active leg #${legNumber} of ${totalUpActive} — earns Tier 1 AND Tier 2 infinity bonuses for the upline when sales originate in this leg's downline`
    : isT1Leg
      ? `UP-active leg #${legNumber} of ${totalUpActive} — earns Tier 1 infinity bonus for the upline. T2 needs leg position ≥10.`
      : `UP-active leg #${legNumber} of ${totalUpActive} — no infinity tier yet. ${totalUpActive < 4 ? `Upline needs ≥4 UP-active directs (currently ${totalUpActive}).` : "Leg position must be ≥4 for Tier 1."}`;
  return (
    <span
      className={`flex-shrink-0 px-1 py-px rounded text-[8px] font-semibold tabular-nums cursor-default ${colors}`}
      title={title}
    >
      L{legNumber}
    </span>
  );
}

function AccordionItem({
  user,
  isExpanded,
  onToggle,
  onSelect,
  onViewProfile,
  upActiveLegNumber,
  totalUpActiveDirects,
}: {
  user: AffiliateUser;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onViewProfile: () => void;
  // Position of this user in the focused parent's UP-active directs list
  // (1-based). Undefined when this user isn't UP-active (no badge shown).
  upActiveLegNumber?: number;
  // Total count of UP-active directs in the focused parent — needed to
  // decide whether THIS leg qualifies for T1 / T2 (gates depend on both
  // the position and the parent's overall UP-active count).
  totalUpActiveDirects: number;
}) {
  return (
    <div className="hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-center p-2 gap-2">
        {/* Expand/collapse button */}
        <button
          onClick={onToggle}
          className={`p-0.5 rounded hover:bg-zinc-700 transition-colors flex-shrink-0 ${
            !user.hasChildren ? "opacity-0 pointer-events-none" : ""
          }`}
          disabled={!user.hasChildren}
        >
          {user.hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>

        {/* User info - clickable to navigate */}
        <button
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 text-left group min-w-0"
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className={`w-8 h-8 rounded-full object-cover border transition-colors flex-shrink-0 ${
                user.userType === "founder"
                  ? "border-amber-500/60 group-hover:border-amber-400"
                  : "border-zinc-700 group-hover:border-purple-500"
              }`}
            />
          ) : (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border transition-colors flex-shrink-0 ${
              user.userType === "founder"
                ? "bg-gradient-to-br from-amber-600 to-orange-700 border-amber-500/60 group-hover:border-amber-400"
                : "bg-gradient-to-br from-purple-600 to-indigo-700 border-zinc-700 group-hover:border-purple-500"
            }`}>
              {user.name?.charAt(0) || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                {user.name}
              </p>
              {user.userType === "founder" && (
                <span className="flex-shrink-0 px-1 py-px rounded text-[8px] font-semibold bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20">
                  F
                </span>
              )}
              {(user.purchases?.unilevelPlus || user.isPaidFounder) && (
                <span className="flex-shrink-0 px-1 py-px rounded text-[8px] font-semibold bg-green-500/15 text-green-400 ring-1 ring-green-500/20">
                  $25
                </span>
              )}
              {upActiveLegNumber !== undefined && (
                <LegBadge
                  legNumber={upActiveLegNumber}
                  totalUpActive={totalUpActiveDirects}
                />
              )}
              {user.purchases?.basicPlan && (
                <PlanBadge plan="basic" size="sm" />
              )}
              {user.purchases?.proPlan && (
                <PlanBadge plan="pro" size="sm" />
              )}
            </div>
            <p className="text-[10px] text-zinc-500">
              {user.directReferrals} refs
            </p>
          </div>
        </button>

        {/* View Profile button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile();
          }}
          className="p-1.5 rounded hover:bg-zinc-700 transition-colors flex-shrink-0"
          title="View Profile"
        >
          <User className="w-4 h-4 text-zinc-400 hover:text-purple-400" />
        </button>

        {/* Status indicator - compact dot */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            user.status === "active" ? "bg-green-500" : "bg-zinc-600"
          }`}
          title={user.status}
        />
      </div>

      {/* Expanded preview */}
      {isExpanded && user.hasChildren && (
        <div className="pl-8 pr-2 pb-2 flex items-center gap-2">
          <button
            onClick={onSelect}
            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            View {user.directReferrals} referral
            {user.directReferrals !== 1 ? "s" : ""} →
          </button>
        </div>
      )}
    </div>
  );
}
