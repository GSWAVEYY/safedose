/**
 * Format an ISO 8601 date string for display.
 * Uses Intl.DateTimeFormat — works in both Node and React Native.
 */
export function formatDate(
  isoString: string,
  locale: string = 'en',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(isoString));
}

/**
 * Format a time-only string (HH:mm) for display, respecting the user's locale.
 */
export function formatTime(
  timeString: string,
  locale: string = 'en',
  use24Hour: boolean = false,
): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24Hour,
  }).format(date);
}

/**
 * Returns true if the given ISO date string is today.
 */
export function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Returns current UTC ISO string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}
