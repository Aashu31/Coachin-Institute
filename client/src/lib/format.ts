export function formatDateLabel(isoDate: string): string {
  if (!isoDate) {
    return '—';
  }

  const parsed = new Date(`${isoDate}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatTimeOfDay(time: string | null | undefined): string {
  if (!time) {
    return '—';
  }
  const hours = Number.parseInt(time.slice(0, 2), 10);
  const minutes = Number.parseInt(time.slice(3, 5), 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = String(minutes).padStart(2, '0');

  return `${displayHour}:${displayMinutes} ${period}`;
}

export function formatClockTime(isoTimestamp: string): string {
  if (!isoTimestamp) {
    return '—';
  }

  const parsed = new Date(isoTimestamp);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(parsed);
}

export function formatDateTime(isoTimestamp: string): string {
  if (!isoTimestamp) {
    return '—';
  }

  const parsed = new Date(isoTimestamp);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(parsed);
}

export function todayInTenantTimezone(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const read = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';

  return `${read('year')}-${read('month')}-${read('day')}`;
}
