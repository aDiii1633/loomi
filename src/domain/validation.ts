/**
 * Input validation for every user-editable value.
 * Validation lives here — never trust data because it came from the UI.
 */

export type ValidationResult = { ok: true } | { ok: false; message: string };

export const ok: ValidationResult = { ok: true };
export const fail = (message: string): ValidationResult => ({ ok: false, message });

const MAX_TEXT = {
  chat: 2000,
  question: 500,
  moodNote: 280,
  bucketTitle: 120,
  bucketNotes: 500,
  goalTitle: 120,
  reminderTitle: 120,
  reminderNotes: 500,
  journalTitle: 120,
  journalText: 10000,
  memoryTitle: 120,
  memoryCaption: 300,
  timelineTitle: 120,
  timelineDesc: 1000,
  vaultNote: 300,
  dateTitle: 80,
  profileName: 40,
} as const;

export function validateText(
  value: string,
  field: keyof typeof MAX_TEXT,
  opts: { required?: boolean; fieldName?: string } = {}
): ValidationResult {
  const name = opts.fieldName ?? 'This field';
  const trimmed = value.trim();
  if (!trimmed) {
    return opts.required === false ? ok : fail(`${name} can't be empty.`);
  }
  if (trimmed.length > MAX_TEXT[field]) {
    return fail(`${name} is too long (max ${MAX_TEXT[field]} characters).`);
  }
  return ok;
}

export function validateNumberInRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  if (!Number.isFinite(value)) return fail(`${fieldName} must be a number.`);
  if (value < min) return fail(`${fieldName} can't be less than ${min}.`);
  if (value > max) return fail(`${fieldName} can't be more than ${max}.`);
  return ok;
}

/** Media file validation for picked assets. */
export const MEDIA_LIMITS = {
  maxImageMB: 25,
  maxVideoMB: 200,
  maxAudioMB: 20,
} as const;

export function validateMediaSize(bytes: number, kind: 'image' | 'video' | 'audio'): ValidationResult {
  const mb = bytes / (1024 * 1024);
  const limit =
    kind === 'image' ? MEDIA_LIMITS.maxImageMB : kind === 'video' ? MEDIA_LIMITS.maxVideoMB : MEDIA_LIMITS.maxAudioMB;
  if (mb > limit) return fail(`File is too large (${mb.toFixed(1)} MB). Limit is ${limit} MB.`);
  return ok;
}

/** A reminder must be schedulable: not in the past, within 2 years. */
export function validateReminderDue(dueAt: number, now = Date.now()): ValidationResult {
  if (!Number.isFinite(dueAt)) return fail('Pick a valid date and time.');
  if (dueAt < now - 60_000) return fail('Reminders must be in the future.');
  if (dueAt > now + 1000 * 60 * 60 * 24 * 730) return fail('Reminders can be at most 2 years ahead.');
  return ok;
}

/** Date-only input "YYYY-MM-DD", optionally restricted to the past. */
export function validateDayISO(
  iso: string,
  opts: { allowFuture?: boolean; fieldName?: string } = {}
): ValidationResult {
  const name = opts.fieldName ?? 'Date';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fail(`${name} is not a valid date.`);
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) {
    return fail(`${name} is out of range.`);
  }
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
    return fail(`${name} is not a real calendar date.`);
  }
  if (!opts.allowFuture && probe.getTime() > Date.now() + 86_400_000) {
    return fail(`${name} can't be in the future.`);
  }
  return ok;
}

export function validatePin(pin: string): ValidationResult {
  if (!/^\d{4,8}$/.test(pin)) return fail('PIN must be 4 to 8 digits.');
  if (/^(\d)\1+$/.test(pin)) return fail("PIN can't repeat a single digit.");
  if (pin === '1234' || pin === '4321' || pin === '0000') {
    return fail('That PIN is too common. Pick something less predictable.');
  }
  return ok;
}

export function isDuplicateTitle<T>(
  items: readonly T[],
  getTitle: (item: T) => string,
  newTitle: string,
  excludeId?: string,
  getId?: (item: T) => string
): boolean {
  const t = newTitle.trim().toLowerCase();
  return items.some((item) => {
    if (excludeId && getId && getId(item) === excludeId) return false;
    return getTitle(item).trim().toLowerCase() === t;
  });
}
