/** Local calendar date key, `YYYY-MM-DD`, zero-padded. */
export function dailyDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a local `YYYY-MM-DD` key into a Date. Returns null for a malformed
 * key or an impossible calendar date such as `2026-02-31`.
 */
export function dailyDateFromKey(key: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(key);
  if (match === null) {
    return null;
  }
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return dailyDateKey(date) === key ? date : null;
}

/** True when a value is a real local `YYYY-MM-DD` calendar date key. */
export function isDailyKey(value: unknown): value is string {
  return typeof value === 'string' && dailyDateFromKey(value) !== null;
}

/**
 * Stable unsigned 32-bit seed for a local date. The date key is hashed with
 * 32-bit FNV-1a, so every attempt on the same local date replays the same
 * Daily Run. Purely a function of the injected `Date`.
 */
export function dailySeed(date: Date): number {
  const key = dailyDateKey(date);
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
