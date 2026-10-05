export type ActivitiesFollowUpsFilter = "today" | "next7days" | "pastDue";

export type ActivitiesFollowUpsQuery = {
  assignedTo?: string;
  filter?: ActivitiesFollowUpsFilter;
  search?: string;
  dueDate?: string;
};

export function buildActivitiesFollowUpsUrl(
  basePath = "crm/activities-followups",
  query: ActivitiesFollowUpsQuery = {}
): string {
  const params = new URLSearchParams();

  if (query.assignedTo && query.assignedTo !== "all") {
    params.set("assignedTo", query.assignedTo);
  }
  if (query.filter) {
    params.set("filter", query.filter);
  }
  const search = query.search?.trim();
  if (search) {
    params.set("search", search);
    if (/^\d{4}-\d{2}-\d{2}$/.test(search)) {
      params.set("dueDate", search);
    }
  }
  if (query.dueDate?.trim()) {
    params.set("dueDate", query.dueDate.trim());
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Client-side fallback when API search is unavailable or for optimistic rows. */
export function activityMatchesFollowUpSearch(
  activity: Record<string, unknown>,
  searchRaw: string
): boolean {
  const q = searchRaw.trim().toLowerCase();
  if (!q) return true;

  const ld = (activity.leadDetails as Record<string, unknown>) || {};
  const contacts = Array.isArray(ld.contacts) ? ld.contacts : [];
  const assigned = Array.isArray(activity.assignedToDetails)
    ? activity.assignedToDetails
    : [];

  const dueRaw = activity.dueDate || activity.scheduledDate || activity.createdAt;
  const due = dueRaw ? new Date(String(dueRaw)) : null;
  const dateLabels =
    due && !Number.isNaN(due.getTime())
      ? [
          due.toISOString().split("T")[0],
          due.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        ]
      : [];

  const ownerFromLead = ld.owner;
  const ownerName =
    ld.ownerName ||
    (typeof ownerFromLead === "string"
      ? ownerFromLead
      : (ownerFromLead as { name?: string })?.name) ||
    "";

  const haystack = [
    activity.title,
    activity.companyName,
    activity.entityName,
    activity.contactName,
    ld.leadName,
    ld.name,
    ld.companyName,
    ownerName,
    ld.ownerEmail,
    activity.description,
    (activity as { assignedToName?: string }).assignedToName,
    ...contacts.map((c: { firstName?: string; lastName?: string; name?: string }) =>
      `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || ""
    ),
    ...assigned.map(
      (u: { name?: string; firstName?: string; lastName?: string; email?: string }) =>
        u.name ||
        `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        u.email ||
        ""
    ),
    ...dateLabels,
  ]
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (!haystack) return false;
  if (haystack.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}
