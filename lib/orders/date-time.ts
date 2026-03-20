import { formatDateTimeInJst } from '@/lib/date-time';

export function formatOrderDateTime(value: string | null): string {
  return formatDateTimeInJst(value);
}
