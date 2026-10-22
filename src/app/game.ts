import { createAudio } from '../audio/audio';
import {
  createRun,
  createStage,
  INITIAL_TECHNIQUES,
  isTechniqueId,
  ownedTechniqueIds,
  type Run,
  type RunState,
  type StageEvent,
  type StageState,
  type StatUpgradeId,
  TECHNIQUE_DEFINITIONS,
  type TechniqueCounts,
  type TechniqueId,
  UPGRADE_DEFINITIONS,
  type UpgradeId,
} from '../game';
import { type ArenaRenderer, createArenaRenderer } from '../render/renderer';
import { computeCanvasFit } from './fit';
import { createInput } from './input';
import { planFixedSteps } from './loop';
import {
  loadProfile,
  recordRun,
  type Settings,
  type StorageLike,
  saveProfile,
  updateSettings,
} from './profile';

type ScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'intermission'
  | 'gameover'
  | 'howto'
  | 'settings';

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
  const hudTechniques = requireElement<HTMLElement>(doc, '#hud-techniques');
  const hudTechniqueList = requireElement<HTMLElement>(doc, '#hud-technique-list');
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
  const titleBest = requireElement<HTMLElement>(doc, '#title-best');
  const howToScreen = requireElement<HTMLElement>(doc, '#howto-screen');
  const howToButton = requireElement<HTMLButtonElement>(doc, '#how-to-button');
  const howToBackButton = requireElement<HTMLButtonElement>(doc, '#howto-back-button');
  const settingsScreen = requireElement<HTMLElement>(doc, '#settings-screen');
  const settingsButton = requireElement<HTMLButtonElement>(doc, '#settings-button');
  const pauseSettingsButton = requireElement<HTMLButtonElement>(doc, '#pause-settings-button');
  const settingsBackButton = requireElement<HTMLButtonElement>(doc, '#settings-back-button');
  const settingSound = requireElement<HTMLInputElement>(doc, '#setting-sound');
  const settingMusic = requireElement<HTMLInputElement>(doc, '#setting-music');
  const settingShake = requireElement<HTMLInputElement>(doc, '#setting-shake');
  const settingReducedMotion = requireElement<HTMLInputElement>(doc, '#setting-reduced-motion');
  const settingHighContrast = requireElement<HTMLInputElement>(doc, '#setting-high-contrast');
  const gameoverNewBest = requireElement<HTMLElement>(doc, '#gameover-newbest');
  const playButton = requireElement<HTMLButtonElement>(doc, '#play-button');
  const resumeButton = requireElement<HTMLButtonElement>(doc, '#resume-button');
  const quitButton = requireElement<HTMLButtonElement>(doc, '#quit-button');
  const retryButton = requireElement<HTMLButtonElement>(doc, '#retry-button');
  const titleButton = requireElement<HTMLButtonElement>(doc, '#title-button');

  const renderer: ArenaRenderer = createArenaRenderer(canvas);
  const audio = createAudio(win);

  const storage = safeStorage(win);
  let profile = loadProfile(storage);
  let screen: ScreenState = 'title';
  let run: Run = createRun(TITLE_SEED);
  let titleStage: StageState = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
  let accumulator = 0;
  let lastFrameTime = 0;
  let running = false;
  let introTicks = 0;
  let runRecorded = false;
  let settingsReturn: 'title' | 'paused' = 'title';
  let quitArmed = false;
  let quitTimer: number | null = null;

  applySettings();
  syncSettingsInputs();
  renderTitleBest();

  const input = createInput(win, {
    onPauseToggle: () => {
      if (screen === 'playing') {
        pauseGame();
      } else if (screen === 'paused') {
        resumeGame();
      } else if (screen === 'settings') {
        closeSettings();
      } else if (screen === 'howto') {
        closeHowTo();
      }
    },
  });

  function displayStage(): StageState {
    return screen === 'title' || screen === 'howto' || screen === 'settings'
      ? titleStage
      : run.getState().stageState;
  }

  function applySettings(): void {
    doc.documentElement.dataset['reducedMotion'] = String(profile.settings.reducedMotion);
    doc.documentElement.dataset['highContrast'] = String(profile.settings.highContrast);
    audio.setSettings(profile.settings);
    renderer.setPreferences(profile.settings);
  }

  function syncSettingsInputs(): void {
    settingSound.checked = profile.settings.sound;
    settingMusic.checked = profile.settings.music;
    settingShake.checked = profile.settings.screenShake;
    settingReducedMotion.checked = profile.settings.reducedMotion;
    settingHighContrast.checked = profile.settings.highContrast;
  }

  function renderTitleBest(): void {
    setText(
      titleBest,
      `BEST ${String(profile.highScore).padStart(6, '0')} · STAGE ${profile.bestStage}`,
    );
  }

  function saveSettings(patch: Partial<Settings>): void {
    profile = updateSettings(profile, patch);
    saveProfile(storage, profile);
    applySettings();
  }

  function recordFinishedRun(state: RunState): boolean {
    if (runRecorded) {
      return false;
    }
    runRecorded = true;
    const previousBest = profile.highScore;
    profile = recordRun(profile, { score: state.score, stage: state.stage });
    saveProfile(storage, profile);
    renderTitleBest();
    return state.score > previousBest;
  }

  function openHowTo(): void {
    if (screen !== 'title') {
      return;
    }
    screen = 'howto';
    titleScreen.hidden = true;
    howToScreen.hidden = false;
    howToBackButton.focus({ preventScroll: true });
  }

  function closeHowTo(): void {
    if (screen !== 'howto') {
      return;
    }
    screen = 'title';
    howToScreen.hidden = true;
    titleScreen.hidden = false;
    howToButton.focus();
  }

  function openSettings(returnTo: 'title' | 'paused'): void {
    if (returnTo === 'paused' && screen !== 'paused') {
      return;
    }
    settingsReturn = returnTo;
    if (returnTo === 'title') {
      titleScreen.hidden = true;
    } else {
      pauseScreen.hidden = true;
    }
    screen = 'settings';
    syncSettingsInputs();
    settingsScreen.hidden = false;
    settingsBackButton.focus();
  }

  function closeSettings(): void {
    if (screen !== 'settings') {
      return;
    }
    settingsScreen.hidden = true;
    if (settingsReturn === 'paused') {
      screen = 'paused';
      pauseScreen.hidden = false;
      pauseSettingsButton.focus();
    } else {
      screen = 'title';
      titleScreen.hidden = false;
      settingsButton.focus();
    }
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
    renderTechniqueStrip(stage.techniques);
  }

  function renderTechniqueStrip(techniques: TechniqueCounts): void {
    const owned = ownedTechniqueIds(techniques);
    const signature = owned.join(',');
    if (hudTechniques.dataset['signature'] === signature) {
      return;
    }

    hudTechniques.dataset['signature'] = signature;
    hudTechniques.hidden = owned.length === 0;
    hudTechniqueList.replaceChildren();

    for (const id of owned) {
      const definition = TECHNIQUE_DEFINITIONS[id];
      const chip = doc.createElement('li');
      chip.className = 'hud-technique';
      chip.dataset['technique'] = id;

      const name = doc.createElement('span');
      name.className = 'hud-technique-name';
      name.textContent = definition.chip;
      chip.append(name);

      if (definition.key !== null) {
        const key = doc.createElement('kbd');
        key.className = 'hud-technique-key';
        key.textContent = definition.key;
        chip.append(key);
      }

      hudTechniqueList.append(chip);
    }
  }

  function startRun(): void {
    beginRun(createRun(Date.now() >>> 0));
  }

  function beginRun(nextRun: Run): void {
    run = nextRun;
    titleStage = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
    runRecorded = false;
    gameoverNewBest.hidden = true;
    screen = 'playing';
    titleScreen.hidden = true;
    pauseScreen.hidden = true;
    howToScreen.hidden = true;
    settingsScreen.hidden = true;
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
    resetQuitConfirmation();
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
    resetQuitConfirmation();
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
        : `Stage ${clear.stage} cleared · Base ${clear.basePoints} + Time ${clear.timePoints} = +${clear.bonusPoints} · Score ${state.score} · Lives ${state.lives}`,
    );
    renderUpgradeCards(state);
  }

  function renderUpgradeCards(state: RunState): void {
    upgradeCards.replaceChildren();

    for (const [index, id] of state.draft.entries()) {
      const technique = isTechniqueId(id);
      const definition = technique ? TECHNIQUE_DEFINITIONS[id] : UPGRADE_DEFINITIONS[id];
      const card = doc.createElement('button');
      card.type = 'button';
      card.className = technique ? 'upgrade-card upgrade-card-technique' : 'upgrade-card';
      card.dataset['upgrade'] = id;
      if (technique) {
        card.dataset['kind'] = 'technique';
      }
      card.setAttribute(
        'aria-label',
        technique
          ? `${index + 1}. Technique: ${definition.name}. ${definition.effect}. Equip.`
          : `${index + 1}. ${definition.name}: ${definition.effect}`,
      );

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
      stacks.textContent = technique ? 'Equip' : stackLabel(id, state);

      card.append(key, name, effect, detail, stacks);

      if (technique) {
        const kind = doc.createElement('span');
        kind.className = 'upgrade-kind';
        kind.textContent = 'Technique';
        card.append(kind);
      }

      card.addEventListener('click', () => chooseUpgrade(id));
      upgradeCards.append(card);
    }

    upgradeCards.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function stackLabel(id: StatUpgradeId, state: RunState): string {
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
    const isRealGameOver = state.stageState.status === 'gameover';
    const newBest = isRealGameOver ? recordFinishedRun(state) : false;
    gameoverNewBest.hidden = !newBest;
    input.setGameplayEnabled(false);
    accumulator = 0;
    retryButton.focus();
  }

  function quitToTitle(): void {
    if (screen === 'playing' || screen === 'paused' || screen === 'intermission') {
      run.quit();
      recordFinishedRun(run.getState());
    }
    quitArmed = false;
    quitButton.textContent = 'Quit Run';
    titleStage = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
    screen = 'title';
    pauseScreen.hidden = true;
    howToScreen.hidden = true;
    settingsScreen.hidden = true;
    intermissionScreen.hidden = true;
    gameoverScreen.hidden = true;
    stageIntro.hidden = true;
    hud.hidden = true;
    titleScreen.hidden = false;
    input.setGameplayEnabled(false);
    accumulator = 0;
    renderTitleBest();
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
        let detonate = plan.steps > 0 ? input.consumeDetonate() : false;
        const events: StageEvent[] = [];

        for (let step = 0; step < plan.steps; step += 1) {
          events.push(...run.step({ direction: input.direction, bomb, detonate }));
          bomb = false;
          detonate = false;
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

    if (frameEvents.length > 0) {
      audio.playEvents(frameEvents);
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

    const focusable = [resumeButton, pauseSettingsButton, quitButton];
    const currentIndex = focusable.indexOf(doc.activeElement as HTMLButtonElement);
    const delta = event.shiftKey ? -1 : 1;
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + delta + focusable.length) % focusable.length;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  function trapDialogFocus(event: KeyboardEvent, container: HTMLElement): void {
    if (event.key !== 'Tab' || container.hidden) {
      return;
    }
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
      return;
    }
    const currentIndex = focusable.indexOf(doc.activeElement as HTMLElement);
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

  function resetQuitConfirmation(): void {
    quitArmed = false;
    quitButton.textContent = 'Quit Run';
    if (quitTimer !== null) {
      win.clearTimeout(quitTimer);
      quitTimer = null;
    }
  }

  function onQuitClick(): void {
    if (screen !== 'paused') {
      return;
    }
    if (!quitArmed) {
      quitArmed = true;
      quitButton.textContent = 'Confirm Quit';
      quitTimer = win.setTimeout(resetQuitConfirmation, 2500);
      return;
    }
    resetQuitConfirmation();
    quitToTitle();
  }

  function onSettingChange(): void {
    saveSettings({
      sound: settingSound.checked,
      music: settingMusic.checked,
      screenShake: settingShake.checked,
      reducedMotion: settingReducedMotion.checked,
      highContrast: settingHighContrast.checked,
    });
  }

  function onGlobalKeyDown(event: KeyboardEvent): void {
    if (
      event.key.toLowerCase() === 'm' &&
      !event.ctrlKey &&
      !event.metaKey &&
      (screen === 'playing' || screen === 'paused')
    ) {
      const muted = !(profile.settings.sound || profile.settings.music);
      saveSettings({ sound: !muted, music: !muted });
      syncSettingsInputs();
      return;
    }
    if (event.key === 'Escape' && screen === 'howto') {
      event.preventDefault();
      closeHowTo();
      return;
    }
    if (event.key === 'Escape' && screen === 'settings') {
      event.preventDefault();
      closeSettings();
      return;
    }
    onIntermissionKeyDown(event);
  }

  playButton.addEventListener('click', startRun);
  resumeButton.addEventListener('click', resumeGame);
  quitButton.addEventListener('click', onQuitClick);
  retryButton.addEventListener('click', startRun);
  titleButton.addEventListener('click', quitToTitle);
  howToButton.addEventListener('click', openHowTo);
  howToBackButton.addEventListener('click', closeHowTo);
  settingsButton.addEventListener('click', () => openSettings('title'));
  pauseSettingsButton.addEventListener('click', () => openSettings('paused'));
  settingsBackButton.addEventListener('click', closeSettings);
  settingSound.addEventListener('change', onSettingChange);
  settingMusic.addEventListener('change', onSettingChange);
  settingShake.addEventListener('change', onSettingChange);
  settingReducedMotion.addEventListener('change', onSettingChange);
  settingHighContrast.addEventListener('change', onSettingChange);
  pauseScreen.addEventListener('keydown', onPauseScreenKeyDown);
  gameoverScreen.addEventListener('keydown', (event) => trapDialogFocus(event, gameoverScreen));
  intermissionScreen.addEventListener('keydown', (event) =>
    trapDialogFocus(event, intermissionScreen),
  );
  howToScreen.addEventListener('keydown', (event) => trapDialogFocus(event, howToScreen));
  settingsScreen.addEventListener('keydown', (event) => trapDialogFocus(event, settingsScreen));
  doc.addEventListener('keydown', onGlobalKeyDown);
  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button') !== null) {
      audio.click();
    }
  });
  win.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  win.addEventListener('keydown', () => audio.unlock(), { once: true });
  doc.addEventListener('visibilitychange', onVisibilityChange);
  win.addEventListener('resize', fitCanvas);

  // Dev-only presentation harness for verifying the non-gameplay screens in a
  // real browser. It renders the production DOM through the real screen
  // functions but never changes simulation state.
  if (import.meta.env.DEV) {
    const debugWindow = win as Window & {
      __bombBlitzDebug?: {
        showIntermission(draft?: readonly UpgradeId[]): void;
        showGameOver(): void;
        forceRunOver(): void;
        startTechniqueRun(technique?: TechniqueId): void;
        startKickRun(): void;
        startPierceRun(): void;
        startDraftRun(): void;
        state(): unknown;
      };
    };
    debugWindow.__bombBlitzDebug = {
      showIntermission(draft: readonly UpgradeId[] = ['remote', 'bomb', 'fire']): void {
        const state = run.getState();
        showIntermission({
          ...state,
          status: 'intermission',
          lives: 2,
          score: 3450,
          draft: [...draft],
          lastClear: {
            stage: 1,
            basePoints: 1000,
            timePoints: 1400,
            bonusPoints: 2400,
            elapsedTicks: 300,
          },
        });
      },
      forceRunOver(): void {
        if (run.getState().status !== 'gameover') {
          run.quit();
          recordFinishedRun(run.getState());
        }
        showGameOver(run.getState());
      },
      startTechniqueRun(technique: TechniqueId = 'remote'): void {
        beginRun(
          createRun(TITLE_SEED, {
            initialTechniques: { ...INITIAL_TECHNIQUES, [technique]: 1 },
          }),
        );
      },
      startKickRun(): void {
        // A quiet two-row room makes the slide path and follow-up readable.
        beginRun(
          createRun(TITLE_SEED, {
            initialTechniques: { ...INITIAL_TECHNIQUES, kick: 1 },
            firstStage: {
              arena: ['##############', '#P...........#', '#............#', '##############'],
              rivalCount: 0,
              fuseMs: 10000,
            },
          }),
        );
      },
      startPierceRun(): void {
        // Three bricks in one ray, with a long fuse so the player can clear
        // the lane and watch the whole line break.
        beginRun(
          createRun(TITLE_SEED, {
            initialTechniques: { ...INITIAL_TECHNIQUES, pierce: 1 },
            firstStage: {
              arena: [
                '#########',
                '#B......#',
                '#B......#',
                '#B......#',
                '#.......#',
                '#P......#',
                '#########',
              ],
              rivalCount: 0,
              blastRange: 4,
              fuseMs: 2500,
            },
          }),
        );
      },
      startDraftRun(): void {
        // A rival sealed in a one-tile pocket dies to the player's first
        // bomb, so a real intermission (and its keyboard path) is reachable
        // without replaying a full stage.
        beginRun(
          createRun(TITLE_SEED, {
            firstStage: {
              arena: [
                '#########',
                '#.......#',
                '#......##',
                '#.....PR#',
                '#......##',
                '#.......#',
                '#########',
              ],
              rivalCount: 1,
              rivalSpawns: [{ x: 7, y: 3 }],
              blastRange: 1,
              fuseMs: 900,
            },
          }),
        );
      },
      state(): unknown {
        const state = run.getState();
        return {
          status: state.status,
          stage: state.stage,
          lives: state.lives,
          score: state.score,
          techniques: state.stageState.techniques,
          tick: state.stageState.tick,
          arena: state.stageState.arena,
          player: state.stageState.player,
          bombs: state.stageState.bombs.map((bomb) => ({
            id: bomb.id,
            tile: bomb.tile,
            owner: bomb.owner,
            remote: bomb.remote,
            piercing: bomb.piercing,
            fuseRemainingTicks: bomb.fuseRemainingTicks,
            from: bomb.from,
            to: bomb.to,
            progress: bomb.progress,
            moving: bomb.moving,
            position: bomb.position,
          })),
          blasts: state.stageState.blasts.map((blast) => ({
            tile: blast.tile,
            piercing: blast.piercing,
          })),
          rivals: state.stageState.rivals.map((rival) => ({
            id: rival.id,
            alive: rival.alive,
            tile: rival.tile,
          })),
        };
      },
      showGameOver(): void {
        const state = run.getState();
        showGameOver({
          ...state,
          status: 'gameover',
          lives: 0,
          score: 12345,
          stage: 4,
          stats: {
            bricksDestroyed: 42,
            rivalsDefeated: 9,
            powerUpsCollected: 7,
            elapsedTicks: 5432,
          },
        });
      },
    };
  }

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

function safeStorage(win: Window): StorageLike | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
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
