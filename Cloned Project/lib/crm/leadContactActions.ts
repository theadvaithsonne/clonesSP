import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { FOLLOW_UP_TASK_DEFAULTS } from "@/lib/crm/isFollowUpTask";
import {
  DEALS_CRM_STATS_REFRESH_EVENT,
  dispatchDealsActivityFollowUpAppend,
} from "@/lib/deals-events";
import { resolveLeadEmail, resolveLeadPhone } from "@/lib/crm/resolveLeadContactInfo";
import { authenticatedFetch } from "@/utils/api";

type JwtPayload = {
  userId?: string;
  id?: string;
  orgId?: string;
};

type CrmTaskRecord = {
  _id?: string;
  id?: string;
  leadId?: string | { _id?: string; id?: string };
  lead?: string | { _id?: string; id?: string };
  dueDate?: string;
  scheduledDate?: string;
  status?: string;
  isCompleted?: boolean;
};

function trimId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

/** Resolve CRM lead id from a lead row, activity, or leadDetails object. */
export function resolveLeadId(
  lead: Record<string, unknown> | null | undefined,
  overrideLeadId?: string
): string {
  const override = trimId(overrideLeadId);
  if (override) return override;
  if (!lead) return "";

  const direct = trimId(lead._id) || trimId(lead.id);
  if (direct) return direct;

  const leadIdField = lead.leadId;
  if (typeof leadIdField === "string") return trimId(leadIdField);
  if (leadIdField && typeof leadIdField === "object") {
    const nested = leadIdField as Record<string, unknown>;
    return trimId(nested._id) || trimId(nested.id);
  }

  return "";
}

function resolveTaskLeadId(task: CrmTaskRecord): string {
  const leadIdField = task.leadId;
  if (typeof leadIdField === "string") return trimId(leadIdField);
  if (leadIdField && typeof leadIdField === "object") {
    return trimId(leadIdField._id) || trimId(leadIdField.id);
  }
  const leadField = task.lead;
  if (typeof leadField === "string") return trimId(leadField);
  if (leadField && typeof leadField === "object") {
    return trimId(leadField._id) || trimId(leadField.id);
  }
  return "";
}

function resolveTaskId(task: CrmTaskRecord): string {
  return trimId(task._id) || trimId(task.id);
}

function isOpenTask(task: CrmTaskRecord): boolean {
  if (task.isCompleted === true) return false;
  const status = (task.status || "").toLowerCase();
  return status !== "completed" && status !== "done";
}

function isDueToday(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function endOfDayIso(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T23:59:59`).toISOString();
}

/** Prefer lead owner/assignee so dashboard assignedTo filter includes the task. */
function resolveLeadAssigneeId(
  lead: Record<string, unknown> | null | undefined,
  fallbackUserId: string
): string {
  if (!lead) return fallbackUserId;

  const assignedTo = lead.assignedTo;
  if (typeof assignedTo === "string" && assignedTo.trim()) return trimId(assignedTo);
  if (assignedTo && typeof assignedTo === "object") {
    const o = assignedTo as Record<string, unknown>;
    const id = trimId(o._id) || trimId(o.id) || trimId(o.userId);
    if (id) return id;
  }

  const assignedUsers = lead.assignedUsers;
  if (Array.isArray(assignedUsers) && assignedUsers.length > 0) {
    const first = assignedUsers[0] as Record<string, unknown>;
    const id = trimId(first._id) || trimId(first.id) || trimId(first.userId);
    if (id) return id;
  }

  const owner = lead.ownerId ?? lead.owner;
  if (typeof owner === "string" && owner.trim()) return trimId(owner);
  if (owner && typeof owner === "object") {
    const o = owner as Record<string, unknown>;
    const id = trimId(o._id) || trimId(o.id) || trimId(o.userId);
    if (id) return id;
  }

  return fallbackUserId;
}

function resolveLeadDisplayName(lead: Record<string, unknown> | null | undefined): string {
  if (!lead) return "";
  const name = lead.name ?? lead.leadName;
  if (typeof name === "string" && name.trim()) return name.trim();
  const company = lead.companyName ?? lead.company;
  if (typeof company === "string" && company.trim()) return company.trim();
  if (company && typeof company === "object") {
    const o = company as Record<string, unknown>;
    const companyName = o.name;
    if (typeof companyName === "string" && companyName.trim()) return companyName.trim();
  }
  return "";
}

function buildDashboardFollowUpActivity(
  lead: Record<string, unknown> | null | undefined,
  leadId: string,
  task: {
    _id?: string;
    dueDate: string;
    description: string;
    assignedTo: string;
    createdAt?: string;
    lastContactedAt?: string;
  }
): Record<string, unknown> {
  const leadName = resolveLeadDisplayName(lead);
  const contactedAt = task.lastContactedAt || task.createdAt || new Date().toISOString();
  return {
    _id: task._id,
    leadId,
    title: leadName || "Follow-up with Lead",
    description: task.description,
    dueDate: task.dueDate,
    scheduledDate: task.dueDate,
    status: "open",
    isCompleted: false,
    priority: "medium",
    assignedTo: task.assignedTo,
    createdAt: contactedAt,
    updatedAt: contactedAt,
    lastContactedAt: contactedAt,
    leadDetails: {
      _id: leadId,
      leadName: leadName || undefined,
      name: leadName || undefined,
      lastActivity: contactedAt,
    },
  };
}

async function getAuthContext(): Promise<{ userId: string; organizationId: string }> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("garage_tok") : null;
  let userId = "";
  let organizationId = "";
  if (token) {
    try {
      const parsed = jwtDecode<JwtPayload>(token);
      userId = parsed.userId || parsed.id || "";
      organizationId = parsed.orgId || "";
    } catch {
      /* ignore */
    }
  }
  return { userId, organizationId };
}

async function fetchLeadTasks(leadId: string): Promise<CrmTaskRecord[]> {
  try {
    const response = await authenticatedFetch(buildExternalUrl(`/crm/leads/${leadId}`), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const leadData = data.lead || data.data || data;
    const tasks = leadData?.tasks;
    return Array.isArray(tasks) ? tasks : [];
  } catch {
    return [];
  }
}

async function fetchActivitiesFollowUps(): Promise<CrmTaskRecord[]> {
  try {
    const response = await authenticatedFetch(
      buildExternalUrl("crm/activities-followups"),
      { method: "GET" }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const list = data?.data ?? data?.activities ?? data?.followups ?? data;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function markTaskCompleted(taskId: string): Promise<boolean> {
  if (!taskId) return false;
  try {
    const response = await authenticatedFetch(buildExternalUrl(`/crm/tasks/${taskId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", isCompleted: true }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function completeTodaysOpenFollowUpsForLead(leadId: string): Promise<void> {
  const [leadTasks, activities] = await Promise.all([
    fetchLeadTasks(leadId),
    fetchActivitiesFollowUps(),
  ]);

  const seen = new Set<string>();
  const toComplete: string[] = [];

  const consider = (task: CrmTaskRecord) => {
    const taskId = resolveTaskId(task);
    if (!taskId || seen.has(taskId)) return;
    if (resolveTaskLeadId(task) !== leadId) return;
    if (!isOpenTask(task)) return;
    const due = task.dueDate || task.scheduledDate;
    if (!isDueToday(due)) return;
    seen.add(taskId);
    toComplete.push(taskId);
  };

  leadTasks.forEach(consider);
  activities.forEach(consider);

  if (toComplete.length === 0) return;

  await Promise.allSettled(toComplete.map((id) => markTaskCompleted(id)));
}

async function createCrmTask(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; taskId?: string }> {
  try {
    const response = await authenticatedFetch(buildExternalUrl("/crm/tasks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { ok: false };
    try {
      const data = await response.json();
      const task = data?.data ?? data?.task ?? data;
      const taskId =
        trimId(task?._id) ||
        trimId(task?.id) ||
        trimId(data?._id) ||
        trimId(data?.id);
      return { ok: true, taskId: taskId || undefined };
    } catch {
      return { ok: true };
    }
  } catch {
    return { ok: false };
  }
}

export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function openLeadEmail(lead: Record<string, unknown> | null | undefined): void {
  const email = resolveLeadEmail(lead);
  if (!email) {
    toast.error("No email available");
    return;
  }
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
  window.open(gmailUrl, "_blank");
}

/**
 * On WhatsApp click: complete today's open follow-ups for the lead, log contact as
 * completed, and schedule a follow-up for the next day for the user to refine.
 */
export async function createWhatsAppContactTask(
  lead: Record<string, unknown> | null | undefined,
  options?: {
    leadId?: string;
    onSuccess?: () => void | Promise<void>;
    showToast?: boolean;
  }
): Promise<boolean> {
  const leadId = resolveLeadId(lead, options?.leadId);
  if (!leadId) {
    console.warn("WhatsApp task skipped: no lead id");
    return false;
  }

  try {
    const { userId, organizationId } = await getAuthContext();
    const assigneeId = resolveLeadAssigneeId(lead, userId);

    await completeTodaysOpenFollowUpsForLead(leadId);

    const now = new Date();
    const formattedDate = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const contactCreated = await createCrmTask({
      leadId,
      title: "Contacted on WhatsApp",
      description: `User contacted this lead via WhatsApp on ${formattedDate}.`,
      dueDate: now.toISOString(),
      priority: "medium",
      status: "completed",
      isCompleted: true,
      assignedTo: assigneeId,
      organizationId,
      createdBy: userId,
    });

    if (contactCreated.ok) {
      let whatsappTaskId = contactCreated.taskId;
      if (!whatsappTaskId) {
        const leadTasks = await fetchLeadTasks(leadId);
        const openWhatsAppTask = leadTasks
          .filter(
            (t) =>
              isOpenTask(t) &&
              String(t.title || "")
                .toLowerCase()
                .includes("contacted on whatsapp")
          )
          .sort((a, b) => {
            const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return createdB - createdA;
          })[0];
        whatsappTaskId = openWhatsAppTask ? resolveTaskId(openWhatsAppTask) : undefined;
      }
      if (whatsappTaskId) {
        await markTaskCompleted(whatsappTaskId);
      }
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const futureDueDate = endOfDayIso(futureDate);
    const futureDateLabel = futureDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const futureFollowUpDescription =
      "WhatsApp contact completed. Further follow-up needed — edit date and details as needed.";

    const futureCreated = await createCrmTask({
      leadId,
      title: "Follow-up with Lead",
      description: futureFollowUpDescription,
      dueDate: futureDueDate,
      priority: "medium",
      status: "open",
      assignedTo: assigneeId,
      organizationId,
      createdBy: userId,
      ...FOLLOW_UP_TASK_DEFAULTS,
    });

    if (futureCreated.ok) {
      const contactedAt = now.toISOString();
      dispatchDealsActivityFollowUpAppend(
        buildDashboardFollowUpActivity(lead, leadId, {
          _id: futureCreated.taskId,
          dueDate: futureDueDate,
          description: futureFollowUpDescription,
          assignedTo: assigneeId,
          createdAt: contactedAt,
          lastContactedAt: contactedAt,
        })
      );
    }

    const futureScheduled = futureCreated.ok;

    if (!contactCreated.ok) {
      console.warn("WhatsApp contact task creation failed");
      return false;
    }

    if (options?.showToast !== false) {
      const reminderNote = futureScheduled
        ? ` Next reminder set for ${futureDateLabel}.`
        : "";
      toast.success(`WhatsApp contact logged.${reminderNote}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DEALS_CRM_STATS_REFRESH_EVENT));
    }

    if (options?.onSuccess) {
      await options.onSuccess();
    }

    return true;
  } catch (err) {
    console.error("Error creating WhatsApp contact task:", err);
    return false;
  }
}

export function openLeadWhatsApp(
  lead: Record<string, unknown> | null | undefined,
  options?: { leadId?: string; onSuccess?: () => void | Promise<void> }
): void {
  const phone = resolveLeadPhone(lead);
  if (!phone) {
    toast.error("No phone number available");
    return;
  }
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) {
    toast.error("Invalid phone number");
    return;
  }
  window.open(`https://wa.me/${formattedPhone}`, "_blank");
  void createWhatsAppContactTask(lead, {
    leadId: options?.leadId,
    onSuccess: options?.onSuccess,
  });
}
