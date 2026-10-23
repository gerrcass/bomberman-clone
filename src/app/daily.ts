/** Local calendar date key, `YYYY-MM-DD`, zero-padded. */
export function dailyDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

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
