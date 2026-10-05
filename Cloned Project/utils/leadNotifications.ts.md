# `utils/leadNotifications.ts`

> Utility for managing lead notifications that appear in the bell icon dropdown

**Kind:** frontend utility · **Lines:** 104

<!-- docgen:auto -->

## Purpose
Utility for managing lead notifications that appear in the bell icon dropdown

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LeadNotification` | interface |  | 3 |
| `getLeadNotifications` | function | `getLeadNotifications(): LeadNotification[]` | 20 |
| `addLeadNotification` | function | `addLeadNotification(notification: Omit<LeadNotification, 'id' \| 'timestamp' \| '…): void` | 32 |
| `markNotificationsAsRead` | function | `markNotificationsAsRead(notificationIds?: string[]): void` | 57 |
| `getUnreadNotificationCount` | function | `getUnreadNotificationCount(): number` | 77 |
| `clearAllNotifications` | function | `clearAllNotifications(): void` | 82 |
| `removeNotification` | function | `removeNotification(notificationId: string): void` | 93 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/deals/facebook/facebookintegration.jsx`
- `components/crm/DealsNavbar.tsx`
- `components/dashboard/NotificationPage.tsx`
