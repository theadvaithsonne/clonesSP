// Calendar utility functions for Google Calendar-style UI

export type ViewMode = 'day' | 'week' | 'month';

export interface CalendarEvent {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  bookerId: { _id: string; name?: string; email: string };
  bookedWithId: { _id: string; name?: string; email: string };
  color?: string;
  category?: string;
  isRepeating?: boolean;
  // Deal activity fields
  isDealActivity?: boolean;
  activityType?: string;
  leadId?: string;
  entityName?: string;
  contactName?: string;
  description?: string;
  isCompleted?: boolean;
  // Event-specific fields
  isEvent?: boolean;
  invitedUserIds?: string[];
  guestInvitations?: Array<{ email: string; name?: string; status: string }>;
  status?: string;
  isLive?: boolean;
  publicJoinCode?: string;
}

// Color schemes for different event types
export const eventColors = {
  telehealth: {
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgb(234, 179, 8)',
    text: 'rgb(250, 204, 21)',
  },
  review: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: 'rgb(34, 197, 94)',
    text: 'rgb(74, 222, 128)',
  },
  medical: {
    bg: 'rgba(168, 85, 247, 0.15)',
    border: 'rgb(168, 85, 247)',
    text: 'rgb(192, 132, 252)',
  },
  virtual: {
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgb(234, 179, 8)',
    text: 'rgb(250, 204, 21)',
  },
  evaluation: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgb(59, 130, 246)',
    text: 'rgb(96, 165, 250)',
  },
  patient: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgb(59, 130, 246)',
    text: 'rgb(96, 165, 250)',
  },
  surgical: {
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgb(234, 179, 8)',
    text: 'rgb(250, 204, 21)',
  },
  icu: {
    bg: 'rgba(99, 102, 241, 0.15)',
    border: 'rgb(99, 102, 241)',
    text: 'rgb(129, 140, 248)',
  },
  team: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: 'rgb(34, 197, 94)',
    text: 'rgb(74, 222, 128)',
  },
  deal: {
    bg: 'rgba(168, 85, 247, 0.15)',
    border: 'rgb(168, 85, 247)',
    text: 'rgb(216, 180, 254)',
  },
  default: {
    bg: 'rgba(156, 163, 175, 0.15)',
    border: 'rgb(156, 163, 175)',
    text: 'rgb(209, 213, 219)',
  },
};

// Categorize event based on title
export const categorizeEvent = (title: string): string => {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('telehealth') || lowerTitle.includes('telemedicine')) return 'telehealth';
  if (lowerTitle.includes('review')) return 'review';
  if (lowerTitle.includes('medication') || lowerTitle.includes('medical')) return 'medical';
  if (lowerTitle.includes('virtual')) return 'virtual';
  if (lowerTitle.includes('evaluation')) return 'evaluation';
  if (lowerTitle.includes('patient')) return 'patient';
  if (lowerTitle.includes('surgical') || lowerTitle.includes('surgery')) return 'surgical';
  if (lowerTitle.includes('icu') || lowerTitle.includes('critical care') || lowerTitle.includes('intensive')) return 'icu';
  if (lowerTitle.includes('team') || lowerTitle.includes('board') || lowerTitle.includes('interdisciplin')) return 'team';
  if (lowerTitle.includes('follow-up') || lowerTitle.includes('follow up') || lowerTitle.includes('followup') || lowerTitle.includes('deal task')) return 'deal';

  return 'default';
};

// Get week days starting from a specific date
export const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return days;
};

// Get start of week (Sunday)
export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

// Get all days in a month (starting from first Sunday to last Saturday to fill calendar grid)
export const getMonthDays = (date: Date): Date[] => {
  const days: Date[] = [];
  const year = date.getFullYear();
  const month = date.getMonth();

  // First day of the month
  const firstDay = new Date(year, month, 1);

  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);

  // Get the Sunday before or on the first day
  const startDate = getStartOfWeek(firstDay);

  // Calculate how many days we need (usually 35 or 42 days to fill 5-6 weeks)
  const dayOfWeekOfLast = lastDay.getDay();
  const daysAfterMonth = 6 - dayOfWeekOfLast; // Days to add after month ends to complete the week

  const totalDays = (lastDay.getDate() - 1) + startDate.getDay() + daysAfterMonth + 1;
  const weeksNeeded = Math.ceil(totalDays / 7);
  const totalCells = weeksNeeded * 7;

  // Generate all days
  for (let i = 0; i < totalCells; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }

  return days;
};

// Format date for display
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatFullDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Calculate event position in grid
export const calculateEventPosition = (
  event: CalendarEvent,
  dayStart: Date,
  startHour: number = 0,
  slotHeight: number = 48
): { top: number; height: number; column: number } => {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  // Calculate minutes from day start
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  // Calculate position from startHour
  const offsetMinutes = startHour * 60;
  const top = ((startMinutes - offsetMinutes) / 30) * slotHeight;

  // Calculate height (minimum 1 slot = 30 minutes)
  const durationMinutes = endMinutes - startMinutes;
  const height = Math.max((durationMinutes / 30) * slotHeight, slotHeight);

  // Calculate column (day of week)
  const eventDate = new Date(start);
  eventDate.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setHours(0, 0, 0, 0);

  const column = Math.floor((eventDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));

  return { top, height, column };
};

// Check if two events overlap
export const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
  const start1 = new Date(event1.startTime).getTime();
  const end1 = new Date(event1.endTime).getTime();
  const start2 = new Date(event2.startTime).getTime();
  const end2 = new Date(event2.endTime).getTime();

  return start1 < end2 && start2 < end1;
};

// Get events for a specific day (including repeating events)
export const getEventsForDay = (events: CalendarEvent[], date: Date): CalendarEvent[] => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return events.filter(event => {
    const eventStart = new Date(event.startTime);

    // For repeating events, show on every day (past the original date)
    if (event.isRepeating) {
      const originalDate = new Date(event.startTime);
      originalDate.setHours(0, 0, 0, 0);
      // Show on the original day and all future days
      return dayStart >= originalDate;
    }

    // Non-repeating events: show only on their actual day
    return eventStart >= dayStart && eventStart <= dayEnd;
  }).map(event => {
    // For repeating events, adjust the startTime/endTime to the current day
    if (event.isRepeating) {
      const originalStart = new Date(event.startTime);
      const originalEnd = new Date(event.endTime);

      // Create new times for this specific day
      const adjustedStart = new Date(date);
      adjustedStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

      const adjustedEnd = new Date(date);
      adjustedEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

      return {
        ...event,
        startTime: adjustedStart.toISOString(),
        endTime: adjustedEnd.toISOString(),
      };
    }
    return event;
  });
};

// Calculate current time position
export const getCurrentTimePosition = (startHour: number = 0, slotHeight: number = 48): number => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const offsetMinutes = startHour * 60;

  return ((minutes - offsetMinutes) / 30) * slotHeight;
};

// Check if time is in current view
export const isTimeInView = (startHour: number, endHour: number): boolean => {
  const now = new Date();
  const currentHour = now.getHours();

  return currentHour >= startHour && currentHour <= endHour;
};

// Generate time slots
export const generateTimeSlots = (startHour: number = 0, endHour: number = 24): string[] => {
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  return slots;
};

// Format time for display
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// Get month and year string
export const getMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Check if date is today
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

// Check if date is in current week
export const isCurrentWeek = (date: Date): boolean => {
  const today = new Date();
  const weekStart = getStartOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return date >= weekStart && date <= weekEnd;
};
