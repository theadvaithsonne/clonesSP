// utils/dateUtils.ts
export const getUserTimezone = (): string => {
    // Get user's timezone from browser or use a default
    if (typeof window !== 'undefined') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return 'America/New_York'; // fallback
};

export const formatDateForUser = (date: Date, timeZone?: string): string => {
    if (!date) return 'dd-mm-yyyy';

    const userTimeZone = timeZone || getUserTimezone();

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: userTimeZone
    }).format(date);
};

export const getStartOfDayInTimeZone = (timeZone?: string): Date => {
    const userTimeZone = timeZone || getUserTimezone();
    const now = new Date();

    // Format the current date in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    // Create date string in user's timezone
    const dateString = `${year}-${month}-${day}T00:00:00`;

    // Parse as local date (this will be the start of day in user's timezone)
    return new Date(dateString);
};