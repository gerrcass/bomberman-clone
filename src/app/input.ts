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
  /** True once per X press, then cleared. */
  consumeDetonate(): boolean;
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

const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'time',
  'month',
  'week',
  'datetime-local',
]);

/**
 * True when the key event targets a text field. The browser owns those
 * keystrokes: treating `p` as pause would make a Seed Code impossible to type.
 * Duck typing keeps the check usable in the Node test environment.
 */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') {
    return false;
  }
  const element = target as { tagName?: unknown; isContentEditable?: unknown; type?: unknown };
  if (element.isContentEditable === true) {
    return true;
  }
  if (typeof element.tagName !== 'string') {
    return false;
  }
  const tagName = element.tagName.toUpperCase();
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (tagName !== 'INPUT') {
    return false;
  }
  // Checkboxes and radios must keep the existing Escape/P behavior; only text
  // entry owns the letter keys.
  return typeof element.type !== 'string' || TEXT_INPUT_TYPES.has(element.type.toLowerCase());
}

/**
 * Keyboard input for the browser shell. The newest held direction wins, which
 * makes switching corners feel immediate while the simulation still buffers
 * perpendicular turns at tile centers.
 */
export function createInput(win: Window, actions: InputActions): InputController {
  const held: Direction[] = [];
  let gameplayEnabled = false;
  let bombQueued = false;
  let detonateQueued = false;

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
    detonateQueued = false;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (isTextEntryTarget(event.target)) {
      return;
    }

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
      return;
    }

    if (key === 'x') {
      event.preventDefault();
      if (!event.repeat) {
        detonateQueued = true;
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
    consumeDetonate(): boolean {
      const queued = detonateQueued;
      detonateQueued = false;
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
