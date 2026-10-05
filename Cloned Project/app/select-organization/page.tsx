"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { clearToken, getToken, getUserDataFromToken, saveOrgId, saveToken } from "@/lib/auth";
import {
  fetchDiscoverCategories,
  fetchDiscoverOffices,
  fetchPublicOffice,
  fetchTrendingOffices,
  type TrendingOffice,
  type DiscoverCategory,
  type DiscoverOffice,
  type PublicOfficeDetails,
} from "@/lib/discover-api";
import { BAT246_ORG_ID, bat246LandingPath } from "@/lib/bat246Office";
import { OfficesTopBar } from "@/components/offices/OfficesTopBar";
import { OfficeGrid, OfficeGridView, type GridMode } from "@/components/offices/OfficeGridView";
import { CategoryRail, CategoryTiles, CategoryTilesSkeleton } from "@/components/offices/CategoryNav";
import {
  FindOfficeCard,
  JoinAnotherOfficeTile,
  OfficeCard,
  OfficeCardSkeleton,
  OfficeSwitcherCard,
  type OfficeCardData,
} from "@/components/offices/OfficeCard";
import { JoinOfficeDialog } from "@/components/offices/JoinOfficeDialog";
import { GettingStartedCard, HubHero, OfficesFooter } from "@/components/offices/HubSections";
import { FeaturedOffices, FeaturedOfficesSkeleton, GrowthNote } from "@/components/offices/FeaturedOffices";
import { MyOfficesView } from "@/components/offices/MyOfficesView";
import { OfficesPageSkeleton } from "@/components/offices/OfficesSkeletons";
import {
  Atmosphere,
  OfficeEmblem,
  Pill,
  SectionHeading,
  joinedLabel,
} from "@/components/offices/ui";

type Organization = {
  id: string;
  name: string;
  role: "founder" | "stakeholder";
  joinedAt: string;
  parent: boolean;
  guest?: boolean;
  icon?: string;
  status?: "active" | "pending";
};

type User = {
  id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  organizations: Organization[];
};

/** Until a member is in this many offices, the page leads with getting started. */
const OFFICE_GOAL = 3;
const GARAGE_OFFICE_NAME = "garage app";
/** URL params this page owns; everything else (redirect, intent…) is kept. */
const VIEW_PARAMS = ["view", "page", "category", "q"];

const roleLabel = (org: Organization) => (org.guest ? "Guest" : org.role === "founder" ? "Founder" : "Member");

function OrganizationSelectionPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loadingOrgId, setLoadingOrgId] = useState<string | null>(null);
  const [categories, setCategories] = useState<DiscoverCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [newestOffices, setNewestOffices] = useState<DiscoverOffice[] | null>(null);
  const [officeTotal, setOfficeTotal] = useState<number | null>(null);
  // Offices ranked by how many people joined them this week: the top two
  // are Featured, the next four Trending.
  const [trending, setTrending] = useState<{ days: number; offices: TrendingOffice[] } | null>(null);
  const [ownDetails, setOwnDetails] = useState<Record<string, PublicOfficeDetails>>({});
  const [joinTarget, setJoinTarget] = useState<OfficeCardData | null>(null);
  // Requests sent from this page, until /auth/me next reports them.
  const [requested, setRequested] = useState<OfficeCardData[]>([]);
  // Covers the page between picking an office and its workspace loading.
  const [enteringOffice, setEnteringOffice] = useState<{ name: string; icon?: string } | null>(null);

  // Prevent zoom and horizontal scroll on mobile. `clip`, not `hidden`:
  // hidden turns <body> into a scroll container, and the sticky top bar then
  // sticks to a body that never scrolls instead of to the page.
  useEffect(() => {
    document.body.style.overflowX = "clip";
    document.documentElement.style.overflowX = "clip";
    document.documentElement.style.touchAction = "pan-y pinch-zoom";

    const viewport = document.querySelector('meta[name="viewport"]');
    const originalContent = viewport?.getAttribute("content") || "";
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
      );
    }

    return () => {
      document.body.style.overflowX = "";
      document.documentElement.style.overflowX = "";
      document.documentElement.style.touchAction = "";
      if (viewport && originalContent) {
        viewport.setAttribute("content", originalContent);
      }
    };
  }, []);

  const loadProfilePicture = (userId: string) => {
    api<{ profilePicture?: string }>(`/profile?userId=${userId}`, { method: "GET" })
      .then((res) => {
        if (res.profilePicture) {
          setUser((prev) => (prev ? { ...prev, profilePicture: res.profilePicture } : prev));
        }
      })
      .catch(() => {});
  };

  // Who's here and which offices they're in. Login can hand the list over in
  // the URL; otherwise it comes from the session. Runs once — the view params
  // below change the URL without reloading the user.
  useEffect(() => {
    setCurrentOrgId(getUserDataFromToken().orgId || localStorage.getItem("garage_org_id"));

    const userId = searchParams.get("userId");
    const email = searchParams.get("email");
    const name = searchParams.get("name");
    const organizationsParam = searchParams.get("organizations");

    if (userId && email && organizationsParam) {
      try {
        const organizations = JSON.parse(organizationsParam);
        setUser({ id: userId, email, name: name || undefined, organizations });
        loadProfilePicture(userId);
        return;
      } catch {
        // Fall back to the session below.
      }
    }

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    api<{ user: User }>("/auth/me", {}, token)
      .then((res) => {
        setUser({
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          profilePicture: res.user.profilePicture || "",
          organizations: res.user.organizations || [],
        });
        if (!res.user.profilePicture) loadProfilePicture(res.user.id);
      })
      .catch((err) => {
        console.error("Error fetching organizations:", err);
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDiscoverCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
    fetchDiscoverOffices({ limit: 12 })
      .then((res) => {
        setNewestOffices(res.organizations || []);
        setOfficeTotal(res.pagination?.total ?? null);
      })
      .catch(() => setNewestOffices([]));
    fetchTrendingOffices({ days: 7, limit: 6 })
      .then(setTrending)
      .catch(() => setTrending({ days: 7, offices: [] }));
  }, []);

  const activeOffices = useMemo(() => {
    const active = (user?.organizations || []).filter((org) => org.status !== "pending");
    // The office this session is in leads the switcher.
    return [...active].sort((a, b) => Number(b.id === currentOrgId) - Number(a.id === currentOrgId));
  }, [user, currentOrgId]);

  const pendingOffices = useMemo(() => {
    const fromServer = (user?.organizations || [])
      .filter((org) => org.status === "pending")
      .map((org) => ({ _id: org.id, name: org.name, icon: org.icon }));
    const known = new Set(fromServer.map((o) => o._id));
    return [...fromServer, ...requested.filter((o) => !known.has(o._id))];
  }, [user, requested]);

  const memberIds = useMemo(() => new Set(activeOffices.map((o) => o.id)), [activeOffices]);
  const pendingIds = useMemo(() => new Set(pendingOffices.map((o) => o._id)), [pendingOffices]);
  const isNewMember = activeOffices.length < OFFICE_GOAL;

  // New members see their offices as full cards, which need each office's
  // cover and description.
  const ownOfficeIds = useMemo(
    () => (isNewMember ? [...activeOffices.map((o) => o.id), ...pendingOffices.map((o) => o._id)] : []),
    [isNewMember, activeOffices, pendingOffices]
  );
  useEffect(() => {
    ownOfficeIds.forEach((id) => {
      if (ownDetails[id]) return;
      fetchPublicOffice(id)
        .then((d) => setOwnDetails((prev) => ({ ...prev, [id]: d })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownOfficeIds]);

  // ── navigation ────────────────────────────────────────────────────────

  const q = searchParams.get("q")?.trim() || "";
  const categoryParam = searchParams.get("category")?.trim() || "";
  const pageParam = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const gridMode: GridMode | null = q
    ? { kind: "search", query: q }
    : categoryParam
      ? { kind: "category", category: categoryParam }
      : searchParams.get("view") === "all"
        ? { kind: "all", page: pageParam }
        : null;
  const showingMyOffices = !gridMode && searchParams.get("view") === "mine";

  // Moving to another view starts at the top — but only once that view has
  // rendered, or the old one visibly jumps first. Filter and page changes
  // inside a list pass `scroll: false`; the list handles its own scrolling.
  const scrollAfterNavigate = useRef(false);
  const viewKey = `${q}|${categoryParam}|${searchParams.get("view") ?? ""}|${pageParam}`;
  useLayoutEffect(() => {
    if (!scrollAfterNavigate.current) return;
    scrollAfterNavigate.current = false;
    window.scrollTo({ top: 0 });
  }, [viewKey]);

  const navigate = useCallback(
    (updates: Record<string, string | null>, { scroll = true }: { scroll?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      VIEW_PARAMS.forEach((k) => params.delete(k));
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const qs = params.toString();
      scrollAfterNavigate.current = scroll;
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const showAll = (options?: { scroll?: boolean }) => navigate({ view: "all" }, options);
  const showCategory = (category: string | null, options?: { scroll?: boolean }) =>
    category ? navigate({ category }, options) : showAll(options);

  // ── actions ───────────────────────────────────────────────────────────

  const handleCreateWorkspace = () => {
    const redirect = searchParams.get("redirect");
    // Whitelabel buyers pick their office plan before the office exists —
    // /office-payment's newOffice mode hands the choice on to /organization.
    if (searchParams.get("intent") === "whitelabel") {
      const params = new URLSearchParams({ newOffice: "true" });
      if (redirect) params.set("redirect", redirect);
      router.push(`/office-payment?${params.toString()}`);
      return;
    }
    const params = new URLSearchParams({ userId: user?.id || "" });
    if (redirect) params.set("redirect", redirect);
    router.push(`/organization?${params.toString()}`);
  };

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const handleGoBack = () => {
    const redirect = searchParams.get("redirect");
    if (redirect) {
      router.push(redirect);
    } else {
      router.push("/workspace");
    }
  };

  const selectOrganization = async (orgId: string, office?: { name: string; icon?: string }) => {
    if (!user) return;
    const membership = user.organizations.find((o) => o.id === orgId);
    setEnteringOffice(office ?? { name: membership?.name || "your office", icon: membership?.icon });
    setLoadingOrgId(orgId);
    try {
      const response = await api<{
        token: string;
        currentOrg: {
          id: string;
          name: string;
          role: string;
          joinedAt: string;
        };
      }>("/auth/select-org", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          orgId: orgId,
        }),
      });

      saveToken(response.token);
      saveOrgId(orgId);
      toast.success(`Welcome to ${response.currentOrg.name}!`);
      // BAT246 never uses /workspace or whatever ?redirect= happened to be
      // on the URL — every other org keeps the normal redirect-or-/workspace
      // behavior. Within BAT246, a qualified distributor lands on the
      // /games/bat246 hub and everyone else on Game Boards, where qualifying
      // happens (see bat246LandingPath).
      if (orgId === BAT246_ORG_ID) {
        router.push(await bat246LandingPath());
      } else {
        router.push(searchParams.get("redirect") || "/workspace");
      }
    } catch {
      toast.error("Failed to select organization");
      setLoadingOrgId(null);
      setEnteringOffice(null);
    }
  };

  /** Your own offices open straight away; any other shows the join dialog. */
  const openOffice = (office: OfficeCardData) => {
    if (memberIds.has(office._id)) selectOrganization(office._id, office);
    else setJoinTarget(office);
  };

  const discoverFooter = (office: DiscoverOffice) =>
    memberIds.has(office._id) ? (
      <Pill tone="success" className="ml-auto">
        Joined
      </Pill>
    ) : pendingIds.has(office._id) ? (
      <Pill tone="neutral" className="ml-auto">
        Request pending
      </Pill>
    ) : null;

  if (!user) {
    return <OfficesPageSkeleton variant={showingMyOffices ? "mine" : gridMode ? "list" : "hub"} />;
  }

  const newToYou = (newestOffices || []).filter((o) => !memberIds.has(o._id)).slice(0, 4);
  const busy = loadingOrgId !== null;
  const featuredOffices = trending?.offices.slice(0, 2) ?? [];
  const trendingOffices = trending?.offices.slice(2, 6) ?? [];

  // Your offices, then ones awaiting approval (no `membership` yet).
  // Garage's own office is everyone's default home, so it sits in its own
  // row above the switcher instead of mixed in with the offices they joined.
  const garageOffice = activeOffices.find((org) => org.name?.trim().toLowerCase() === GARAGE_OFFICE_NAME);

  const ownOffices: { id: string; name: string; icon?: string; membership?: Organization }[] = [
    ...activeOffices.map((org) => ({ id: org.id, name: org.name, icon: org.icon, membership: org })),
    ...pendingOffices.map((o) => ({ id: o._id, name: o.name, icon: o.icon })),
  ];

  const newOfficesSection = (title: string) =>
    (newestOffices === null || newToYou.length > 0) && (
      <section className="flex flex-col gap-[22px]">
        <SectionHeading eyebrow="Fresh doors" title={title} action={{ label: "See all", onClick: () => showAll() }} />
        <OfficeGrid>
          {newestOffices === null
            ? Array.from({ length: 4 }).map((_, i) => <OfficeCardSkeleton key={i} />)
            : newToYou.map((office) => (
                <OfficeCard
                  key={office._id}
                  office={office}
                  onOpen={() => openOffice(office)}
                  footer={discoverFooter(office)}
                />
              ))}
        </OfficeGrid>
      </section>
    );

  // "Find your next office" fills whatever is left of the last row.
  const findTileSpan = ["lg:col-span-3", "lg:col-span-2", "lg:col-span-1"][ownOffices.length % 3];

  return (
    <div className="relative min-h-screen bg-[#090908] font-[family-name:var(--font-chat)] text-[#f5f1e7] antialiased">
      <Atmosphere />
      <OfficesTopBar
        user={user}
        categories={categories}
        searchQuery={q}
        onOpenOffice={openOffice}
        onSearch={(query) => navigate({ q: query })}
        onSelectCategory={(c) => showCategory(c)}
        onHome={() => navigate({})}
        onCreateOffice={handleCreateWorkspace}
        onMyOffices={() => navigate({ view: "mine" })}
        myOfficesActive={showingMyOffices}
        myOfficeCount={ownOffices.length}
        onGoBack={handleGoBack}
        onLogout={handleLogout}
      />

      <main className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-10 sm:px-8 sm:pt-12 lg:px-16 lg:pt-[54px]">
        {/* Keyed by screen so moving between the hub and a list fades in;
            filter and page changes inside a list keep it mounted. */}
        <div
          key={showingMyOffices ? "mine" : gridMode ? "list" : isNewMember ? "welcome" : "hub"}
          className="flex flex-col gap-[72px] animate-in fade-in-0 duration-300"
        >
          {showingMyOffices ? (
            <MyOfficesView
              offices={ownOffices.map((o) => ({
                id: o.id,
                name: o.name,
                icon: o.icon,
                pending: !o.membership,
                subtitle: o.membership
                  ? [roleLabel(o.membership), joinedLabel(o.membership.joinedAt)].filter(Boolean).join(" · ")
                  : "Pending approval",
              }))}
              currentOrgId={currentOrgId}
              loadingOrgId={loadingOrgId}
              onSelect={(id) => selectOrganization(id)}
              onFindMore={() => showAll()}
              onBack={() => navigate({})}
            />
          ) : gridMode ? (
            <OfficeGridView
              mode={gridMode}
              categories={categories}
              categoriesLoading={categoriesLoading}
              renderFooter={discoverFooter}
              isMember={(id) => memberIds.has(id)}
              onOpenOffice={openOffice}
              onSelectCategory={(c) => showCategory(c, { scroll: false })}
              onPage={(page) => navigate({ view: "all", page: page > 1 ? String(page) : null }, { scroll: false })}
              onClearSearch={() => navigate({})}
              onCreateOffice={handleCreateWorkspace}
              onBack={() => navigate({})}
            />
          ) : isNewMember ? (
            <>
              <section className="flex flex-col gap-3">
                <h1 className="text-[36px] font-semibold leading-tight text-[#f5f1e7] sm:text-[44px]">
                  Welcome to your offices
                </h1>
                <p className="max-w-[600px] text-[15px] leading-[1.5] text-[#aaa69c]">
                  This is your home base for the communities you join. Start with a few, then make the space your own.
                </p>
              </section>

              <GettingStartedCard joined={activeOffices.length} goal={OFFICE_GOAL} onDiscover={() => showAll()} />

              <section className="flex flex-col gap-[22px]">
                <SectionHeading eyebrow={`${activeOffices.length} joined`} title="Your offices" />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {ownOffices.map(({ id, name, icon, membership }) => {
                    const details = ownDetails[id];
                    const office: OfficeCardData = {
                      _id: id,
                      name,
                      icon: icon || details?.icon,
                      slug: details?.slug,
                      coverPhoto: details?.coverPhoto,
                      description: details?.description,
                      category: details?.category,
                    };
                    return (
                      <OfficeCard
                        key={id}
                        highlighted={!!membership}
                        office={office}
                        onOpen={() => (membership ? selectOrganization(id) : setJoinTarget(office))}
                        footer={
                          !membership ? (
                            <Pill tone="neutral" className="ml-auto">
                              Request pending
                            </Pill>
                          ) : (
                            <>
                              <span className="text-[11px] text-[#747169]">{roleLabel(membership)}</span>
                              {loadingOrgId === id ? (
                                <Loader2 className="size-4 animate-spin text-[#ffc200]" />
                              ) : (
                                <Pill tone="success">Joined</Pill>
                              )}
                            </>
                          )
                        }
                      />
                    );
                  })}
                  <div className={findTileSpan}>
                    <FindOfficeCard onExplore={() => showAll()} />
                  </div>
                </div>
              </section>

              {newOfficesSection("A good place to start")}
            </>
          ) : (
            <>
              <HubHero officeTotal={officeTotal} loading={newestOffices === null} />

              {garageOffice && (
                // Tucked closer to "Your offices" (32px instead of the page's
                // 72px) — the two read as one switcher.
                <section className="-mb-10 flex flex-col gap-[22px]">
                  <SectionHeading eyebrow="Home base" title="Garage" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <OfficeSwitcherCard
                      name={garageOffice.name}
                      icon={garageOffice.icon}
                      subtitle={[roleLabel(garageOffice), joinedLabel(garageOffice.joinedAt)].filter(Boolean).join(" · ")}
                      current={garageOffice.id === currentOrgId}
                      loading={loadingOrgId === garageOffice.id}
                      disabled={busy}
                      onSelect={() => selectOrganization(garageOffice.id)}
                    />
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-[22px]">
                <SectionHeading eyebrow="One-click switcher" title="Your offices" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {ownOffices.filter((tile) => tile.id !== garageOffice?.id).map((tile) =>
                    tile.membership ? (
                      <OfficeSwitcherCard
                        key={tile.id}
                        name={tile.name}
                        icon={tile.icon}
                        subtitle={[roleLabel(tile.membership), joinedLabel(tile.membership.joinedAt)]
                          .filter(Boolean)
                          .join(" · ")}
                        current={tile.id === currentOrgId}
                        loading={loadingOrgId === tile.id}
                        disabled={busy}
                        onSelect={() => selectOrganization(tile.id)}
                      />
                    ) : (
                      <OfficeSwitcherCard
                        key={tile.id}
                        name={tile.name}
                        icon={tile.icon}
                        subtitle="Pending approval"
                        pending
                        onSelect={() => {}}
                      />
                    )
                  )}
                  <JoinAnotherOfficeTile onClick={() => showAll()} />
                </div>
              </section>

              {(trending === null || featuredOffices.length > 0) && (
                <section className="flex flex-col gap-[22px]">
                  <SectionHeading eyebrow="Worth your time" title="Featured on Garage" />
                  {trending === null ? (
                    <FeaturedOfficesSkeleton />
                  ) : (
                    <FeaturedOffices
                      offices={featuredOffices}
                      days={trending.days}
                      isMember={(id) => memberIds.has(id)}
                      onOpen={openOffice}
                    />
                  )}
                </section>
              )}

              <CategoryRail
                categories={categories}
                loading={categoriesLoading}
                selected={null}
                onSelect={showCategory}
              />

              {(trending === null || trendingOffices.length > 0) && (
                <section className="flex flex-col gap-[22px]">
                  <SectionHeading eyebrow="Momentum" title="Trending now" />
                  <OfficeGrid>
                    {trending === null
                      ? Array.from({ length: 4 }).map((_, i) => <OfficeCardSkeleton key={i} />)
                      : trendingOffices.map((office) => (
                          <OfficeCard
                            key={office._id}
                            office={office}
                            highlighted={memberIds.has(office._id)}
                            onOpen={() => openOffice(office)}
                            footer={
                              <>
                                <GrowthNote joins={office.recentJoins} days={trending.days} />
                                {memberIds.has(office._id) && <Pill tone="success">Joined</Pill>}
                              </>
                            }
                          />
                        ))}
                  </OfficeGrid>
                </section>
              )}

              {newOfficesSection("New on Garage")}

              {(categoriesLoading || categories.length > 0) && (
                <section className="flex flex-col gap-[22px]">
                  <SectionHeading eyebrow="Find your lane" title="Browse by category" />
                  {categoriesLoading ? (
                    <CategoryTilesSkeleton />
                  ) : (
                    <CategoryTiles categories={categories.slice(0, 6)} onSelect={(c) => showCategory(c)} />
                  )}
                </section>
              )}

              <OfficesFooter onCreateOffice={handleCreateWorkspace} />
            </>
          )}
        </div>
      </main>

      {joinTarget && (
        <JoinOfficeDialog
          office={joinTarget}
          userId={user.id}
          userName={user.name}
          pending={pendingIds.has(joinTarget._id)}
          onClose={() => setJoinTarget(null)}
          onJoined={(office) => selectOrganization(office._id, office)}
          onRequested={(office) => {
            setRequested((prev) => [...prev, office]);
            setJoinTarget(null);
          }}
        />
      )}

      {enteringOffice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[1200] flex flex-col items-center justify-center gap-5 bg-[#090908]/90 backdrop-blur-sm animate-in fade-in-0 duration-300"
        >
          <OfficeEmblem
            name={enteringOffice.name}
            icon={enteringOffice.icon}
            className="size-[72px] rounded-[20px] animate-in zoom-in-95 duration-300"
            textClassName="text-[28px]"
          />
          <p className="flex items-center gap-2.5 text-[15px] text-[#aaa69c]">
            <Loader2 className="size-4 animate-spin text-[#ffc200]" />
            Opening {enteringOffice.name}…
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrganizationSelectionPage() {
  return (
    <Suspense fallback={<OfficesPageSkeleton variant="hub" />}>
      <OrganizationSelectionPageContent />
    </Suspense>
  );
}
