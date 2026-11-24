const WEEKDAY_TO_ISO_DAY: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export interface TenantDate {
  /** Calendar date in the tenant timezone, formatted as YYYY-MM-DD. */
  date: string;
  /** ISO weekday: Monday = 1 ... Sunday = 7. */
  isoDay: number;
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): string {
  const match = parts.find((part) => part.type === type);
  return match?.value ?? '';
}

/**
 * Resolves "today" from the tenant's perspective instead of the server's. A
 * server in UTC must not roll the attendance sheet over at 05:30 IST.
 */
export function getTenantDate(timeZone: string): TenantDate {
  const now = new Date();

  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = readDatePart(dateParts, 'year');
  const month = readDatePart(dateParts, 'month');
  const day = readDatePart(dateParts, 'day');

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now);

  return {
    date: `${year}-${month}-${day}`,
    isoDay: WEEKDAY_TO_ISO_DAY[weekday] ?? 1,
  };
}
