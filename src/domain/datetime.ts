/**
 * Date/time helpers. All date-only values are strings "YYYY-MM-DD" in the
 * device's local calendar day. Never do fragile string math on them.
 */
import {
  format,
  parse,
  addDays,
  addMonths,
  startOfDay,
  differenceInCalendarDays,
  isValid,
} from 'date-fns';
import { enUS } from 'date-fns/locale';

const DAY_FMT = 'yyyy-MM-dd';

export function nowMs(): number {
  return Date.now();
}

/** Local calendar day for an epoch, as YYYY-MM-DD. */
export function dayISO(ts: number = Date.now()): string {
  return format(ts, DAY_FMT);
}

/** Parse YYYY-MM-DD into a local Date at midnight. Returns null when invalid. */
export function fromDayISO(iso: string): Date | null {
  const d = parse(iso, DAY_FMT, new Date());
  return isValid(d) ? d : null;
}

export function isValidDayISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return fromDayISO(iso) !== null;
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromDayISO(iso);
  if (!d) throw new Error(`Invalid day ISO: ${iso}`);
  return format(addDays(d, days), DAY_FMT);
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  const a = fromDayISO(fromISO);
  const b = fromDayISO(toISO);
  if (!a || !b) throw new Error('daysBetweenISO: invalid input');
  return differenceInCalendarDays(b, a);
}

export function startOfToday(): number {
  return startOfDay(Date.now()).getTime();
}

/** "Friday, June 14" style. */
export function formatFriendlyLong(ts: number): string {
  return format(ts, 'EEEE, MMMM d', { locale: enUS });
}

/** "Wed, Jun 26 • 8:00 PM" style for a reminder timestamp. */
export function formatFriendlyDateTime(ts: number): string {
  return format(ts, 'EEE, MMM d • h:mm a', { locale: enUS });
}

export function formatTime(ts: number): string {
  return format(ts, 'h:mm a', { locale: enUS });
}

export function formatDayLabel(dayISOStr: string): string {
  const d = fromDayISO(dayISOStr);
  if (!d) return dayISOStr;
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return format(d, diff < 0 && diff > -7 ? 'EEEE' : 'MMM d, yyyy');
}

/** Anniversary helpers --------------------------------------------------- */

export function daysTogether(anniversaryISO: string, now: number = Date.now()): number {
  const a = fromDayISO(anniversaryISO);
  if (!a) return 0;
  const diff = differenceInCalendarDays(new Date(now), a);
  return Math.max(0, diff + 1); // day one counts
}

/** Next occurrence of a (possibly yearly) date, as epoch ms of that local midnight. */
export function nextOccurrence(dateISO: string, yearly: boolean): number {
  const d = fromDayISO(dateISO);
  if (!d) return NaN;
  if (!yearly) return d.getTime();
  const today = new Date();
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (differenceInCalendarDays(next, today) < 0) {
    next = addMonths(next, 12);
  }
  return next.getTime();
}

export function daysUntil(dateISO: string, yearly: boolean): number {
  const next = nextOccurrence(dateISO, yearly);
  if (Number.isNaN(next)) return NaN;
  return differenceInCalendarDays(new Date(next), new Date());
}
