import { createStage, tickStage } from '../game';
import { type ArenaRenderer, createArenaRenderer } from '../render/renderer';
import { computeCanvasFit } from './fit';
import { createInput } from './input';
import { planFixedSteps } from './loop';

type ScreenState = 'title' | 'playing' | 'paused';

const TITLE_SEED = 7;

export interface GameApp {
  start(): void;
}

/**
 * Browser shell: screen state, DOM HUD and menus, keyboard wiring, and the
 * fixed-timestep loop. Gameplay lives behind the stage seam.
 */
export function createGameApp(doc: Document): GameApp {
  const browserWindow = doc.defaultView;
  if (browserWindow === null) {
    throw new Error('Bomb Blitz requires a browser window');
  }
  const win: Window = browserWindow;

  const shell = requireElement<HTMLElement>(doc, '#game-shell');
  const canvas = requireElement<HTMLCanvasElement>(doc, '#game-canvas');
  const hud = requireElement<HTMLElement>(doc, '#hud');
  const hudStage = requireElement<HTMLElement>(doc, '#hud-stage');
  const hudLives = requireElement<HTMLElement>(doc, '#hud-lives');
  const hudScore = requireElement<HTMLElement>(doc, '#hud-score');
  const hudBombs = requireElement<HTMLElement>(doc, '#hud-bombs');
  const titleScreen = requireElement<HTMLElement>(doc, '#title-screen');
  const pauseScreen = requireElement<HTMLElement>(doc, '#pause-screen');
  const playButton = requireElement<HTMLButtonElement>(doc, '#play-button');
  const resumeButton = requireElement<HTMLButtonElement>(doc, '#resume-button');
  const quitButton = requireElement<HTMLButtonElement>(doc, '#quit-button');

  const renderer: ArenaRenderer = createArenaRenderer(canvas);

  let screen: ScreenState = 'title';
  let stage = createStage({ seed: TITLE_SEED });
  let accumulator = 0;
  let lastFrameTime = 0;
  let running = false;

  const input = createInput(win, {
    onPauseToggle: () => {
      if (screen === 'playing') {
        pauseGame();
      } else if (screen === 'paused') {
        resumeGame();
      }
    },
    onBomb: () => {
      // Bomb placement lands with ticket 02; the intent is already wired.
    },
  });

  function updateHud(): void {
    const state = stage.getState();
    setText(hudStage, String(state.stage));
    setText(hudLives, String(state.lives));
    setText(hudScore, String(state.score).padStart(6, '0'));
    setText(hudBombs, `${state.activeBombs}/${state.bombCapacity}`);
  }

  function startRun(): void {
    stage = createStage({ seed: Date.now() >>> 0, stage: 1 });
    screen = 'playing';
    titleScreen.hidden = true;
    pauseScreen.hidden = true;
    hud.hidden = false;
    input.setGameplayEnabled(true);
    accumulator = 0;
    lastFrameTime = win.performance.now();
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function pauseGame(): void {
    if (screen !== 'playing') {
      return;
    }
    screen = 'paused';
    pauseScreen.hidden = false;
    input.setGameplayEnabled(false);
    accumulator = 0;
    resumeButton.focus();
  }

  function resumeGame(): void {
    if (screen !== 'paused') {
      return;
    }
    screen = 'playing';
    pauseScreen.hidden = true;
    input.setGameplayEnabled(true);
    accumulator = 0;
    lastFrameTime = win.performance.now();
    canvas.focus({ preventScroll: true });
  }

  function quitToTitle(): void {
    stage = createStage({ seed: TITLE_SEED });
    screen = 'title';
    pauseScreen.hidden = true;
    hud.hidden = true;
    titleScreen.hidden = false;
    input.setGameplayEnabled(false);
    accumulator = 0;
    updateHud();
    playButton.focus();
  }

  function fitCanvas(): void {
    const fit = computeCanvasFit(win.innerWidth, win.innerHeight);
    shell.style.setProperty('--canvas-width', `${fit.width}px`);
    shell.style.setProperty('--canvas-height', `${fit.height}px`);
  }

  function frame(now: number): void {
    const elapsed = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (screen === 'playing') {
      const plan = planFixedSteps(accumulator, elapsed);
      accumulator = plan.accumulator;

      for (let step = 0; step < plan.steps; step += 1) {
        tickStage(stage, { direction: input.direction });
      }

      if (plan.steps > 0) {
        updateHud();
      }
    } else {
      accumulator = 0;
    }

    renderer.render(stage.getState());
    win.requestAnimationFrame(frame);
  }

  function onVisibilityChange(): void {
    if (doc.hidden && screen === 'playing') {
      pauseGame();
    }
  }

  function onPauseScreenKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || pauseScreen.hidden) {
      return;
    }

    const focusable = [resumeButton, quitButton];
    // activeElement is only compared here; the pause buttons are the only
    // focusable elements inside the modal.
    const currentIndex = focusable.indexOf(doc.activeElement as HTMLButtonElement);
    const delta = event.shiftKey ? -1 : 1;
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + delta + focusable.length) % focusable.length;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  playButton.addEventListener('click', startRun);
  resumeButton.addEventListener('click', resumeGame);
  quitButton.addEventListener('click', quitToTitle);
  pauseScreen.addEventListener('keydown', onPauseScreenKeyDown);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  win.addEventListener('resize', fitCanvas);

  return {
    start(): void {
      if (running) {
        return;
      }
      running = true;
      fitCanvas();
      updateHud();
      playButton.focus();
      lastFrameTime = win.performance.now();
      win.requestAnimationFrame(frame);
    },
  };
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const element = doc.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}
