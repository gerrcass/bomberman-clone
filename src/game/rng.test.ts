import { describe, expect, it } from 'vitest';

import { createRng, shuffle } from './rng';

describe('seeded rng', () => {
  it('replays the same sequence for the same seed', () => {
    const first = createRng(123456);
    const second = createRng(123456);

    const firstDraws = Array.from({ length: 32 }, () => first.next());
    const secondDraws = Array.from({ length: 32 }, () => second.next());

    expect(firstDraws).toEqual(secondDraws);
  });

  it('produces different sequences for different seeds', () => {
    const first = createRng(1);
    const second = createRng(2);

    expect(Array.from({ length: 8 }, () => first.next())).not.toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });

  it('keeps draws in [0, 1) and integers inside the requested bound', () => {
    const rng = createRng(98765);

    for (let i = 0; i < 200; i += 1) {
      const draw = rng.next();
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);

      const integer = rng.nextInt(7);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(0);
      expect(integer).toBeLessThan(7);
    }
  });

  it('shuffles deterministically without losing items', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];

    const first = shuffle(createRng(42), items);
    const second = shuffle(createRng(42), items);

    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([...items].sort());
    expect(first).not.toEqual(items);
  });
});
