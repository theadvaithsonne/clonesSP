import { useState, useEffect, useRef } from "react";

export interface BreadcrumbItem {
  label: string;
  key?: string;
}

export interface HistoryEntry {
  tab: string;
  breadcrumbs: BreadcrumbItem[];
}

export function useNavigationHistory(
  activeTab: string | null,
  setActiveTab: (tab: string | null) => void
) {
  const [stack, setStack] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number>(-1);
  const isNavigatingRef = useRef<boolean>(false);

  // Watch tab changes from parent to initialize or push tab transitions
  useEffect(() => {
    if (!activeTab || isNavigatingRef.current) return;

    setStack((prev) => {
      // If we are in the middle of history, truncate forward history
      const nextStack = cursor >= 0 ? prev.slice(0, cursor + 1) : prev;
      
      // Avoid duplicate consecutive entries for the same tab with empty breadcrumbs
      const lastEntry = nextStack[nextStack.length - 1];
      if (
        lastEntry &&
        lastEntry.tab === activeTab &&
        lastEntry.breadcrumbs.length === 0
      ) {
        return prev;
      }

      const newEntry: HistoryEntry = {
        tab: activeTab,
        breadcrumbs: [],
      };
      
      const newStack = [...nextStack, newEntry];
      if (newStack.length > 50) {
        const shifted = newStack.slice(1);
        setCursor(shifted.length - 1);
        return shifted;
      }
      setCursor(newStack.length - 1);
      return newStack;
    });
  }, [activeTab]);

  // Listen to deep breadcrumbs updates within pages
  useEffect(() => {
    const handleSetBreadcrumbs = (
      event: CustomEvent<{ items: BreadcrumbItem[] }>
    ) => {
      if (isNavigatingRef.current) return;

      const items = event.detail?.items || [];
      if (!activeTab) return;

      setStack((prev) => {
        const nextStack = cursor >= 0 ? prev.slice(0, cursor + 1) : prev;
        const lastEntry = nextStack[nextStack.length - 1];

        // Check if the update is identical to the last history entry
        const isSame =
          lastEntry &&
          lastEntry.tab === activeTab &&
          lastEntry.breadcrumbs.length === items.length &&
          lastEntry.breadcrumbs.every(
            (b, i) => b.label === items[i].label && b.key === items[i].key
          );

        if (isSame) return prev;

        const newEntry: HistoryEntry = {
          tab: activeTab,
          breadcrumbs: items,
        };

        const newStack = [...nextStack, newEntry];
        if (newStack.length > 50) {
          const shifted = newStack.slice(1);
          setCursor(shifted.length - 1);
          return shifted;
        }
        setCursor(newStack.length - 1);
        return newStack;
      });
    };

    window.addEventListener(
      "workspace:set-breadcrumbs",
      handleSetBreadcrumbs as EventListener
    );
    return () => {
      window.removeEventListener(
        "workspace:set-breadcrumbs",
        handleSetBreadcrumbs as EventListener
      );
    };
  }, [activeTab, cursor]);

  const goBack = () => {
    if (cursor <= 0) return;
    const nextCursor = cursor - 1;
    const target = stack[nextCursor];
    if (!target) return;

    isNavigatingRef.current = true;
    setCursor(nextCursor);

    // Restore tab
    setActiveTab(target.tab);

    // Wait for the component to render/mount and event listeners to bind
    setTimeout(() => {
      const lastItem = target.breadcrumbs[target.breadcrumbs.length - 1];
      const detail = lastItem
        ? {
            label: lastItem.label,
            key: lastItem.key,
            index: target.breadcrumbs.length - 1,
          }
        : { label: target.tab, key: "root", index: -1 };

      // Dispatch breadcrumb-click to active page component
      window.dispatchEvent(
        new CustomEvent("workspace:breadcrumb-click", { detail })
      );

      // Manually trigger layout breadcrumb sync
      window.dispatchEvent(
        new CustomEvent("workspace:set-breadcrumbs", {
          detail: { items: target.breadcrumbs },
        })
      );

      // Allow event handling to settle before clearing navigation lock
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    }, 100);
  };

  const goForward = () => {
    if (cursor >= stack.length - 1) return;
    const nextCursor = cursor + 1;
    const target = stack[nextCursor];
    if (!target) return;

    isNavigatingRef.current = true;
    setCursor(nextCursor);

    // Restore tab
    setActiveTab(target.tab);

    // Wait for target page to bind/mount
    setTimeout(() => {
      const lastItem = target.breadcrumbs[target.breadcrumbs.length - 1];
      const detail = lastItem
        ? {
            label: lastItem.label,
            key: lastItem.key,
            index: target.breadcrumbs.length - 1,
          }
        : { label: target.tab, key: "root", index: -1 };

      window.dispatchEvent(
        new CustomEvent("workspace:breadcrumb-click", { detail })
      );

      window.dispatchEvent(
        new CustomEvent("workspace:set-breadcrumbs", {
          detail: { items: target.breadcrumbs },
        })
      );

      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    }, 100);
  };

  return {
    canGoBack: cursor > 0,
    canGoForward: cursor < stack.length - 1,
    goBack,
    goForward,
  };
}
