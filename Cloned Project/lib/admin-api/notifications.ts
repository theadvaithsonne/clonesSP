import { garageAdminApi } from "@/lib/api";

/**
 * Admin notification rules — "when X happens, mail Y".
 *
 * The event catalogue is served by the backend rather than duplicated here.
 * The condition builder renders its inputs from `EventField.type`, so adding
 * an event server-side makes it appear in this UI with no frontend change.
 *
 * See garagenew-backend docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md
 */

export type EventFieldType = "user" | "string" | "number" | "enum" | "boolean";

export interface EventField {
  key: string;
  label: string;
  type: EventFieldType;
  values?: string[];
}

export interface AdminEventDescriptor {
  name: string;
  label: string;
  description: string;
  fields: EventField[];
}

export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { not: ConditionNode }
  | { field: string; op: string; value?: unknown };

export type RecipientSpec =
  | { type: "static"; emails: string[] }
  | { type: "relation"; relation: "sponsor" | "upline" | "officeOwner" | "subject" }
  | { type: "role"; role: string }
  | { type: "query"; filter: Record<string, unknown>; cap: number };

export interface AdminNotificationRule {
  _id: string;
  name: string;
  description?: string;
  enabled: boolean;
  event: string;
  conditions?: ConditionNode;
  recipients?: RecipientSpec[];
  templateName?: string;
  throttlePerHour: number;
  recipientCap: number;
  lastFiredAt?: string | null;
  createdAt: string;
}

export function listEvents() {
  return garageAdminApi<{
    success: boolean;
    events: AdminEventDescriptor[];
    operators: Record<EventFieldType, { op: string; label: string }[]>;
  }>("/garage-admin/notifications/events");
}

export function listRules() {
  return garageAdminApi<{ success: boolean; rules: AdminNotificationRule[] }>(
    "/garage-admin/notifications/rules",
  );
}

export function createRule(input: {
  name: string;
  description?: string;
  event: string;
  conditions?: ConditionNode;
  recipients?: RecipientSpec[];
}) {
  return garageAdminApi<{ success: boolean; rule: AdminNotificationRule }>(
    "/garage-admin/notifications/rules",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateRule(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    conditions: ConditionNode;
    recipients: RecipientSpec[];
  }>,
) {
  return garageAdminApi<{ success: boolean; rule: AdminNotificationRule }>(
    `/garage-admin/notifications/rules/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteRule(id: string) {
  return garageAdminApi<{ success: boolean }>(
    `/garage-admin/notifications/rules/${id}`,
    { method: "DELETE" },
  );
}

/**
 * Rules store user ids, not emails — an address can change, and a rule that
 * silently stopped matching would be worse than one that failed loudly. The
 * builder accepts an email and resolves it here on the way in.
 */
export function resolveUser(email: string) {
  return garageAdminApi<{
    success: boolean;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      profilePicture: string | null;
      downlineCount: number;
    };
  }>(`/garage-admin/notifications/resolve-user?email=${encodeURIComponent(email)}`);
}
