/** Logical canvas size: 15 tiles by 13 tiles at 48 px each. */
export const CANVAS_WIDTH = 720;
export const CANVAS_HEIGHT = 624;

const VIEWPORT_WIDTH_MARGIN = 32;
/** HUD, gaps, and page padding reserved around the canvas. */
const VERTICAL_CHROME = 128;

export interface CanvasFit {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * Fits the canvas inside the viewport while keeping its aspect ratio.
 * Above 1x, the scale snaps to half steps so the pixel grid stays regular.
 */
export function computeCanvasFit(viewportWidth: number, viewportHeight: number): CanvasFit {
  const availableWidth = Math.max(1, viewportWidth - VIEWPORT_WIDTH_MARGIN);
  const availableHeight = Math.max(1, viewportHeight - VERTICAL_CHROME);
  const rawScale = Math.min(availableWidth / CANVAS_WIDTH, availableHeight / CANVAS_HEIGHT);
  const scale = rawScale >= 1 ? Math.floor(rawScale * 2) / 2 : rawScale;

  return {
    width: Math.max(1, Math.round(CANVAS_WIDTH * scale)),
    height: Math.max(1, Math.round(CANVAS_HEIGHT * scale)),
    scale,
  };
}
