const HAS_EXPLICIT_TIMEZONE = /(Z|[+-]\d{2}(?::?\d{2})?)$/i;

const JST_TIME_ZONE = 'Asia/Tokyo';

const DEFAULT_DATE_TIME_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
} satisfies Intl.DateTimeFormatOptions;

const DEFAULT_DATE_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
} satisfies Intl.DateTimeFormatOptions;

export function normalizeTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withTimeSeparator = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  if (HAS_EXPLICIT_TIMEZONE.test(withTimeSeparator)) {
    return withTimeSeparator;
  }

  return `${withTimeSeparator}Z`;
}

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(normalizeTimestamp(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimeInJst(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_TIME_OPTIONS
): string {
  if (!value) {
    return '-';
  }

  const parsed = parseTimestamp(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleString('ja-JP', {
    timeZone: JST_TIME_ZONE,
    ...options
  });
}

export function formatDateInJst(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
  if (!value) {
    return '-';
  }

  const parsed = parseTimestamp(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString('ja-JP', {
    timeZone: JST_TIME_ZONE,
    ...options
  });
}

function toTimestampMs(value: string | null | undefined): number {
  return parseTimestamp(value)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

export function compareTimestampsDesc(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftTime = toTimestampMs(left);
  const rightTime = toTimestampMs(right);

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime > rightTime ? -1 : 1;
}

export function compareTimestampsAsc(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftTime = toTimestampMs(left);
  const rightTime = toTimestampMs(right);

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime < rightTime ? -1 : 1;
}
