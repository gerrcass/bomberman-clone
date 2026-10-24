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

interface PageUrlParts {
  readonly path: string;
  readonly query: string | null;
  readonly hash: string;
}

/**
 * Splits a page URL into the raw path, query contents, and hash. Working with
 * the raw pieces keeps unrelated parameters byte-for-byte intact instead of
 * reserializing the whole query string.
 */
function splitPageUrl(pageUrl: string): PageUrlParts {
  const hashIndex = pageUrl.indexOf('#');
  const hash = hashIndex === -1 ? '' : pageUrl.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? pageUrl : pageUrl.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex === -1) {
    return { path: beforeHash, query: null, hash };
  }
  return {
    path: beforeHash.slice(0, queryIndex),
    query: beforeHash.slice(queryIndex + 1),
    hash,
  };
}

/** The decoded name of one raw `key=value` query segment. */
function queryParamName(segment: string): string {
  const equalsIndex = segment.indexOf('=');
  const rawName = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
  try {
    return decodeURIComponent(rawName.replace(/\+/g, ' '));
  } catch {
    return rawName;
  }
}

function isSeedSegment(segment: string): boolean {
  return queryParamName(segment) === 'seed';
}

/**
 * Splits raw query contents into non-empty `key=value` segments. Empty
 * segments (`?`, a trailing `&`, or `&&`) carry no parameter and are dropped
 * so building and removing a Seed never leaves a stray separator.
 */
function querySegments(query: string | null): readonly string[] {
  return query === null ? [] : query.split('&').filter((segment) => segment.length > 0);
}

/**
 * Builds the canonical Share Link for a Seed from the current page URL. The
 * path, every non-seed query parameter, and the hash are preserved; any
 * existing `seed` values are replaced with the canonical uppercase Seed Code.
 * An invalid Seed is a programmer error.
 */
export function buildShareLink(pageUrl: string, seed: number): string {
  const code = formatSeed(seed);
  const { path, query, hash } = splitPageUrl(pageUrl);
  const params = querySegments(query).filter((segment) => !isSeedSegment(segment));
  params.push(`seed=${code}`);
  return `${path}?${params.join('&')}${hash}`;
}

/**
 * Parses the `seed` query parameter of a Share Link. A missing, empty, or
 * invalid value returns null. The value uses the same case and whitespace
 * normalization as a typed Seed Code.
 */
export function parseShareLinkSeed(pageUrl: string): number | null {
  const { query } = splitPageUrl(pageUrl);
  if (query === null) {
    return null;
  }
  const code = new URLSearchParams(query).get('seed');
  return code === null ? null : parseSeedCode(code);
}

/**
 * Removes only the `seed` query parameter from a URL, preserving the path,
 * every other parameter (including its raw encoding and order), and the hash.
 * Used to consume a deep link through the History API.
 */
export function removeSeedParam(pageUrl: string): string {
  const { path, query, hash } = splitPageUrl(pageUrl);
  if (query === null) {
    return pageUrl;
  }
  const params = querySegments(query);
  const kept = params.filter((segment) => !isSeedSegment(segment));
  if (kept.length === params.length) {
    return pageUrl;
  }
  const remaining = kept.join('&');
  return remaining.length === 0 ? `${path}${hash}` : `${path}?${remaining}${hash}`;
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
