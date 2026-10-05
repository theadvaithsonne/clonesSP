// Utility for managing lead notifications that appear in the bell icon dropdown

export interface LeadNotification {
    id: string;
    type: 'facebook_lead' | 'new_lead' | 'lead_update';
    leadId: string;
    leadName: string;
    estimatedValue?: number;
    source?: string;
    stage?: string;
    message: string;
    timestamp: string;
    read: boolean;
}

const STORAGE_KEY = 'lead_notifications';
const MAX_NOTIFICATIONS = 50;

// Get all notifications from localStorage
export function getLeadNotifications(): LeadNotification[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error reading lead notifications:', error);
        return [];
    }
}

// Add a new notification
export function addLeadNotification(notification: Omit<LeadNotification, 'id' | 'timestamp' | 'read'>): void {
    if (typeof window === 'undefined') return;
    try {
        const notifications = getLeadNotifications();
        const newNotification: LeadNotification = {
            ...notification,
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            read: false,
        };

        // Add to beginning and limit to MAX_NOTIFICATIONS
        const updated = [newNotification, ...notifications].slice(0, MAX_NOTIFICATIONS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Dispatch custom event to notify components
        window.dispatchEvent(new CustomEvent('leadNotificationAdded', {
            detail: newNotification
        }));
    } catch (error) {
        console.error('Error adding lead notification:', error);
    }
}

// Mark notifications as read
export function markNotificationsAsRead(notificationIds?: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        const notifications = getLeadNotifications();
        const updated = notifications.map(n => {
            if (!notificationIds || notificationIds.includes(n.id)) {
                return { ...n, read: true };
            }
            return n;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('leadNotificationsRead'));
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
}

// Get unread count
export function getUnreadNotificationCount(): number {
    return getLeadNotifications().filter(n => !n.read).length;
}

// Clear all notifications
export function clearAllNotifications(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('leadNotificationsCleared'));
    } catch (error) {
        console.error('Error clearing notifications:', error);
    }
}

// Remove a specific notification
export function removeNotification(notificationId: string): void {
    if (typeof window === 'undefined') return;
    try {
        const notifications = getLeadNotifications();
        const updated = notifications.filter(n => n.id !== notificationId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('leadNotificationRemoved'));
    } catch (error) {
        console.error('Error removing notification:', error);
    }
}
