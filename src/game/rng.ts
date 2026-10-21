/**
 * Deterministic seeded randomness. Every gameplay draw goes through an
 * instance of this generator; `Math.random` never enters the simulation.
 *
 * The generator is Mulberry32: tiny, fast, and good enough for arena layout
 * and AI tie-breaks. Identical seeds replay identical sequences.
 */
export interface Rng {
  readonly seed: number;
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

const UINT32_RANGE = 4_294_967_296;

export function createRng(seed: number): Rng {
  const normalizedSeed = seed >>> 0;
  let state = normalizedSeed;

  return {
    seed: normalizedSeed,
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('maxExclusive must be a positive integer');
      }
      return Math.floor(this.next() * maxExclusive);
    },
  };
}

/** Fisher–Yates shuffle; returns a new array and leaves the input untouched. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(index + 1);
    const current = result[index];
    const replacement = result[swapIndex];
    if (current === undefined || replacement === undefined) {
      continue;
    }
    result[index] = replacement;
    result[swapIndex] = current;
  }

  return result;
}
