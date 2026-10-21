import { describe, expect, it } from 'vitest';

import { CANVAS_HEIGHT, CANVAS_WIDTH, computeCanvasFit } from './fit';

describe('canvas fit', () => {
  it('uses integer-friendly half steps on large screens', () => {
    const fit = computeCanvasFit(1920, 1080);

    expect(fit.scale).toBe(1.5);
    expect(fit.width).toBe(1080);
    expect(fit.height).toBe(936);
  });

  it('fits the logical canvas exactly at the common laptop size', () => {
    const fit = computeCanvasFit(1366, 768);

    expect(fit).toEqual({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, scale: 1 });
  });

  it('shrinks below 1x rather than overflowing a narrow viewport', () => {
    const fit = computeCanvasFit(400, 800);

    expect(fit.width).toBeLessThanOrEqual(400 - 32);
    expect(fit.height).toBeLessThanOrEqual(800);
    expect(fit.width / fit.height).toBeCloseTo(CANVAS_WIDTH / CANVAS_HEIGHT, 2);
  });
});
