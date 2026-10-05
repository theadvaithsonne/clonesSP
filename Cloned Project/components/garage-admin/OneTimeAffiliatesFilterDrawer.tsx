"use client";

// Filter drawer for the One Time Affiliates table. Same field-list →
// per-field screen morph as NetworkChainSubsFilterDrawer, with the columns
// Shorupan filters this page by:
//   - Downline / Sponsor:      pick a person; table scopes to their tree
//   - Location:                country ▸ state/territory ▸ city
//   - NetworkChain Subscriber: Yes / No / Any     (tri-state)
//   - Activation date:         preset or custom from/to
//   - Joining date:            preset or custom from/to
//   - Reserves / Assigned / Directs: count buckets
//
// Backend contract — a query layer on the EXISTING table endpoint
// GET /garage-admin/one-time-affiliates (no separate search route):
//   ?rootUserId=<id>
//   &country=india&state=karnataka&city=bangalore
//   &isSubscriber=yes|no
//   &activatedFrom=YYYY-MM-DD&activatedTo=YYYY-MM-DD
//   &joiningFrom=YYYY-MM-DD&joiningTo=YYYY-MM-DD
//   &reservesRange=1-5&assignedRange=0-0&directsRange=51-Infinity

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Search,
  Share2,
  UserCheck,
  Users,
  ChevronRight,
  X,
} from "lucide-react";
import {
  DownlineScreen,
  PersonAvatar,
  type DownlinePerson,
} from "@/components/garage-admin/downline-scope";
import { COUNTRIES, flagEmoji } from "@/lib/countries";

export type { DownlinePerson };

export type SubscriberFilter = "yes" | "no";

/**
 * One distinct country ▸ state ▸ city triple present in the data, with the
 * number of affiliates in it. Served by GET /garage-admin/one-time-affiliates
 * as `locations`, computed before the location filter is applied.
 */
export interface LocationFacet {
  country: string;
  state: string;
  city: string;
  count: number;
}

export interface OneTimeAffiliateFilters {
  /** Scope the whole table to this person's downline tree (sent as ?rootUserId). */
  uplineUserId?: string;
  /** Display-only, so the page can render the "Viewing the downline of …" banner. */
  uplineUserName?: string;
  uplineUserEmail?: string;
  uplineUserAvatar?: string | null;
  uplineUserCountry?: string;
  /**
   * Exceptions to the downline scope (sent as repeated ?excludeUserId): drop
   * everyone BENEATH each of these people from the results. The person
   * themselves stays — they are one of the root's people; it is what they
   * recruited that is set aside. Lets an admin ask for "everyone under X
   * except what these people brought in".
   * Only meaningful with an upline selected, which is why it lives inside the
   * Downline / Sponsor screen.
   */
  excludedUsers?: DownlinePerson[];
  country?: string;
  state?: string;
  city?: string;
  isSubscriber?: SubscriberFilter;
  activatedFrom?: string;
  activatedTo?: string;
  joiningFrom?: string;
  joiningTo?: string;
  reservesRange?: string;
  assignedRange?: string;
  directsRange?: string;
}

type FieldId =
  | "downline"
  | "location"
  | "subscriber"
  | "activated"
  | "joining"
  | "reserves"
  | "assigned"
  | "directs";

/** Shared count buckets. Values are the exact strings the backend parses. */
const COUNT_BUCKETS: { value: string; label: string }[] = [
  { value: "0-0", label: "None (0)" },
  { value: "1-5", label: "1 – 5" },
  { value: "6-10", label: "6 – 10" },
  { value: "11-20", label: "11 – 20" },
  { value: "21-50", label: "21 – 50" },
  { value: "51-Infinity", label: "51+" },
];

const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: "Any date", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

export function OneTimeAffiliatesFilterDrawer({
  open,
  onClose,
  filters,
  onApply,
  locations = [],
}: {
  open: boolean;
  onClose: () => void;
  filters: OneTimeAffiliateFilters;
  onApply: (f: OneTimeAffiliateFilters) => void;
  /** Location options from the last table load — see LocationFacet. */
  locations?: LocationFacet[];
}) {
  // Draft state so navigating between screens doesn't commit anything until
  // the user hits Apply.
  const [draft, setDraft] = useState<OneTimeAffiliateFilters>(filters);
  const [screen, setScreen] = useState<FieldId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setScreen(null);
    }
  }, [open, filters]);

  const anyActive = hasAnyFilter(draft);

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mr-6 flex h-[calc(100vh-48px)] w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-3">
                {screen !== null && (
                  <button
                    type="button"
                    onClick={() => setScreen(null)}
                    className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h2 className="text-sm font-semibold text-white">
                  {screen === null ? "Filters" : SCREEN_TITLES[screen]}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {screen === null && (
                <FieldList
                  items={[
                    {
                      id: "downline",
                      label: "Downline / Sponsor",
                      icon: Users,
                      value:
                        (draft.uplineUserName ||
                          draft.uplineUserEmail ||
                          "") +
                          (draft.uplineUserId && draft.excludedUsers?.length
                            ? draft.excludedUsers.length === 1
                              ? ` — except ${
                                  draft.excludedUsers[0].name ||
                                  draft.excludedUsers[0].email ||
                                  "one leg"
                                }`
                              : ` — except ${draft.excludedUsers.length} legs`
                            : "") ||
                        (draft.uplineUserId
                          ? "Selected person"
                          : "Any person (all downlines)"),
                      active: !!draft.uplineUserId,
                    },
                    {
                      id: "location",
                      label: "Location",
                      icon: MapPin,
                      value: locationSummary(draft),
                      active:
                        !!draft.country?.trim() ||
                        !!draft.state?.trim() ||
                        !!draft.city?.trim(),
                    },
                    {
                      id: "subscriber",
                      label: "NetworkChain Subscriber",
                      icon: UserCheck,
                      value: subscriberSummary(draft.isSubscriber),
                      active: !!draft.isSubscriber,
                    },
                    {
                      id: "activated",
                      label: "Activation date",
                      icon: Calendar,
                      value: dateSummary(
                        draft.activatedFrom,
                        draft.activatedTo
                      ),
                      active: !!draft.activatedFrom || !!draft.activatedTo,
                    },
                    {
                      id: "joining",
                      label: "Joining date",
                      icon: CalendarPlus,
                      value: dateSummary(draft.joiningFrom, draft.joiningTo),
                      active: !!draft.joiningFrom || !!draft.joiningTo,
                    },
                    {
                      id: "reserves",
                      label: "Reserves",
                      icon: Layers,
                      value: bucketSummary(draft.reservesRange),
                      active: !!draft.reservesRange,
                    },
                    {
                      id: "assigned",
                      label: "Assigned",
                      icon: Share2,
                      value: bucketSummary(draft.assignedRange),
                      active: !!draft.assignedRange,
                    },
                    {
                      id: "directs",
                      label: "Directs",
                      icon: Users,
                      value: bucketSummary(draft.directsRange),
                      active: !!draft.directsRange,
                    },
                  ]}
                  onOpen={setScreen}
                />
              )}

              {screen === "downline" && (
                <DownlineScreen
                  selected={
                    draft.uplineUserId
                      ? {
                          id: draft.uplineUserId,
                          name: draft.uplineUserName ?? null,
                          email: draft.uplineUserEmail ?? null,
                          avatar: draft.uplineUserAvatar ?? null,
                        }
                      : null
                  }
                  onChange={(person) =>
                    setDraft((d) => ({
                      ...d,
                      uplineUserId: person?.id,
                      uplineUserName: person?.name ?? undefined,
                      uplineUserEmail: person?.email ?? undefined,
                      uplineUserAvatar: person?.avatar ?? undefined,
                      // Clearing the root clears its exceptions too — an
                      // exclusion with nothing to exclude from would silently
                      // do nothing while still showing as an active filter.
                      ...(person ? {} : { excludedUsers: undefined }),
                    }))
                  }
                  excluded={draft.excludedUsers ?? []}
                  onChangeExcluded={(people) =>
                    setDraft((d) => ({
                      ...d,
                      excludedUsers: people.length ? people : undefined,
                    }))
                  }
                />
              )}

              {screen === "location" && (
                <LocationScreen
                  country={draft.country}
                  state={draft.state}
                  city={draft.city}
                  catalog={locations}
                  onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
                />
              )}

              {screen === "subscriber" && (
                <SubscriberScreen
                  selected={draft.isSubscriber}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, isSubscriber: next }))
                  }
                />
              )}

              {screen === "activated" && (
                <DateScreen
                  from={draft.activatedFrom}
                  to={draft.activatedTo}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      activatedFrom: next.from,
                      activatedTo: next.to,
                    }))
                  }
                />
              )}

              {screen === "joining" && (
                <DateScreen
                  from={draft.joiningFrom}
                  to={draft.joiningTo}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      joiningFrom: next.from,
                      joiningTo: next.to,
                    }))
                  }
                />
              )}

              {screen === "reserves" && (
                <BucketScreen
                  selected={draft.reservesRange}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, reservesRange: next }))
                  }
                />
              )}

              {screen === "assigned" && (
                <BucketScreen
                  selected={draft.assignedRange}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, assignedRange: next }))
                  }
                />
              )}

              {screen === "directs" && (
                <BucketScreen
                  selected={draft.directsRange}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, directsRange: next }))
                  }
                />
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  onApply({});
                  onClose();
                }}
                disabled={!anyActive}
                className="text-sm text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                className="flex h-9 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
              >
                Apply
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(body, document.body);
}

/** True when at least one filter would narrow the table. */
export function hasAnyFilter(f: OneTimeAffiliateFilters): boolean {
  return (
    !!f.uplineUserId ||
    !!f.country?.trim() ||
    !!f.state?.trim() ||
    !!f.city?.trim() ||
    !!f.isSubscriber ||
    !!f.activatedFrom ||
    !!f.activatedTo ||
    !!f.joiningFrom ||
    !!f.joiningTo ||
    !!f.reservesRange ||
    !!f.assignedRange ||
    !!f.directsRange
  );
}

/** Serialize the filters onto the table's existing query string. */
export function applyFiltersToQuery(
  qs: URLSearchParams,
  f: OneTimeAffiliateFilters
) {
  // Downline scoping reuses the table's existing ?rootUserId param.
  if (f.uplineUserId) qs.set("rootUserId", f.uplineUserId);
  // Exceptions only travel with a root — the backend ignores them alone, and
  // sending them would make the URL claim a filter that does nothing. One
  // repeated param per excluded leg.
  if (f.uplineUserId) {
    for (const p of f.excludedUsers ?? []) qs.append("excludeUserId", p.id);
  }
  if (f.state?.trim()) qs.set("state", f.state.trim());
  if (f.city?.trim()) qs.set("city", f.city.trim());
  if (f.isSubscriber) qs.set("isSubscriber", f.isSubscriber);
  if (f.activatedFrom) qs.set("activatedFrom", f.activatedFrom);
  if (f.activatedTo) qs.set("activatedTo", f.activatedTo);
  if (f.joiningFrom) qs.set("joiningFrom", f.joiningFrom);
  if (f.joiningTo) qs.set("joiningTo", f.joiningTo);
  if (f.reservesRange) qs.set("reservesRange", f.reservesRange);
  if (f.assignedRange) qs.set("assignedRange", f.assignedRange);
  if (f.directsRange) qs.set("directsRange", f.directsRange);
  if (f.country?.trim()) qs.set("country", f.country.trim());
}

const SCREEN_TITLES: Record<FieldId, string> = {
  downline: "Downline / Sponsor",
  location: "Location",
  subscriber: "NetworkChain Subscriber",
  activated: "Activation date",
  joining: "Joining date",
  reserves: "Reserves",
  assigned: "Assigned",
  directs: "Directs",
};

/* ── Screens ── */

function FieldList({
  items,
  onOpen,
}: {
  items: Array<{
    id: FieldId;
    label: string;
    icon: typeof UserCheck;
    value: string;
    active: boolean;
  }>;
  onOpen: (id: FieldId) => void;
}) {
  return (
    <div className="flex flex-col">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onOpen(it.id)}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                it.active
                  ? "bg-brand/15 text-brand"
                  : "bg-white/[0.03] text-zinc-400"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white">
                {it.label}
              </div>
              <div className="truncate text-[12px] text-zinc-400">
                {it.value}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        );
      })}
    </div>
  );
}

function SubscriberScreen({
  selected,
  onChange,
}: {
  selected?: SubscriberFilter;
  onChange: (next?: SubscriberFilter) => void;
}) {
  const options: { value?: SubscriberFilter; label: string }[] = [
    { value: undefined, label: "Any" },
    { value: "yes", label: "Yes — subscribed" },
    { value: "no", label: "No — one time only" },
  ];
  return (
    <OptionList
      options={options.map((o) => ({
        key: o.value ?? "any",
        label: o.label,
        on: selected === o.value,
        onSelect: () => onChange(o.value),
      }))}
    />
  );
}

function BucketScreen({
  selected,
  onChange,
}: {
  selected?: string;
  onChange: (next?: string) => void;
}) {
  return (
    <OptionList
      options={[
        {
          key: "any",
          label: "Any amount",
          on: !selected,
          onSelect: () => onChange(undefined),
        },
        ...COUNT_BUCKETS.map((b) => ({
          key: b.value,
          label: b.label,
          on: selected === b.value,
          // Re-selecting the active bucket clears it.
          onSelect: () => onChange(selected === b.value ? undefined : b.value),
        })),
      ]}
    />
  );
}

/**
 * Country ▸ State/Territory ▸ City, driven by the `locations` facet the
 * table endpoint returns — the distinct triples that actually exist in the
 * data at the current scope.
 *
 * This replaced free-text state/city inputs, which didn't work: the admin
 * had to guess the exact stored spelling, and the data says "Bengaluru"
 * (23 affiliates) where everyone types "Bangalore" (1). Picking from real
 * values means a selection always matches, and because each option carries
 * its whole triple, choosing a city fills in its state and country for free.
 */
function LocationScreen({
  country,
  state,
  city,
  catalog,
  onChange,
}: {
  country?: string;
  state?: string;
  city?: string;
  catalog: LocationFacet[];
  onChange: (next: {
    country?: string;
    state?: string;
    city?: string;
  }) => void;
}) {
  // Options cascade downward: states are those inside the chosen country,
  // cities those inside the chosen country + state. Nothing cascades upward
  // — a city list is never filtered by a city.
  const countryOptions = useMemo(
    () => rollUp(catalog, (e) => e.country),
    [catalog]
  );

  const stateOptions = useMemo(
    () =>
      rollUp(
        catalog.filter((e) => !country || eqLoc(e.country, country)),
        (e) => e.state
      ),
    [catalog, country]
  );

  const cityOptions = useMemo(
    () =>
      rollUp(
        catalog.filter(
          (e) =>
            (!country || eqLoc(e.country, country)) &&
            (!state || eqLoc(e.state, state))
        ),
        (e) => e.city
      ),
    [catalog, country, state]
  );

  /** Selecting a city adopts its parents; ambiguous names resolve via the triple. */
  const pickCity = (value: string) => {
    const parent = catalog.find(
      (e) =>
        eqLoc(e.city, value) &&
        (!country || eqLoc(e.country, country)) &&
        (!state || eqLoc(e.state, state))
    );
    onChange({
      country: parent?.country || country,
      state: parent?.state || state,
      city: value,
    });
  };

  /** Selecting a state adopts its country and drops a city that no longer fits. */
  const pickState = (value: string) => {
    const parent = catalog.find(
      (e) => eqLoc(e.state, value) && (!country || eqLoc(e.country, country))
    );
    const nextCountry = parent?.country || country;
    const cityStillValid =
      city &&
      catalog.some(
        (e) =>
          eqLoc(e.city, city) &&
          eqLoc(e.state, value) &&
          (!nextCountry || eqLoc(e.country, nextCountry))
      );
    onChange({
      country: nextCountry,
      state: value,
      city: cityStillValid ? city : undefined,
    });
  };

  /** Selecting a country drops any state/city that isn't inside it. */
  const pickCountry = (value: string) => {
    const stateStillValid =
      state &&
      catalog.some((e) => eqLoc(e.country, value) && eqLoc(e.state, state));
    const cityStillValid =
      city &&
      catalog.some(
        (e) =>
          eqLoc(e.country, value) &&
          eqLoc(e.city, city) &&
          (!stateStillValid || eqLoc(e.state, state!))
      );
    onChange({
      country: value,
      state: stateStillValid ? state : undefined,
      city: cityStillValid ? city : undefined,
    });
  };

  return (
    <div className="flex flex-col">
      {catalog.length === 0 && (
        <div className="px-5 pt-4 text-[12px] text-zinc-500">
          No location data in the current scope.
        </div>
      )}

      <PickerField
        label="Country"
        icon={Globe}
        placeholder="Search countries"
        emptyLabel="All countries"
        value={country}
        options={countryOptions}
        renderPrefix={(name) => flagFor(name)}
        onSelect={pickCountry}
        onClear={() => onChange({ country: undefined, state, city })}
      />

      <PickerField
        label="State / Province / Territory"
        icon={MapPin}
        placeholder="Search states and territories"
        emptyLabel="All states"
        value={state}
        options={stateOptions}
        onSelect={pickState}
        onClear={() => onChange({ country, state: undefined, city })}
      />

      <PickerField
        label="City"
        icon={MapPin}
        placeholder="Search cities"
        emptyLabel="All cities"
        value={city}
        options={cityOptions}
        onSelect={pickCity}
        onClear={() => onChange({ country, state, city: undefined })}
      />

      <p className="px-5 pb-5 text-[11px] text-zinc-500">
        Options come from the affiliates currently in scope, so every choice
        returns rows. Picking a city fills in its state and country.
      </p>
    </div>
  );
}

/**
 * One location level: a selected chip, or a search box over the level's real
 * values with their row counts.
 */
function PickerField({
  label,
  icon: Icon,
  placeholder,
  emptyLabel,
  value,
  options,
  renderPrefix,
  onSelect,
  onClear,
}: {
  label: string;
  icon: typeof Globe;
  placeholder: string;
  emptyLabel: string;
  value?: string;
  options: Array<{ value: string; count: number }>;
  renderPrefix?: (value: string) => string | null;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.value.toLowerCase().includes(term));
  }, [options, query]);

  return (
    <div className="border-b border-white/[0.04] px-5 py-4 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>

      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/[0.06] px-3 py-2">
          {renderPrefix?.(value) && (
            <span className="text-[15px] leading-none" aria-hidden>
              {renderPrefix(value)}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] text-white">
            {value}
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClear();
            }}
            className="rounded p-0.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            aria-label={`Clear ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={query}
              placeholder={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-white/[0.2]"
            />
          </div>

          {options.length > 0 && (
            <div className="glass-scrollbar mt-2 max-h-[168px] overflow-y-auto rounded-lg border border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  onClear();
                }}
                className="flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex-1 text-[13px] text-zinc-300">
                  {emptyLabel}
                </span>
              </button>
              {matches.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    onSelect(o.value);
                  }}
                  className="flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  {renderPrefix?.(o.value) && (
                    <span className="text-[15px] leading-none" aria-hidden>
                      {renderPrefix(o.value)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white">
                    {o.value}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                    {o.count}
                  </span>
                </button>
              ))}
              {matches.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-zinc-500">
                  Nothing matches “{query.trim()}”.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Same folding the backend uses, so FE grouping can't drift from BE matching. */
function normLoc(v?: string | null): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function eqLoc(a?: string | null, b?: string | null): boolean {
  return normLoc(a) === normLoc(b);
}

/** Collapse facet triples to one level's distinct values, summing row counts. */
function rollUp(
  entries: LocationFacet[],
  pick: (e: LocationFacet) => string
): Array<{ value: string; count: number }> {
  const byKey = new Map<string, { value: string; count: number }>();
  for (const e of entries) {
    const value = pick(e);
    if (!value) continue;
    const key = normLoc(value);
    const hit = byKey.get(key);
    if (hit) hit.count += e.count;
    else byKey.set(key, { value, count: e.count });
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value)
  );
}

/**
 * Flag for a country NAME. The stored data is free text, so an exact hit on
 * the ISO catalog is the common case and anything unrecognised ("Usa",
 * "UAE", "Orlando , Florida") just renders a globe rather than a wrong flag.
 */
function flagFor(name: string): string {
  const hit = COUNTRIES.find((c) => eqLoc(c.name, name));
  return hit ? flagEmoji(hit.code) : "🌐";
}

function DateScreen({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const activePreset = presetForRange(from, to);
  return (
    <div className="flex flex-col">
      {DATE_PRESETS.map((p) => {
        const on = p.label === activePreset;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              if (p.days == null)
                return onChange({ from: undefined, to: undefined });
              const now = new Date();
              const fromD = new Date(now);
              fromD.setDate(now.getDate() - p.days);
              onChange({
                from: fromD.toISOString().slice(0, 10),
                to: now.toISOString().slice(0, 10),
              });
            }}
            className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
          >
            <span className="flex-1 text-[13px] text-white">{p.label}</span>
            {on && <Tick />}
          </button>
        );
      })}

      {/* Custom */}
      <div className="px-5 py-4">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
          Custom range
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            From
            <input
              type="date"
              value={from ?? ""}
              onChange={(e) =>
                onChange({ from: e.target.value || undefined, to })
              }
              className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            To
            <input
              type="date"
              value={to ?? ""}
              onChange={(e) => onChange({ from, to: e.target.value || undefined })}
              className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

/** Single-select row list shared by the subscriber + bucket screens. */
function OptionList({
  options,
}: {
  options: Array<{
    key: string;
    label: string;
    on: boolean;
    onSelect: () => void;
  }>;
}) {
  return (
    <div className="flex flex-col">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={o.onSelect}
          className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.02]"
        >
          <span className="flex-1 text-[13px] text-white">{o.label}</span>
          {o.on && <Tick />}
        </button>
      ))}
    </div>
  );
}

function Tick() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand">
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3 text-black"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

/* ── formatting ── */

/** "Country, State, City" — narrowest-first reads better than the reverse. */
function locationSummary(f: OneTimeAffiliateFilters): string {
  const parts = [f.city, f.state, f.country]
    .map((p) => p?.trim())
    .filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "Any location";
}

function subscriberSummary(v?: SubscriberFilter): string {
  if (v === "yes") return "Yes — subscribed";
  if (v === "no") return "No — one time only";
  return "Any";
}

function bucketSummary(v?: string): string {
  if (!v) return "Any amount";
  return COUNT_BUCKETS.find((b) => b.value === v)?.label ?? v;
}

function dateSummary(from?: string, to?: string): string {
  if (!from && !to) return "Any date";
  const preset = presetForRange(from, to);
  if (preset && preset !== "Any date") return preset;
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

function presetForRange(from?: string, to?: string): string {
  if (!from && !to) return "Any date";
  if (!from || !to) return "";
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 10);
  if (to !== nowIso) return "";
  const days = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
  const match = DATE_PRESETS.find((p) => p.days === days);
  return match?.label ?? "";
}
