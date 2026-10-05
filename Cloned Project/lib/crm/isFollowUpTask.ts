type TaskLike = {
  type?: unknown;
  taskType?: unknown;
  category?: unknown;
  activityType?: unknown;
  isFollowUp?: unknown;
  title?: unknown;
  description?: unknown;
  name?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasFollowUpType(value: unknown): boolean {
  const normalized = normalizeText(value);
  return (
    normalized === "follow-up" ||
    normalized === "followup" ||
    normalized === "follow_up" ||
    normalized === "follow up"
  );
}

function containsFollowUpPhrase(text: string): boolean {
  if (!text) return false;
  return /\bfollow[\s-]?up\b/.test(text) || /\bfollowup\b/.test(text);
}

/**
 * Classify CRM tasks as follow-ups vs regular tasks.
 * Uses API flags first, then title/description heuristics used across Deals flows.
 */
export function isFollowUpTask(task: TaskLike | null | undefined): boolean {
  if (!task) return false;

  if (task.isFollowUp === true || task.isFollowUp === "true") return true;

  const typeFields = [task.type, task.taskType, task.category, task.activityType];
  if (typeFields.some(hasFollowUpType)) return true;

  const title = normalizeText(task.title ?? task.name);
  const description = normalizeText(task.description);

  if (!title && !description) return false;

  if (
    title === "follow-up with lead" ||
    title === "followup with lead" ||
    title === "follow up with lead"
  ) {
    return true;
  }

  if (description === "follow-up scheduled" || description === "followup scheduled") {
    return true;
  }

  if (description.includes("further follow-up needed")) return true;

  if (/^auto\s+follow[\s-]?up\b/.test(title)) return true;
  if (/\bfollow[\s-]?up\s+created\b/.test(title)) return true;
  if (/\bfollowup\s+created\b/.test(title)) return true;

  if (title.includes("contacted on whatsapp")) return false;

  if (containsFollowUpPhrase(title)) return true;

  if (
    containsFollowUpPhrase(description) &&
    (description === "follow-up scheduled" ||
      description.startsWith("follow-up scheduled") ||
      description.includes("auto follow"))
  ) {
    return true;
  }

  return false;
}

export const FOLLOW_UP_TASK_DEFAULTS = {
  type: "follow-up",
  isFollowUp: true,
} as const;
