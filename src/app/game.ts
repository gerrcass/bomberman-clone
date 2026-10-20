import {
  createRun,
  createStage,
  type Run,
  type RunState,
  type StageEvent,
  type StageState,
  UPGRADE_DEFINITIONS,
  type UpgradeId,
} from '../game';
import { type ArenaRenderer, createArenaRenderer } from '../render/renderer';
import { computeCanvasFit } from './fit';
import { createInput } from './input';
import { planFixedSteps } from './loop';

type ScreenState = 'title' | 'playing' | 'paused' | 'intermission' | 'gameover';

const TITLE_SEED = 7;
const STAGE_INTRO_TICKS = 90;

export interface GameApp {
  start(): void;
}

/**
 * Browser shell: screen state, DOM HUD and menus, keyboard wiring, and the
 * fixed-timestep loop. Gameplay lives behind the run/stage seam.
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
  const hudBlast = requireElement<HTMLElement>(doc, '#hud-blast');
  const hudSpeed = requireElement<HTMLElement>(doc, '#hud-speed');
  const hudShield = requireElement<HTMLElement>(doc, '#hud-shield');
  const hudRivals = requireElement<HTMLElement>(doc, '#hud-rivals');
  const titleScreen = requireElement<HTMLElement>(doc, '#title-screen');
  const pauseScreen = requireElement<HTMLElement>(doc, '#pause-screen');
  const intermissionScreen = requireElement<HTMLElement>(doc, '#intermission-screen');
  const intermissionSummary = requireElement<HTMLElement>(doc, '#intermission-summary');
  const upgradeCards = requireElement<HTMLElement>(doc, '#upgrade-cards');
  const stageIntro = requireElement<HTMLElement>(doc, '#stage-intro');
  const stageIntroStage = requireElement<HTMLElement>(doc, '#stage-intro-stage');
  const stageIntroRivals = requireElement<HTMLElement>(doc, '#stage-intro-rivals');
  const gameoverScreen = requireElement<HTMLElement>(doc, '#gameover-screen');
  const gameoverScore = requireElement<HTMLElement>(doc, '#gameover-score');
  const gameoverStage = requireElement<HTMLElement>(doc, '#gameover-stage');
  const gameoverBricks = requireElement<HTMLElement>(doc, '#gameover-bricks');
  const gameoverRivals = requireElement<HTMLElement>(doc, '#gameover-rivals');
  const gameoverPickups = requireElement<HTMLElement>(doc, '#gameover-pickups');
  const gameoverTime = requireElement<HTMLElement>(doc, '#gameover-time');
  const playButton = requireElement<HTMLButtonElement>(doc, '#play-button');
  const resumeButton = requireElement<HTMLButtonElement>(doc, '#resume-button');
  const quitButton = requireElement<HTMLButtonElement>(doc, '#quit-button');
  const retryButton = requireElement<HTMLButtonElement>(doc, '#retry-button');
  const titleButton = requireElement<HTMLButtonElement>(doc, '#title-button');

  const renderer: ArenaRenderer = createArenaRenderer(canvas);

  let screen: ScreenState = 'title';
  let run: Run = createRun(TITLE_SEED);
  let titleStage: StageState = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
  let accumulator = 0;
  let lastFrameTime = 0;
  let running = false;
  let introTicks = 0;

  const input = createInput(win, {
    onPauseToggle: () => {
      if (screen === 'playing') {
        pauseGame();
      } else if (screen === 'paused') {
        resumeGame();
      }
    },
  });

  function displayStage(): StageState {
    return screen === 'title' ? titleStage : run.getState().stageState;
  }

  function updateHud(): void {
    const state = run.getState();
    const stage = state.stageState;
    setText(hudStage, String(state.stage));
    setText(hudLives, String(Math.max(0, state.lives)));
    setText(hudScore, String(state.score).padStart(6, '0'));
    setText(hudBombs, `${stage.activeBombs}/${stage.bombCapacity}`);
    setText(hudBlast, String(stage.blastRange));
    setText(hudSpeed, String(stage.speedTier));
    setText(hudShield, String(stage.shieldCharges));
    setText(hudRivals, String(stage.rivals.filter((rival) => rival.alive).length));
  }

  function startRun(): void {
    run = createRun(Date.now() >>> 0);
    titleStage = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
    screen = 'playing';
    titleScreen.hidden = true;
    pauseScreen.hidden = true;
    intermissionScreen.hidden = true;
    gameoverScreen.hidden = true;
    hud.hidden = false;
    input.setGameplayEnabled(true);
    accumulator = 0;
    lastFrameTime = win.performance.now();
    beginStageIntro();
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function beginStageIntro(): void {
    const state = run.getState();
    const rivals = state.stageState.rivals.length;
    setText(stageIntroStage, String(state.stage));
    setText(
      stageIntroRivals,
      rivals === 0
        ? 'Clear the arena'
        : `${rivals} rival${rivals === 1 ? '' : 's'} · clear them all`,
    );
    stageIntro.hidden = false;
    introTicks = STAGE_INTRO_TICKS;
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

  function showIntermission(state: RunState): void {
    screen = 'intermission';
    input.setGameplayEnabled(false);
    accumulator = 0;
    gameoverScreen.hidden = true;
    pauseScreen.hidden = true;
    stageIntro.hidden = true;
    intermissionScreen.hidden = false;
    hud.hidden = false;

    const clear = state.lastClear;
    setText(
      intermissionSummary,
      clear === null
        ? `Score ${state.score} · Lives ${state.lives}`
        : `Stage ${clear.stage} cleared · +${clear.bonusPoints} points · Score ${state.score} · Lives ${state.lives}`,
    );
    renderUpgradeCards(state);
  }

  function renderUpgradeCards(state: RunState): void {
    upgradeCards.replaceChildren();

    for (const [index, id] of state.draft.entries()) {
      const definition = UPGRADE_DEFINITIONS[id];
      const card = doc.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.dataset['upgrade'] = id;
      card.setAttribute('aria-label', `${index + 1}. ${definition.name}: ${definition.effect}`);

      const key = doc.createElement('span');
      key.className = 'upgrade-key';
      key.textContent = String(index + 1);

      const name = doc.createElement('span');
      name.className = 'upgrade-name';
      name.textContent = definition.name;

      const effect = doc.createElement('span');
      effect.className = 'upgrade-effect';
      effect.textContent = definition.effect;

      const detail = doc.createElement('span');
      detail.className = 'upgrade-detail';
      detail.textContent = definition.detail;

      const stacks = doc.createElement('span');
      stacks.className = 'upgrade-stacks';
      stacks.textContent = stackLabel(id, state);

      card.append(key, name, effect, detail, stacks);
      card.addEventListener('click', () => chooseUpgrade(id));
      upgradeCards.append(card);
    }

    upgradeCards.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function stackLabel(id: UpgradeId, state: RunState): string {
    const counts = state.upgrades;
    switch (id) {
      case 'bomb':
        return `Capacity ${1 + counts.bomb} → ${Math.min(8, 2 + counts.bomb)} / 8`;
      case 'fire':
        return `Range ${1 + counts.fire} → ${Math.min(8, 2 + counts.fire)} / 8`;
      case 'speed':
        return `Tier ${counts.speed} → ${Math.min(5, counts.speed + 1)} / 5`;
      case 'shield':
        return `Charges ${state.shieldCharges} → ${Math.min(2, state.shieldCharges + 1)} / 2`;
      case 'life':
        return `Lives ${state.lives} → ${Math.min(5, state.lives + 1)} / 5`;
      case 'multiplier':
        return `${(1 + counts.multiplier * 0.1).toFixed(1)}x → ${Math.min(1.5, 1 + (counts.multiplier + 1) * 0.1).toFixed(1)}x`;
      case 'fuse':
        return `Fuse ${(2.2 * (1 - counts.fuse * 0.08)).toFixed(1)}s → ${Math.max(1.4, 2.2 * (1 - (counts.fuse + 1) * 0.08)).toFixed(1)}s`;
      case 'cache':
        return 'Repeatable';
    }
  }

  function chooseUpgrade(id: UpgradeId): void {
    if (screen !== 'intermission' || !run.chooseUpgrade(id)) {
      return;
    }
    intermissionScreen.hidden = true;
    screen = 'playing';
    input.setGameplayEnabled(true);
    accumulator = 0;
    lastFrameTime = win.performance.now();
    beginStageIntro();
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function showGameOver(state: RunState): void {
    screen = 'gameover';
    gameoverScreen.hidden = false;
    intermissionScreen.hidden = true;
    pauseScreen.hidden = true;
    stageIntro.hidden = true;
    hud.hidden = false;
    setText(gameoverScore, String(state.score).padStart(6, '0'));
    setText(gameoverStage, String(state.stage));
    setText(gameoverBricks, String(state.stats.bricksDestroyed));
    setText(gameoverRivals, String(state.stats.rivalsDefeated));
    setText(gameoverPickups, String(state.stats.powerUpsCollected));
    setText(gameoverTime, formatTime(state.stats.elapsedTicks));
    input.setGameplayEnabled(false);
    accumulator = 0;
    retryButton.focus();
  }

  function quitToTitle(): void {
    if (screen === 'playing' || screen === 'paused' || screen === 'intermission') {
      run.quit();
    }
    titleStage = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
    screen = 'title';
    pauseScreen.hidden = true;
    intermissionScreen.hidden = true;
    gameoverScreen.hidden = true;
    stageIntro.hidden = true;
    hud.hidden = true;
    titleScreen.hidden = false;
    input.setGameplayEnabled(false);
    accumulator = 0;
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

    let frameEvents: readonly StageEvent[] = [];

    if (screen === 'playing') {
      if (introTicks > 0) {
        introTicks -= 1;
        if (introTicks === 0) {
          stageIntro.hidden = true;
        }
      } else {
        const plan = planFixedSteps(accumulator, elapsed);
        accumulator = plan.accumulator;
        let bomb = plan.steps > 0 ? input.consumeBomb() : false;
        const events: StageEvent[] = [];

        for (let step = 0; step < plan.steps; step += 1) {
          events.push(...run.step({ direction: input.direction, bomb }));
          bomb = false;
          if (run.getState().status !== 'playing') {
            break;
          }
        }

        if (plan.steps > 0) {
          updateHud();
        }

        const state = run.getState();
        if (state.status === 'intermission') {
          showIntermission(state);
        } else if (state.status === 'gameover') {
          showGameOver(state);
        }
        frameEvents = events;
      }
    } else {
      accumulator = 0;
    }

    renderer.render(displayStage(), frameEvents);
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
    const currentIndex = focusable.indexOf(doc.activeElement as HTMLButtonElement);
    const delta = event.shiftKey ? -1 : 1;
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + delta + focusable.length) % focusable.length;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  function onIntermissionKeyDown(event: KeyboardEvent): void {
    if (screen !== 'intermission') {
      return;
    }

    const cards = Array.from(upgradeCards.querySelectorAll<HTMLButtonElement>('button'));
    if (cards.length === 0) {
      return;
    }

    if (event.key >= '1' && event.key <= '3') {
      const card = cards[Number(event.key) - 1];
      const id = card?.dataset['upgrade'] as UpgradeId | undefined;
      if (id !== undefined) {
        event.preventDefault();
        chooseUpgrade(id);
      }
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const current = Math.max(0, cards.indexOf(doc.activeElement as HTMLButtonElement));
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = (current + delta + cards.length) % cards.length;
      event.preventDefault();
      cards[next]?.focus();
    }
  }

  playButton.addEventListener('click', startRun);
  resumeButton.addEventListener('click', resumeGame);
  quitButton.addEventListener('click', quitToTitle);
  retryButton.addEventListener('click', startRun);
  titleButton.addEventListener('click', quitToTitle);
  pauseScreen.addEventListener('keydown', onPauseScreenKeyDown);
  doc.addEventListener('keydown', onIntermissionKeyDown);
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

function formatTime(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
