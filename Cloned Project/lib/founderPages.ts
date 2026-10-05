/**
 * Pages that belong to the sidebar's Founders menu: the founder console,
 * Networks Manager and Office Settings. MainSidebar switches to that menu on
 * them and the dashboard layout gives them their own set of top-bar tabs —
 * both read this one check so the two can't disagree.
 */
export function isFounderPage(popover: string | null | undefined): boolean {
  if (!popover) return false;
  return (
    popover.startsWith("Founder:") ||
    popover === "Networks Manager" ||
    popover === "Office Settings" ||
    popover.startsWith("Office Settings:")
  );
}

/** Which set of top-bar tabs is showing: the founder console's, or everything else. */
export type TabSet = "main" | "founders";
