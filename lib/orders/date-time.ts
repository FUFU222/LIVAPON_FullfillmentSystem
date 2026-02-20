const HAS_EXPLICIT_TIMEZONE = /(Z|[+-]\d{2}(?::?\d{2})?)$/i;

function normalizeTimestamp(value: string): string {
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

export function formatOrderDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(normalizeTimestamp(value));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
