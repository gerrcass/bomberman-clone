import { describe, expect, it, vi } from 'vitest';

import { createInput } from './input';

type Handler = (event: KeyboardEvent) => void;

interface FakeWindow {
  readonly win: Window;
  emit(type: string, event?: Partial<KeyboardEvent>): void;
  readonly documentHidden: { value: boolean };
}

/**
 * Minimal window/document pair for the keyboard controller. The real app
 * passes a browser Window; the test only needs listener registration and
 * dispatch, so the cast is confined to this helper.
 */
function fakeWindow(): FakeWindow {
  const listeners = new Map<string, Set<Handler>>();
  const documentHidden = { value: false };

  function add(map: Map<string, Set<Handler>>, type: string, handler: Handler): void {
    const set = map.get(type) ?? new Set<Handler>();
    set.add(handler);
    map.set(type, set);
  }

  function remove(map: Map<string, Set<Handler>>, type: string, handler: Handler): void {
    map.get(type)?.delete(handler);
  }

  const docListeners = new Map<string, Set<Handler>>();
  const document = {
    get hidden() {
      return documentHidden.value;
    },
    addEventListener: (type: string, handler: Handler) => add(docListeners, type, handler),
    removeEventListener: (type: string, handler: Handler) => remove(docListeners, type, handler),
  };

  const win = {
    document,
    addEventListener: (type: string, handler: Handler) => add(listeners, type, handler),
    removeEventListener: (type: string, handler: Handler) => remove(listeners, type, handler),
  };

  return {
    win: win as unknown as Window,
    documentHidden,
    emit(type: string, event: Partial<KeyboardEvent> = {}): void {
      const base = {
        key: '',
        code: '',
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
      };
      const dispatched = { ...base, ...event } as unknown as KeyboardEvent;
      for (const handler of listeners.get(type) ?? []) handler(dispatched);
      for (const handler of docListeners.get(type) ?? []) handler(dispatched);
    },
  };
}

describe('keyboard input', () => {
  it('queues one detonate per X press and ignores key repeat', () => {
    const fake = fakeWindow();
    const input = createInput(fake.win, { onPauseToggle: vi.fn() });
    input.setGameplayEnabled(true);

    fake.emit('keydown', { key: 'x' });
    expect(input.consumeDetonate()).toBe(true);
    expect(input.consumeDetonate()).toBe(false);

    fake.emit('keydown', { key: 'x', repeat: true });
    expect(input.consumeDetonate()).toBe(false);
  });

  it('ignores gameplay keys while input is disabled', () => {
    const fake = fakeWindow();
    const input = createInput(fake.win, { onPauseToggle: vi.fn() });

    fake.emit('keydown', { key: 'x' });
    fake.emit('keydown', { code: 'Space' });
    expect(input.consumeDetonate()).toBe(false);
    expect(input.consumeBomb()).toBe(false);
  });

  it('clears a queued detonate when gameplay is disabled', () => {
    const fake = fakeWindow();
    const input = createInput(fake.win, { onPauseToggle: vi.fn() });
    input.setGameplayEnabled(true);
    fake.emit('keydown', { key: 'x' });

    input.setGameplayEnabled(false);
    expect(input.consumeDetonate()).toBe(false);
  });

  it('keeps pause on Escape and P, independent of gameplay focus', () => {
    const fake = fakeWindow();
    const onPauseToggle = vi.fn();
    createInput(fake.win, { onPauseToggle });

    fake.emit('keydown', { key: 'Escape' });
    fake.emit('keydown', { key: 'p' });
    fake.emit('keydown', { key: 'p', repeat: true });
    expect(onPauseToggle).toHaveBeenCalledTimes(2);
  });

  it('leaves keys typed in a text field to the browser', () => {
    const fake = fakeWindow();
    const onPauseToggle = vi.fn();
    const input = createInput(fake.win, { onPauseToggle });
    input.setGameplayEnabled(true);
    const target = { tagName: 'INPUT' } as unknown as EventTarget;

    fake.emit('keydown', { key: 'p', target });
    fake.emit('keydown', { key: 'Escape', target });
    fake.emit('keydown', { key: 'd', target });
    fake.emit('keydown', { code: 'Space', target });

    expect(onPauseToggle).not.toHaveBeenCalled();
    expect(input.direction).toBeNull();
    expect(input.consumeBomb()).toBe(false);
  });

  it('keeps pause keys working when a checkbox has focus', () => {
    const fake = fakeWindow();
    const onPauseToggle = vi.fn();
    createInput(fake.win, { onPauseToggle });
    const target = { tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget;

    fake.emit('keydown', { key: 'p', target });

    expect(onPauseToggle).toHaveBeenCalledTimes(1);
  });

  it('leaves keys typed in date and time fields to the browser', () => {
    for (const type of ['date', 'time', 'month', 'week', 'datetime-local']) {
      const fake = fakeWindow();
      const onPauseToggle = vi.fn();
      const input = createInput(fake.win, { onPauseToggle });
      input.setGameplayEnabled(true);
      const target = { tagName: 'INPUT', type } as unknown as EventTarget;

      fake.emit('keydown', { key: 'p', target });
      fake.emit('keydown', { key: 'Escape', target });
      fake.emit('keydown', { key: 'd', target });
      fake.emit('keydown', { code: 'Space', target });

      expect(onPauseToggle).not.toHaveBeenCalled();
      expect(input.direction).toBeNull();
      expect(input.consumeBomb()).toBe(false);
      expect(input.consumeDetonate()).toBe(false);
    }
  });

  it('releases a held direction and clears it on blur', () => {
    const fake = fakeWindow();
    const input = createInput(fake.win, { onPauseToggle: vi.fn() });
    input.setGameplayEnabled(true);

    fake.emit('keydown', { key: 'd' });
    expect(input.direction).toBe('right');
    fake.emit('keyup', { key: 'd' });
    expect(input.direction).toBeNull();

    fake.emit('keydown', { key: 'w' });
    fake.emit('blur');
    expect(input.direction).toBeNull();
  });

  it('clears queued input when the document becomes hidden', () => {
    const fake = fakeWindow();
    const input = createInput(fake.win, { onPauseToggle: vi.fn() });
    input.setGameplayEnabled(true);
    fake.emit('keydown', { key: 'd' });
    fake.emit('keydown', { code: 'Space' });

    fake.documentHidden.value = true;
    fake.emit('visibilitychange');

    expect(input.direction).toBeNull();
    expect(input.consumeBomb()).toBe(false);
  });
});
