"use client";

import { Fragment, useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  AppWindow,
  ChevronRight,
  ExternalLink,
  Link2,
  PanelRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Stands in for the Office home — the Community view with no popover — in
 * `data-nav-popover` and NavNode.popover, so it can have a menu and a tab.
 */
export const OFFICE_PAGE = "@office";

/** A page, or a nested group of pages, listed under a sidebar section header. */
export interface NavNode {
  label: string;
  /** The activePopover the page opens (OFFICE_PAGE for the Office home). */
  popover?: string | null;
  /** A route page such as /coverfi, which has no popover. */
  href?: string;
  children?: NavNode[];
}

/**
 * `data-nav-group` value for a section header: its name and the pages under
 * it. The header's own children are unmounted while it's collapsed, so the
 * menu can't read them off the DOM — the header lists them.
 */
export const navGroup = (label: string, items: NavNode[]) => JSON.stringify({ label, items });

export interface NavPageState {
  /** Name of the tab "Close tab" would close. */
  label: string;
  /** The page already has a tab of its own (in either tab set). */
  open: boolean;
  /** A tab holding it — its own, else its section's — is in the bar showing now. */
  closable: boolean;
  /** "current": it's the page on screen. "unsupported": it can't run twice. */
  peek: "ok" | "current" | "unsupported";
}

interface SidebarContextMenuProps {
  getPageState: (popover: string) => NavPageState;
  /** URL that reopens the page in a fresh browser tab, or null if it has none. */
  getLink: (popover: string) => string | null;
  /** Navigate to a page, as clicking its row would. */
  onOpen: (page: Pick<NavNode, "popover" | "href">) => void;
  /** Open a tab for just this page, without switching to it. */
  onOpenInNewTab: (popover: string, label: string) => void;
  onOpenInSidePeek: (popover: string, label: string) => void;
  onCloseTab: (popover: string) => void;
}

type MenuTarget =
  | { kind: "page"; popover: string; label: string }
  | { kind: "group"; label: string; items: NavNode[] };

type OpenMenu = {
  /** New per right-click: remounting is what re-anchors the menu. */
  key: number;
  target: MenuTarget;
  x: number;
  y: number;
  row: HTMLElement;
  /** Where focus was before the menu took it, to hand it back on close. */
  returnFocus: Element | null;
};

// Same liquid glass as the bottom dock and its menus.
const GLASS: CSSProperties = {
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  background: "rgba(30, 30, 30, 0.65)",
  border: "1px solid rgba(255, 255, 255, 0.3)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 12px 40px rgba(0, 0, 0, 0.35)",
  // Own compositor layer, so the blur isn't re-rasterised mid-animation.
  willChange: "transform",
  backfaceVisibility: "hidden",
};

// Fades and scales out of the pointer; no slide, so the first item never
// passes under it (see sideOffset below).
const SURFACE_CLASS =
  "z-[9999] min-w-[220px] max-w-[300px] rounded-[18px] p-1.5 text-white outline-none origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

const ITEM_CLASS =
  "group flex w-full cursor-pointer select-none items-center gap-2.5 rounded-[12px] border border-transparent px-3 py-2 text-[13px] font-medium tracking-wide text-white/75 outline-none transition-colors data-[highlighted]:border-white/[0.15] data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white data-[highlighted]:shadow-[0_4px_12px_rgba(0,0,0,0.25)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45";

const ICON_CLASS = "size-4 shrink-0 text-white/50 transition-colors group-data-[highlighted]:text-white";

function MenuItem({
  icon: Icon,
  hint,
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { icon?: LucideIcon; hint?: string }) {
  return (
    <DropdownMenuPrimitive.Item className={cn(ITEM_CLASS, className)} {...props}>
      {Icon && <Icon className={ICON_CLASS} />}
      <span className="truncate">{children}</span>
      {hint && <span className="ml-auto shrink-0 pl-3 text-[11px] font-normal text-white/40">{hint}</span>}
    </DropdownMenuPrimitive.Item>
  );
}

function SubMenu({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger
        className={cn(ITEM_CLASS, "data-[state=open]:border-white/[0.15] data-[state=open]:bg-white/[0.08] data-[state=open]:text-white")}
      >
        {Icon && <Icon className={ICON_CLASS} />}
        <span className="truncate">{label}</span>
        <ChevronRight className="ml-auto size-3.5 shrink-0 text-white/40" />
      </DropdownMenuPrimitive.SubTrigger>
      {/* Portalled: the glass parent's backdrop-filter would otherwise become
          the submenu's containing block and throw off its position. */}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent sideOffset={6} alignOffset={-6} className={SURFACE_CLASS} style={GLASS}>
          {children}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="truncate px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

function MenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="mx-2 my-1 h-px bg-white/[0.08]" />;
}

/** Every page under a header that has a popover, tagged with its nested group. */
function pagesOf(items: NavNode[], group?: string): Array<{ node: NavNode & { popover: string }; group?: string }> {
  return items.flatMap((node) =>
    node.children
      ? pagesOf(node.children, node.label)
      : node.popover
        ? [{ node: node as NavNode & { popover: string }, group }]
        : []
  );
}

/**
 * Items for a list of pages: a label where a nested group starts, and a
 * divider where the list steps back out of one.
 */
function GroupedPages({
  pages,
  render,
}: {
  pages: ReturnType<typeof pagesOf>;
  render: (node: NavNode & { popover: string }) => React.ReactNode;
}) {
  return (
    <>
      {pages.map(({ node, group }, i) => {
        const previous = pages[i - 1];
        const groupChanged = i > 0 && group !== previous.group;
        return (
          <Fragment key={`${node.popover}-${i}`}>
            {groupChanged && !group && <MenuSeparator />}
            {group && (i === 0 || groupChanged) && <MenuLabel>{group}</MenuLabel>}
            {render(node)}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Notion-style right-click menu for the sidebar.
 *
 * Page rows opt in with `data-nav-popover="<activePopover key>"` — the page
 * their own click opens — and section headers with `data-nav-group` (see
 * navGroup). One document listener serves every sidebar (desktop, the mobile
 * overlay, BackOffice), so rows need nothing but the attribute, and anything
 * without one keeps the browser's own menu.
 *
 * It listens for `contextmenu` rather than reading mouse buttons, because
 * that is the one event every platform raises for a secondary click: a right
 * button (fired on release on Windows, on press on macOS/Linux), a two-finger
 * trackpad click, Ctrl+click on a Mac, a touch long-press on Android/Windows,
 * and the keyboard's Menu key or Shift+F10.
 */
export default function SidebarContextMenu({
  getPageState,
  getLink,
  onOpen,
  onOpenInNewTab,
  onOpenInSidePeek,
  onCloseTab,
}: SidebarContextMenuProps) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const menuCount = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Something inside the row already handled it.
      if (e.defaultPrevented || !(e.target instanceof Element)) return;
      // Right-clicking the menu itself shouldn't stack the browser's on top.
      if (e.target.closest('[data-sidebar-context-menu]')) {
        e.preventDefault();
        return;
      }
      const row = e.target.closest<HTMLElement>("[data-nav-popover], [data-nav-group]");
      if (!row) return;

      let target: MenuTarget | null = null;
      const popover = row.dataset.navPopover;
      if (popover) {
        const label = row.getAttribute("title") || row.textContent?.trim() || popover;
        target = { kind: "page", popover, label };
      } else if (row.dataset.navGroup) {
        try {
          const group = JSON.parse(row.dataset.navGroup) as { label: string; items: NavNode[] };
          if (group.items.length > 0) target = { kind: "group", label: group.label, items: group.items };
        } catch {
          // Malformed attribute: leave the browser's menu alone.
        }
      }
      if (!target) return;
      // Shift+right-click keeps the browser's menu (Inspect etc.). Firefox
      // shows its own there regardless, so ours would only stack on it.
      if (e.shiftKey && e.button === 2) return;
      e.preventDefault();

      // A pointer lands inside the row it clicked. Keyboard-opened menus
      // report 0,0 or wherever the browser picks, so open under the row.
      let { clientX: x, clientY: y } = e;
      const rect = row.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        x = rect.left + 12;
        y = rect.bottom;
      }
      menuCount.current += 1;
      setMenu({
        key: menuCount.current,
        target,
        x,
        y,
        row,
        returnFocus: document.activeElement,
      });
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const openRow = menu?.row;

  // Keep the row lit while its menu is up, as native context menus do.
  useEffect(() => {
    if (!openRow) return;
    openRow.setAttribute("data-context-menu-open", "");
    return () => openRow.removeAttribute("data-context-menu-open");
  }, [openRow]);

  // The menu is non-modal, so nothing stops the sidebar scrolling under it
  // (trackpad, wheel or touch): close once the row moves, or the window
  // resizes or loses focus.
  useEffect(() => {
    if (!openRow) return;
    const close = () => setMenu(null);
    const handleScroll = (e: Event) => {
      if (e.target instanceof Node && e.target.contains(openRow)) close();
    };
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [openRow]);

  if (!menu) return null;

  const { target } = menu;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const renderPageMenu = (popover: string, label: string) => {
    const page = getPageState(popover);
    const link = getLink(popover);
    return (
      <>
        <MenuItem
          icon={AppWindow}
          disabled={page.open}
          hint={page.open ? "Already open" : undefined}
          onSelect={() => onOpenInNewTab(popover, label)}
        >
          Open in new tab
        </MenuItem>
        {page.peek !== "unsupported" && (
          <MenuItem
            icon={PanelRight}
            disabled={page.peek === "current"}
            hint={page.peek === "current" ? "On screen" : undefined}
            onSelect={() => onOpenInSidePeek(popover, label)}
          >
            Open in side peek
          </MenuItem>
        )}
        {link && (
          <>
            <MenuItem icon={ExternalLink} onSelect={() => window.open(link, "_blank", "noopener,noreferrer")}>
              Open in new browser tab
            </MenuItem>
            <MenuItem icon={Link2} onSelect={() => copyLink(link)}>
              Copy link
            </MenuItem>
          </>
        )}
        {page.closable && (
          <>
            <MenuSeparator />
            <MenuItem icon={X} hint={page.label} onSelect={() => onCloseTab(popover)}>
              Close tab
            </MenuItem>
          </>
        )}
      </>
    );
  };

  // "Open <page>" for each page under a header; nested groups as submenus.
  const renderOpenItems = (items: NavNode[]): React.ReactNode =>
    items.map((node, i) =>
      node.children ? (
        <SubMenu key={`${node.label}-${i}`} label={node.label}>
          {renderOpenItems(node.children)}
        </SubMenu>
      ) : (
        <MenuItem key={`${node.label}-${i}`} onSelect={() => onOpen(node)}>
          Open {node.label}
        </MenuItem>
      )
    );

  const renderGroupMenu = (label: string, items: NavNode[]) => {
    const pages = pagesOf(items);
    const peekable = pages.filter(({ node }) => getPageState(node.popover).peek !== "unsupported");
    return (
      <>
        <MenuLabel>{label}</MenuLabel>
        {renderOpenItems(items)}
        {pages.length > 0 && (
          <>
            <MenuSeparator />
            <SubMenu label="Open in new tab" icon={AppWindow}>
              <GroupedPages
                pages={pages}
                render={(node) => {
                  const open = getPageState(node.popover).open;
                  return (
                    <MenuItem
                      disabled={open}
                      hint={open ? "Already open" : undefined}
                      onSelect={() => onOpenInNewTab(node.popover, node.label)}
                    >
                      {node.label}
                    </MenuItem>
                  );
                }}
              />
            </SubMenu>
          </>
        )}
        {peekable.length > 0 && (
          <SubMenu label="Open in side peek" icon={PanelRight}>
            <GroupedPages
              pages={peekable}
              render={(node) => {
                const current = getPageState(node.popover).peek === "current";
                return (
                  <MenuItem
                    disabled={current}
                    hint={current ? "On screen" : undefined}
                    onSelect={() => onOpenInSidePeek(node.popover, node.label)}
                  >
                    {node.label}
                  </MenuItem>
                );
              }}
            />
          </SubMenu>
        )}
      </>
    );
  };

  return (
    <DropdownMenuPrimitive.Root
      key={menu.key}
      open
      onOpenChange={(open) => {
        if (!open) setMenu(null);
      }}
      // Non-modal: a right-click on another row while this is open closes it
      // and opens that row's menu, instead of being swallowed by an overlay.
      modal={false}
    >
      {/* Zero-size anchor at the pointer; the menu opens from here. */}
      <DropdownMenuPrimitive.Trigger asChild>
        <span
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={contentRef}
          data-sidebar-context-menu=""
          side="bottom"
          align="start"
          // Keeps the first item off the pointer: where the menu opens on
          // button press (macOS, Linux), releasing over an item selects it.
          sideOffset={2}
          collisionPadding={8}
          onCloseAutoFocus={(e) => {
            // Not the invisible anchor. Back to wherever focus was — unless
            // what the item opened (the side peek) has taken it since.
            e.preventDefault();
            const { returnFocus } = menu;
            const active = document.activeElement;
            if (active && active !== document.body) return;
            if (returnFocus instanceof HTMLElement && returnFocus.isConnected && returnFocus !== document.body) {
              returnFocus.focus({ preventScroll: true });
            }
          }}
          className={SURFACE_CLASS}
          style={GLASS}
        >
          {target.kind === "page"
            ? renderPageMenu(target.popover, target.label)
            : renderGroupMenu(target.label, target.items)}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
