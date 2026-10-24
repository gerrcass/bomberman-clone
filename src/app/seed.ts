/** The largest Seed the run controller accepts, `0xFFFFFFFF`. */
export const MAX_SEED = 0xffffffff;

/** True when a value is an unsigned 32-bit integer. */
export function isSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SEED;
}

/**
 * Formats a Seed as its canonical Seed Code: uppercase base36 with no leading
 * zeroes. Formatting an out-of-range or non-integer Seed is a programmer error.
 */
export function formatSeed(seed: number): string {
  if (!isSeed(seed)) {
    throw new RangeError(`Seed must be an unsigned 32-bit integer: ${String(seed)}`);
  }
  return seed.toString(36).toUpperCase();
}

const SEED_CODE_PATTERN = /^[0-9A-Za-z]+$/;
const MAX_SIGNIFICANT_DIGITS = 7;

/**
 * Parses a Seed Code. Input is case-insensitive and trims surrounding
 * whitespace; leading zeroes are allowed. Returns null for empty input, a
 * non-base36 character, more than seven significant characters, or a value
 * above `0xFFFFFFFF`.
 */
export function parseSeedCode(code: string): number | null {
  const trimmed = code.trim();
  if (trimmed.length === 0 || !SEED_CODE_PATTERN.test(trimmed)) {
    return null;
  }

  const significant = trimmed.replace(/^0+/, '');
  if (significant.length > MAX_SIGNIFICANT_DIGITS) {
    return null;
  }
  if (significant.length === 0) {
    return 0;
  }

  const seed = Number.parseInt(significant, 36);
  return isSeed(seed) ? seed : null;
}
