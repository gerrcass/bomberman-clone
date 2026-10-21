import type { Direction } from '../game';

export interface InputActions {
  /** Escape or P. The app decides whether that means pause or resume. */
  onPauseToggle(): void;
}

export interface InputController {
  /** Most recently pressed direction that is still held. */
  readonly direction: Direction | null;
  /** True once per Space press, then cleared. */
  consumeBomb(): boolean;
  setGameplayEnabled(enabled: boolean): void;
  clear(): void;
  dispose(): void;
}

const DIRECTION_KEYS: Readonly<Record<string, Direction>> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

/**
 * Keyboard input for the browser shell. The newest held direction wins, which
 * makes switching corners feel immediate while the simulation still buffers
 * perpendicular turns at tile centers.
 */
export function createInput(win: Window, actions: InputActions): InputController {
  const held: Direction[] = [];
  let gameplayEnabled = false;
  let bombQueued = false;

  function press(direction: Direction): void {
    const existing = held.indexOf(direction);
    if (existing !== -1) {
      held.splice(existing, 1);
    }
    held.push(direction);
  }

  function release(direction: Direction): void {
    const existing = held.indexOf(direction);
    if (existing !== -1) {
      held.splice(existing, 1);
    }
  }

  function clear(): void {
    held.length = 0;
    bombQueued = false;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'escape' || key === 'p') {
      if (event.repeat) {
        return;
      }
      event.preventDefault();
      actions.onPauseToggle();
      return;
    }

    if (!gameplayEnabled) {
      return;
    }

    const direction = DIRECTION_KEYS[key];
    if (direction !== undefined) {
      event.preventDefault();
      if (!event.repeat) {
        press(direction);
      }
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) {
        bombQueued = true;
      }
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    const direction = DIRECTION_KEYS[event.key.toLowerCase()];
    if (direction !== undefined) {
      release(direction);
    }
  }

  function onBlur(): void {
    clear();
  }

  function onVisibilityChange(): void {
    if (win.document.hidden) {
      clear();
    }
  }

  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', onBlur);
  win.document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    get direction(): Direction | null {
      return held.at(-1) ?? null;
    },
    consumeBomb(): boolean {
      const queued = bombQueued;
      bombQueued = false;
      return queued;
    },
    setGameplayEnabled(enabled: boolean): void {
      gameplayEnabled = enabled;
      if (!enabled) {
        clear();
      }
    },
    clear,
    dispose(): void {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', onBlur);
      win.document.removeEventListener('visibilitychange', onVisibilityChange);
      clear();
    },
  };
}
