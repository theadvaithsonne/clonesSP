"use client";

import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBoard } from "@/components/bat246/hooks/useBoard";
import { BoardLayout, PendingPlacement } from "@/components/bat246/BoardLayout";
import { BoardMobileSections } from "@/components/bat246/BoardMobileSections";
import { useIsMobileBoard } from "@/components/bat246/hooks/useIsMobileBoard";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { ppbGreens } from "@/components/bat246/MiniCard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
// Both spellings accepted — see boards/page.tsx's identical constant for why.
const BAT246_ORGS = ["TestCompany XYZ", "Bat246", "BAT 246"];
const ALAN_K_EMAIL = "redbaron2020@mail.com";

function tok() { return typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : ""; }

export default function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const router = useRouter();
  const { boardId } = use(params);
  const { board, loading, error } = useBoard(boardId);
  const { userData, loading: authLoading } = useAmIFounder();
  const [canInvite, setCanInvite] = useState(false);
  const [myPosition, setMyPosition] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");
  const [mySalesCredits, setMySalesCredits] = useState<number | null>(null);
  const [pendingPlacements, setPendingPlacements] = useState<PendingPlacement[]>([]);
  // Phones / tablet-portrait get BoardMobileSections — the board as four
  // swipeable screens (see the early return below the loading/error states).
  // Everything from here down to that return is shared; everything after it
  // is the desktop view, untouched. The measurement effects below all no-op
  // on mobile — their refs/ids only exist in the desktop markup.
  const isMobile = useIsMobileBoard();

  const isAdmin = !authLoading && userData.email?.toLowerCase() === ALAN_K_EMAIL;

  // Fetch canInvite role + myUserId
  useEffect(() => {
    if (!boardId) return;
    const token = tok();
    fetch(`${API}/bat246/boards/${boardId}/my-role`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setCanInvite(d.canInvite ?? false);
        setMyPosition(d.position ?? null);
        // Extract userId from JWT payload (simple base64 decode)
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setMyUserId(payload.userId ?? "");
        } catch {}
      })
      .catch(() => {});
  }, [boardId]);

  // Fetch own Green Card count (gates "Preserve Position" in invite modal for 1st Base users)
  useEffect(() => {
    const token = tok();
    fetch(`${API}/bat246/my-dashboard-access`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMySalesCredits(d.salesCredits ?? null))
      .catch(() => {});
  }, []);

  // Fetch pending placements for tooltip display
  useEffect(() => {
    if (!boardId || (!isAdmin && !canInvite)) return;
    const token = tok();
    fetch(`${API}/bat246/boards/${boardId}/pending-placements`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPendingPlacements(d.placements ?? []))
      .catch(() => {});
  }, [boardId, isAdmin, canInvite]);

  useEffect(() => {
    if (authLoading) return;
    if (userData.orgName && !BAT246_ORGS.includes(userData.orgName)) {
      router.replace("/workspace");
    }
  }, [userData.orgName, authLoading, router]);

  // Border-frame alignment — the frame's notch must trace the POD artwork's
  // rendered edges, but the pod is sized from the header's height while the
  // frame works in page coordinates, so hardcoded percentages drift apart at
  // different window sizes (the band used to land ~50px below the pod and cut
  // through the Hot Box). Measure the pod's real box instead, re-measuring on
  // any resize. `null` (pod not rendered) falls back to the old approximations.
  const frameHostRef = useRef<HTMLDivElement | null>(null);
  const [podEdges, setPodEdges] = useState<{ left: number; bottom: number } | null>(null);

  // Dugout panel now sits close enough to the left edge that the page
  // frame's own left bar (drawn below) can cover part of it — measure the
  // panel's real top/bottom (like podEdges above) so the frame's left bar
  // can leave a gap over exactly that range instead of painting through it.
  // `null` (panel not rendered, e.g. read-only boards) falls back to an
  // unbroken left bar.
  const [dugoutEdges, setDugoutEdges] = useState<{ top: number; bottom: number } | null>(null);

  // WARP bar centering — the bar's midpoint should sit exactly between the
  // blue Bat246 button and the right child-board nav button (when present),
  // so it's measured from the DOM (like podEdges above) instead of a
  // hand-picked percentage, which would drift whenever either button moves.
  //
  // The bar's own width is viewport-relative, so on narrower screens it grew
  // past that midpoint and slid over the Bat246 button. `maxWidth` measures the
  // room actually left between the two buttons and caps the bar to it; on wide
  // screens there is more room than the bar wants and nothing changes.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bat246BtnRef = useRef<HTMLAnchorElement | null>(null);
  const [warpBar, setWarpBar] = useState<{ centerPx: number | null; maxWidth: number | null }>({ centerPx: null, maxWidth: null });
  useEffect(() => {
    const header = headerRef.current;
    const btn = bat246BtnRef.current;
    if (!header || !btn) return;
    const GAP = 12;      // breathing room either side of the bar
    const MIN_W = 320;   // below this the chevrons stop being readable anyway
    const apply = (next: { centerPx: number | null; maxWidth: number | null }) =>
      setWarpBar((prev) =>
        prev.centerPx === next.centerPx && prev.maxWidth === next.maxWidth ? prev : next
      );
    const measure = () => {
      const h = header.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const clear = b.right - h.left + GAP; // first x the bar may occupy
      const rightBtn = document.getElementById("bat246-nav-right-btn");
      if (!rightBtn) {
        // Fallback placement: left 48%, pulled back 58.6% of its own width.
        const center = h.width * 0.48;
        apply({ centerPx: null, maxWidth: Math.round(Math.max(MIN_W, (center - clear) / 0.586)) });
        return;
      }
      const r = rightBtn.getBoundingClientRect();
      const center = (b.left + b.width / 2 + r.left + r.width / 2) / 2 - h.left;
      // Centred on `center`, so its room is twice the tighter of the two sides.
      const room = 2 * Math.min(center - clear, r.left - h.left - GAP - center);
      apply({ centerPx: Math.round(center), maxWidth: Math.round(Math.max(MIN_W, room)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    ro.observe(btn);
    const navRightHost = document.getElementById("bat246-nav-right");
    if (navRightHost) ro.observe(navRightHost);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [board]);
  useEffect(() => {
    const host = frameHostRef.current;
    if (!host) return;
    const measure = () => {
      const pod = document.getElementById("bat246-pod-art");
      if (!pod) { setPodEdges(null); return; }
      const h = host.getBoundingClientRect();
      const p = pod.getBoundingClientRect();
      const left = p.left - h.left + host.scrollLeft;
      const bottom = p.bottom - h.top + host.scrollTop;
      setPodEdges((prev) =>
        prev && Math.abs(prev.left - left) < 0.5 && Math.abs(prev.bottom - bottom) < 0.5
          ? prev
          : { left, bottom }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const pod = document.getElementById("bat246-pod-art");
    if (pod) ro.observe(pod);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [board]);
  useEffect(() => {
    const host = frameHostRef.current;
    if (!host) return;
    const measure = () => {
      const dugout = document.getElementById("bat246-dugout-panel");
      if (!dugout) { setDugoutEdges(null); return; }
      const h = host.getBoundingClientRect();
      const d = dugout.getBoundingClientRect();
      const top = d.top - h.top + host.scrollTop;
      const bottom = d.bottom - h.top + host.scrollTop;
      setDugoutEdges((prev) =>
        prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.bottom - bottom) < 0.5
          ? prev
          : { top, bottom }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const dugout = document.getElementById("bat246-dugout-panel");
    if (dugout) ro.observe(dugout);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [board]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#09090f]">
        <div className="flex items-center gap-3 text-white/40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          Loading board…
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#09090f]">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-bold text-lg">Board not found</div>
          <div className="text-white/40 text-sm">{error ?? "No board data returned"}</div>
          <Link href="/games/bat246" className="inline-block mt-2 text-blue-400 hover:text-blue-300 text-sm">
            ← Back to boards
          </Link>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <BoardMobileSections
        board={board}
        isAdmin={isAdmin}
        canInvite={canInvite}
        myPosition={myPosition}
        myUserId={myUserId}
        mySalesCredits={mySalesCredits}
        pendingPlacements={pendingPlacements}
      />
    );
  }

  return (
    <div ref={frameHostRef} className="relative h-full w-full overflow-auto bg-[#09090f] flex flex-col">
      {/* Border overlay — a separate top layer instead of a box-shadow on this
          container itself, since the header/board content paints edge-to-edge
          and would otherwise cover an inset shadow drawn on the container.
          Traces the page perimeter but detours around the POD (top-right) —
          no border along the top/right edges behind the pod artwork, instead
          following the pod's own left + bottom edges (measured from the DOM by
          the podEdges effect above; percentage fallbacks if the pod is absent).
          Painted as two layers — every black bar first, then every white line
          on top — so wherever bars meet, the white lines always win and each
          corner renders as a picture-frame miter: a continuous white L nested
          inside a continuous black L, with no bar's black stub cutting across
          another bar's white. */}
      {(() => {
        const T = 8; // total border thickness
        const WHITE_T = 1.1; // white line's own thickness
        const margin = T - WHITE_T; // black remainder behind the white line
        // The dugout panel's own background/border now bleed above its measured
        // box (BoardLayout's "-8%" extension on child overlay layers, not on the
        // panel's own height) — getBoundingClientRect can't see that, so the
        // gap needs extra headroom above the measured top or this frame's left
        // bar shows through as a stub above the panel's siren row.
        const DUGOUT_GAP_TOP_BUFFER = 23;
        // POD_LEFT is the notch bar's own left edge — the bar sits just outside
        // the pod, its white slice flush against the artwork's left edge.
        const POD_LEFT = podEdges ? `${podEdges.left - T}px` : "80%";
        const POD_BOTTOM = podEdges ? `${podEdges.bottom}px` : "23%";
        const bar = (key: string, style: CSSProperties, color: string) => (
          <div key={key} className="absolute" style={{ ...style, background: color }} />
        );
        return (
          <div className="absolute inset-0 z-[9999] pointer-events-none">
            {/* ── black layer ── */}
            {/* top edge, reaching the pod's left edge (merges with the notch bar) */}
            {bar("b-top", { top: 0, left: 0, width: `calc(${POD_LEFT} + ${T}px)`, height: T }, "#000000")}
            {/* left edge — leaves a gap over the dugout panel's measured
                range (plus an 8px buffer for its own border glow) so the
                panel isn't painted over by this bar; falls back to an
                unbroken bar when the panel isn't rendered (read-only boards). */}
            {dugoutEdges ? (
              <>
                {bar("b-left-top", { top: 0, height: `${Math.max(0, dugoutEdges.top - DUGOUT_GAP_TOP_BUFFER)}px`, left: 0, width: T }, "#000000")}
                {bar("b-left-bottom", { top: `${dugoutEdges.bottom + T}px`, bottom: 0, left: 0, width: T }, "#000000")}
              </>
            ) : (
              bar("b-left", { top: 0, bottom: 0, left: 0, width: T }, "#000000")
            )}
            {/* bottom edge, full width */}
            {bar("b-bottom", { bottom: 0, left: 0, right: 0, height: T }, "#000000")}
            {/* right edge, only below the pod */}
            {bar("b-right", { top: POD_BOTTOM, bottom: 0, right: 0, width: T }, "#000000")}
            {/* notch down the pod's left edge, through the bottom notch bar */}
            {bar("b-notch-v", { top: 0, height: `calc(${POD_BOTTOM} + ${T}px)`, left: POD_LEFT, width: T }, "#000000")}
            {/* notch along the pod's bottom edge, to the page's right edge */}
            {bar("b-notch-h", { top: POD_BOTTOM, left: POD_LEFT, right: 0, height: T }, "#000000")}
            {/* ── white layer ── */}
            {/* top edge — runs to the pod's left edge, where the notch white turns down */}
            {bar("w-top", { top: 0, left: 0, width: `calc(${POD_LEFT} + ${T}px)`, height: WHITE_T }, "#ffffff")}
            {/* left edge — same dugout gap as the black bar above */}
            {dugoutEdges ? (
              <>
                {bar("w-left-top", { top: 0, height: `${Math.max(0, dugoutEdges.top - DUGOUT_GAP_TOP_BUFFER)}px`, left: 0, width: WHITE_T }, "#ffffff")}
                {bar("w-left-bottom", { top: `${dugoutEdges.bottom + T}px`, bottom: 0, left: 0, width: WHITE_T }, "#ffffff")}
              </>
            ) : (
              bar("w-left", { top: 0, bottom: 0, left: 0, width: WHITE_T }, "#ffffff")
            )}
            {/* bottom edge */}
            {bar("w-bottom", { bottom: 0, left: 0, right: 0, height: WHITE_T }, "#ffffff")}
            {/* right edge, below the pod */}
            {bar("w-right", { top: POD_BOTTOM, bottom: 0, right: 0, width: WHITE_T }, "#ffffff")}
            {/* notch white — outer (away-from-pod) slice, reversed per request so this
                notch alone shows black facing the pod and white facing away from it
                (opposite of the rest of the frame) */}
            {bar("w-notch-v", { top: 0, height: `calc(${POD_BOTTOM} + ${T}px)`, left: POD_LEFT, width: WHITE_T }, "#ffffff")}
            {/* notch white — outer (away-from-pod) slice along the bottom */}
            {bar("w-notch-h", { top: `calc(${POD_BOTTOM} + ${margin}px)`, left: POD_LEFT, right: 0, height: WHITE_T }, "#ffffff")}
          </div>
        );
      })()}
      <div ref={headerRef} className="relative flex-shrink-0 px-4 pt-4 pb-2 flex items-center">
        {/* Visual white background only — sized to end right after the right
            nav button (same formula used for that button's own position),
            kept as a separate layer so the header itself stays full width and
            the WARP bar / nav-right's existing 50%-based math (which is
            relative to the header's width) doesn't get thrown off. */}
        <div
          className="absolute inset-y-0 left-0 bg-white border-b border-white/10"
          style={{ width: "84%" }}
        />
        {/* Child-board nav arrows portal in here from BoardLayout, now the
            leftmost item, followed by the All Boards link and BAT246 logo.
            No margin on this placeholder itself — it collapses to zero width
            when there's no left child board, so spacing is unchanged for
            boards without a split (the portaled Link below carries its own
            spacing when it IS rendered). */}
        <div id="bat246-nav-left" className="relative flex items-center" />

        <Link href="/games/bat246/boards" className="relative flex items-center justify-center w-[64px] h-[22px] rounded-full bg-yellow-400 hover:bg-yellow-300 text-black text-[11px] font-bold border-2 border-black transition-colors whitespace-nowrap" style={{ transform: "scale(1.47)", transformOrigin: "left center", marginLeft: "0.5%", marginRight: "calc(1% + 32px)" }}>
          Boards
        </Link>

        {/* Bat246 dashboard button — routes to /games/bat246, which already
            contains the role-based redirect logic (admin stays on the admin
            board, everyone else gets sent to their own dashboard/boards view
            based on my-dashboard-access), so this button just needs to land
            there and let that page decide where the user actually belongs. */}
        <Link ref={bat246BtnRef} href="/games/bat246" title="BAT 246 Dashboard" className="relative flex items-center justify-center w-[64px] h-[22px] rounded-full bg-blue-500 hover:bg-blue-400 border-2 border-black transition-colors" style={{ transform: "scale(1.47)", transformOrigin: "left center", marginLeft: "-1%", marginRight: "calc(1% + 10px)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/bat246-text-logo.png" alt="BAT 246" className="h-4 w-auto object-contain" draggable={false} />
        </Link>

        {/* WARP progress — counts 1st Base slots that have earned both green PPB
            cards (the same condition BaseCard uses to show the WARP tab), so it
            always matches what's on the board even if warpCount wasn't backfilled
            for older boards. Horizontally centered exactly between the blue
            Bat246 button and the right child-board nav button (measured via
            warpCenterPx above); falls back to the old fixed percentage until
            that measurement is available or when there's no right nav button. */}
        <div
          className="absolute flex"
          style={
            warpBar.centerPx != null
              ? { left: `calc(${warpBar.centerPx}px - 0.5%)`, top: 8, bottom: 0, transform: "translateX(-50%)" }
              : { left: "47.5%", top: 8, bottom: 0, transform: "translateX(-58.6%)" }
          }
        >
          <div
            className="h-full flex rounded-[10px] overflow-hidden"
            style={{ width: `min(67.26vw, 1008.92px${warpBar.maxWidth != null ? `, ${warpBar.maxWidth}px` : ""})` }}
          >
            {([1, 2, 3, 4] as const).map((n, i) => {
              const warpedCount = board.firstBase.filter((slot) => ppbGreens(slot) >= 2).length;
              const active = n <= warpedCount;
              const isFirst = i === 0;
              const notch = "16px";
              const clipPath = isFirst
                ? `polygon(0 0, calc(100% - ${notch}) 0, 100% 50%, calc(100% - ${notch}) 100%, 0 100%)`
                : `polygon(0 0, calc(100% - ${notch}) 0, 100% 50%, calc(100% - ${notch}) 100%, 0 100%, ${notch} 50%)`;
              return (
                <div
                  key={n}
                  className="flex-1 h-full"
                  style={{ marginLeft: isFirst ? 0 : `-${notch}`, zIndex: i, position: "relative" }}
                >
                  {/* Stroke layer — a solid-color copy of the same chevron shape, 2px
                      larger all round than the fill layer, so a thin white border shows
                      through along every edge (including the diagonal tip/notch). */}
                  <div className="absolute inset-0" style={{ clipPath, background: "#ffffff" }} />
                  <div
                    className="absolute flex items-center justify-center font-extrabold tracking-wide transition-colors"
                    style={{
                      top: 2, bottom: 2, left: 2, right: 2,
                      clipPath,
                      fontSize: active ? "22.4px" : "18.52px",
                      ...(active
                        ? { background: "linear-gradient(90deg, #0a2c6b 0%, #0d3f86 35%, #0f5a6e 68%, #11744a 100%)", color: "#ffffff" }
                        : { background: "#000000", color: "rgba(255,255,255,0.55)" }),
                    }}
                  >
                    <span>WARP</span><span style={{ marginLeft: "4%" }}>{n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Positioned right at the end of the white row above (now extended out
            to the POD), instead of ml-auto pinning it to the far page edge —
            that left a huge gap on wide screens since the WARP bar doesn't
            reach the edge. */}
        <div id="bat246-nav-right" className="absolute flex items-center" style={{ left: "73.9%", top: 0, bottom: 0 }} />
      </div>

      <div className="flex-1 min-w-[860px] w-full">
        <BoardLayout
          board={board}
          isAdmin={isAdmin}
          canInvite={canInvite}
          myPosition={myPosition}
          myUserId={myUserId}
          mySalesCredits={mySalesCredits}
          pendingPlacements={pendingPlacements}
        />
      </div>
    </div>
  );
}
