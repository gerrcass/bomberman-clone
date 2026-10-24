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
import { dailyDateFromKey, dailyDateKey, dailySeed } from './daily';
import { computeCanvasFit } from './fit';
import { createInput } from './input';
import { planFixedSteps } from './loop';
import {
  isNewBest,
  isNewDailyBest,
  loadProfile,
  type RunRecord,
  type RunRecordInput,
  recordRun,
  type Settings,
  type StorageLike,
  saveProfile,
  updateSettings,
} from './profile';
import {
  buildShareLink,
  formatSeed,
  parseSeedCode,
  parseShareLinkSeed,
  removeSeedParam,
} from './seed';
import { gameOverModeLabel, type RunSession, retrySeed, stageIntroModeLabel } from './session';

type ScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'intermission'
  | 'gameover'
  | 'howto'
  | 'settings'
  | 'records'
  | 'seed';

const TITLE_SEED = 7;
const STAGE_INTRO_TICKS = 90;
const SEED_INPUT_ERROR = 'Enter a valid Seed Code: 1–7 letters or numbers within the 32-bit range.';

export interface GameApp {
  start(): void;
}

interface RunRecordOutcome {
  readonly newBest: boolean;
  readonly newDailyBest: boolean;
}

const NO_RUN_OUTCOME: RunRecordOutcome = { newBest: false, newDailyBest: false };

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
  const stageIntroMode = requireElement<HTMLElement>(doc, '#stage-intro-mode');
  const stageIntroStage = requireElement<HTMLElement>(doc, '#stage-intro-stage');
  const stageIntroRivals = requireElement<HTMLElement>(doc, '#stage-intro-rivals');
  const gameoverScreen = requireElement<HTMLElement>(doc, '#gameover-screen');
  const gameoverMode = requireElement<HTMLElement>(doc, '#gameover-mode');
  const gameoverSeed = requireElement<HTMLElement>(doc, '#gameover-seed');
  const gameoverScore = requireElement<HTMLElement>(doc, '#gameover-score');
  const gameoverStage = requireElement<HTMLElement>(doc, '#gameover-stage');
  const gameoverBricks = requireElement<HTMLElement>(doc, '#gameover-bricks');
  const gameoverRivals = requireElement<HTMLElement>(doc, '#gameover-rivals');
  const gameoverPickups = requireElement<HTMLElement>(doc, '#gameover-pickups');
  const gameoverTime = requireElement<HTMLElement>(doc, '#gameover-time');
  const gameoverDaily = requireElement<HTMLElement>(doc, '#gameover-daily');
  const gameoverDailyDate = requireElement<HTMLElement>(doc, '#gameover-daily-date');
  const gameoverDailyBest = requireElement<HTMLElement>(doc, '#gameover-daily-best');
  const gameoverNewDailyBest = requireElement<HTMLElement>(doc, '#gameover-new-daily-best');
  const gameoverCopyLinkButton = requireElement<HTMLButtonElement>(doc, '#copy-seed-link-button');
  const gameoverCopyStatus = requireElement<HTMLElement>(doc, '#gameover-copy-status');
  const gameoverShareLink = requireElement<HTMLInputElement>(doc, '#gameover-share-link');
  const titleBest = requireElement<HTMLElement>(doc, '#title-best');
  const titleDailyBest = requireElement<HTMLElement>(doc, '#title-daily-best');
  const titleLastRun = requireElement<HTMLElement>(doc, '#title-last-run');
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
  const recordsScreen = requireElement<HTMLElement>(doc, '#records-screen');
  const recordsButton = requireElement<HTMLButtonElement>(doc, '#records-button');
  const gameoverRecordsButton = requireElement<HTMLButtonElement>(doc, '#gameover-records-button');
  const recordsBackButton = requireElement<HTMLButtonElement>(doc, '#records-back-button');
  const recordsBestScore = requireElement<HTMLElement>(doc, '#records-best-score');
  const recordsBestStage = requireElement<HTMLElement>(doc, '#records-best-stage');
  const recordsDailyLabel = requireElement<HTMLElement>(doc, '#records-daily-label');
  const recordsDailyBest = requireElement<HTMLElement>(doc, '#records-daily-best');
  const recordsScroll = requireElement<HTMLElement>(doc, '#records-scroll');
  // The scroll region is a deliberate tab stop so keyboard users can scroll a
  // long Run History without pointing at it. Biome's static HTML rule rejects a
  // literal tabindex on a non-interactive element, so set it here instead.
  recordsScroll.tabIndex = 0;
  const recordsList = requireElement<HTMLOListElement>(doc, '#records-list');
  const recordsEmpty = requireElement<HTMLElement>(doc, '#records-empty');
  const gameoverNewBest = requireElement<HTMLElement>(doc, '#gameover-newbest');
  const seedScreen = requireElement<HTMLElement>(doc, '#seed-screen');
  const seedForm = requireElement<HTMLFormElement>(doc, '#seed-form');
  const seedInput = requireElement<HTMLInputElement>(doc, '#seed-input');
  const seedStartButton = requireElement<HTMLButtonElement>(doc, '#seed-start-button');
  const seedError = requireElement<HTMLElement>(doc, '#seed-error');
  const seedBackButton = requireElement<HTMLButtonElement>(doc, '#seed-back-button');
  const playButton = requireElement<HTMLButtonElement>(doc, '#play-button');
  const dailyRunButton = requireElement<HTMLButtonElement>(doc, '#daily-run-button');
  const seedRunButton = requireElement<HTMLButtonElement>(doc, '#seed-run-button');
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
  let runSession: RunSession = { mode: 'endless' };
  let titleDateKey = dailyDateKey(new Date());
  let titleStage: StageState = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
  let accumulator = 0;
  let lastFrameTime = 0;
  let running = false;
  let introTicks = 0;
  let titleCheckTicks = 0;
  let runRecorded = false;
  let settingsReturn: 'title' | 'paused' = 'title';
  let recordsReturn: 'title' | 'gameover' = 'title';
  let quitArmed = false;
  let quitTimer: number | null = null;

  applySettings();
  syncSettingsInputs();
  renderTitleProfile();

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
      } else if (screen === 'records') {
        closeRecords();
      } else if (screen === 'seed') {
        closeSeedRun();
      }
    },
  });

  function displayStage(): StageState {
    if (screen === 'records') {
      return recordsReturn === 'title' ? titleStage : run.getState().stageState;
    }
    return screen === 'title' || screen === 'howto' || screen === 'settings' || screen === 'seed'
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

  function renderTitleProfile(): void {
    setText(
      titleBest,
      `BEST ${String(profile.highScore).padStart(6, '0')} · STAGE ${profile.bestStage}`,
    );
    const today = dailyDateKey(new Date());
    titleDateKey = today;
    const daily = profile.dailyBest;
    setText(
      titleDailyBest,
      daily !== null && daily.date === today
        ? `DAILY ${today} · BEST ${String(daily.score).padStart(6, '0')}`
        : `DAILY ${today} · NO RUN YET`,
    );
    const last = profile.history[0];
    setText(
      titleLastRun,
      last === undefined
        ? 'LAST RUN — none yet'
        : `LAST RUN ${String(last.score).padStart(6, '0')} · STAGE ${last.stage}`,
    );
  }

  function saveSettings(patch: Partial<Settings>): void {
    profile = updateSettings(profile, patch);
    saveProfile(storage, profile);
    applySettings();
  }

  function recordFinishedRun(state: RunState): RunRecordOutcome {
    if (runRecorded) {
      return NO_RUN_OUTCOME;
    }
    runRecorded = true;
    const dailyDate = runSession.mode === 'daily' ? runSession.dailyDate : null;
    const newBest = isNewBest(profile, state.score);
    const newDailyBest = isNewDailyBest(profile, dailyDate, state.score);
    const base = {
      score: state.score,
      stage: state.stage,
      bricksDestroyed: state.stats.bricksDestroyed,
      rivalsDefeated: state.stats.rivalsDefeated,
      powerUpsCollected: state.stats.powerUpsCollected,
      elapsedTicks: state.stats.elapsedTicks,
      techniques: ownedTechniqueIds(state.techniques),
      seed: state.seed,
    };
    let input: RunRecordInput;
    if (runSession.mode === 'daily') {
      input = { ...base, mode: 'daily', dailyDate: runSession.dailyDate };
    } else if (runSession.mode === 'seed') {
      input = { ...base, mode: 'seed', dailyDate: null };
    } else {
      input = { ...base, mode: 'endless', dailyDate: null };
    }
    profile = recordRun(profile, input, new Date());
    saveProfile(storage, profile);
    renderTitleProfile();
    return { newBest, newDailyBest };
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

  function openRecords(returnTo: 'title' | 'gameover'): void {
    if (screen !== returnTo) {
      return;
    }
    recordsReturn = returnTo;
    screen = 'records';
    if (returnTo === 'title') {
      titleScreen.hidden = true;
    } else {
      gameoverScreen.hidden = true;
    }
    input.setGameplayEnabled(false);
    renderRecords();
    recordsScreen.hidden = false;
    recordsScroll.scrollTop = 0;
    recordsBackButton.focus({ preventScroll: true });
  }

  function closeRecords(): void {
    if (screen !== 'records') {
      return;
    }
    recordsScreen.hidden = true;
    if (recordsReturn === 'title') {
      screen = 'title';
      titleScreen.hidden = false;
      recordsButton.focus();
    } else {
      screen = 'gameover';
      gameoverScreen.hidden = false;
      gameoverRecordsButton.focus();
    }
  }

  function openSeedRun(prefill = '', focusStart = false): void {
    if (screen !== 'title') {
      return;
    }
    screen = 'seed';
    titleScreen.hidden = true;
    seedScreen.hidden = false;
    seedInput.value = prefill;
    clearSeedError();
    if (focusStart) {
      seedStartButton.focus({ preventScroll: true });
    } else {
      seedInput.focus({ preventScroll: true });
      if (prefill.length > 0) {
        seedInput.select();
      }
    }
  }

  function closeSeedRun(): void {
    if (screen !== 'seed') {
      return;
    }
    screen = 'title';
    seedScreen.hidden = true;
    titleScreen.hidden = false;
    clearSeedError();
    seedRunButton.focus();
  }

  function submitSeedRun(): void {
    if (screen !== 'seed') {
      return;
    }
    const seed = parseSeedCode(seedInput.value);
    if (seed === null) {
      showSeedError();
      seedInput.focus({ preventScroll: true });
      return;
    }
    clearSeedError();
    startSeedRun(seed);
  }

  function startSeedRun(seed: number): void {
    beginRun(createRun(seed), { mode: 'seed', seed });
  }

  function showSeedError(): void {
    seedInput.setAttribute('aria-invalid', 'true');
    // Replacing the text re-announces the alert when the same invalid code is
    // submitted twice.
    seedError.textContent = '';
    seedError.hidden = false;
    seedError.textContent = SEED_INPUT_ERROR;
  }

  function clearSeedError(): void {
    seedError.hidden = true;
    seedError.textContent = '';
    seedInput.removeAttribute('aria-invalid');
  }

  /**
   * Consumes a `?seed=` deep link after the title has loaded. A valid Seed
   * opens the Seed Run setup but never starts a run; the parameter is then
   * removed from the address bar so a refresh cannot replay it by surprise.
   */
  function consumeShareLink(): void {
    let href: string;
    try {
      href = win.location.href;
    } catch {
      return;
    }

    const seed = parseShareLinkSeed(href);
    if (seed !== null) {
      openSeedRun(formatSeed(seed), true);
    }

    const cleaned = removeSeedParam(href);
    if (cleaned === href) {
      return;
    }
    try {
      win.history.replaceState(null, '', cleaned);
    } catch {
      // A sandboxed frame or blocked History API must not stop the game.
    }
  }

  function renderRecords(): void {
    setText(recordsBestScore, String(profile.highScore).padStart(6, '0'));
    setText(recordsBestStage, String(profile.bestStage));

    const today = dailyDateKey(new Date());
    const daily = profile.dailyBest;
    if (daily !== null && daily.date === today) {
      setText(recordsDailyLabel, `Daily best · ${daily.date}`);
      setText(recordsDailyBest, String(daily.score).padStart(6, '0'));
    } else {
      setText(recordsDailyLabel, 'Daily best · today');
      setText(recordsDailyBest, '—');
    }

    const rows = profile.history.map(buildRecordRow);
    recordsList.replaceChildren(...rows);
    recordsList.hidden = rows.length === 0;
    recordsEmpty.hidden = rows.length > 0;
  }

  function buildRecordRow(record: RunRecord): HTMLElement {
    const row = doc.createElement('li');
    row.className = 'record-row';
    row.dataset['mode'] = record.mode;

    const head = doc.createElement('div');
    head.className = 'record-head';

    const badge = doc.createElement('span');
    badge.className = 'record-badge';
    badge.textContent =
      record.mode === 'daily' ? 'Daily' : record.mode === 'seed' ? 'Seed' : 'Endless';

    const date = doc.createElement('span');
    date.className = 'record-date';
    date.textContent = record.dailyDate ?? dailyDateKey(new Date(record.finishedAt));

    const score = doc.createElement('span');
    score.className = 'record-score';
    score.textContent = String(record.score).padStart(6, '0');

    head.append(badge, date, score);

    const stage = doc.createElement('p');
    stage.className = 'record-stage';
    stage.textContent = `Stage ${record.stage}`;

    const stats = doc.createElement('dl');
    stats.className = 'record-stats';
    const entries: ReadonlyArray<readonly [string, string]> = [
      ['Bricks', String(record.bricksDestroyed)],
      ['Rivals', String(record.rivalsDefeated)],
      ['Pickups', String(record.powerUpsCollected)],
      ['Time', formatTime(record.elapsedTicks)],
    ];
    for (const [label, value] of entries) {
      const stat = doc.createElement('div');
      const term = doc.createElement('dt');
      term.textContent = label;
      const detail = doc.createElement('dd');
      detail.textContent = value;
      stat.append(term, detail);
      stats.append(stat);
    }

    row.append(head, stage);

    if (record.seed !== null) {
      const seed = doc.createElement('p');
      seed.className = 'record-seed';
      seed.textContent = `Seed · ${formatSeed(record.seed)}`;
      row.append(seed);
    }

    row.append(stats);

    if (record.techniques.length > 0) {
      const chips = doc.createElement('ul');
      chips.className = 'record-techniques';
      for (const id of record.techniques) {
        const chip = doc.createElement('li');
        chip.className = 'record-chip';
        chip.dataset['technique'] = id;
        chip.textContent = TECHNIQUE_DEFINITIONS[id].chip;
        chips.append(chip);
      }
      row.append(chips);
    }

    return row;
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
    const seed = Date.now() >>> 0;
    beginRun(createRun(seed), { mode: 'endless' });
  }

  function startDailyRun(): void {
    const now = new Date();
    const dailyDate = dailyDateKey(now);
    const seed = dailySeed(now);
    beginRun(createRun(seed), { mode: 'daily', dailyDate, dailySeed: seed });
  }

  function retryRun(): void {
    // Seed and Daily Runs reuse their captured Seed; crossing midnight cannot
    // swap a Daily Run's challenge while the player is still on Game Over.
    const seed = retrySeed(runSession, () => Date.now() >>> 0);
    beginRun(createRun(seed), runSession);
  }

  function beginRun(nextRun: Run, session: RunSession): void {
    run = nextRun;
    runSession = session;
    titleStage = createStage({ seed: TITLE_SEED, rivalCount: 0 }).getState();
    runRecorded = false;
    gameoverNewBest.hidden = true;
    gameoverNewDailyBest.hidden = true;
    gameoverDaily.hidden = true;
    resetShareLinkUi();
    screen = 'playing';
    titleScreen.hidden = true;
    pauseScreen.hidden = true;
    howToScreen.hidden = true;
    settingsScreen.hidden = true;
    recordsScreen.hidden = true;
    seedScreen.hidden = true;
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
    const modeLabel = stageIntroModeLabel(runSession);
    if (modeLabel === null) {
      setText(stageIntroMode, '');
      stageIntroMode.hidden = true;
    } else {
      setText(stageIntroMode, modeLabel);
      stageIntroMode.hidden = false;
    }
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

  function resetShareLinkUi(): void {
    setText(gameoverCopyStatus, '');
    gameoverShareLink.value = '';
    gameoverShareLink.hidden = true;
  }

  function announceShareStatus(message: string): void {
    // Clearing first re-announces the live region when the same message repeats.
    gameoverCopyStatus.textContent = '';
    gameoverCopyStatus.textContent = message;
  }

  function showShareLinkCopied(): void {
    gameoverShareLink.value = '';
    gameoverShareLink.hidden = true;
    announceShareStatus('Share Link copied to the clipboard.');
  }

  function showShareLinkFallback(link: string): void {
    gameoverShareLink.value = link;
    gameoverShareLink.hidden = false;
    announceShareStatus('Clipboard unavailable. Select the Share Link and copy it manually.');
    gameoverShareLink.focus({ preventScroll: true });
    gameoverShareLink.select();
  }

  function copySeedLink(): void {
    let link: string;
    try {
      link = buildShareLink(win.location.href, run.getState().seed);
    } catch {
      announceShareStatus('Could not build a Share Link.');
      return;
    }

    const fallback = (): void => {
      if (screen === 'gameover') {
        showShareLinkFallback(link);
      }
    };

    let clipboard: Clipboard | undefined;
    try {
      clipboard = win.navigator.clipboard;
    } catch {
      clipboard = undefined;
    }
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
      fallback();
      return;
    }

    try {
      void clipboard.writeText(link).then(() => {
        if (screen === 'gameover') {
          showShareLinkCopied();
        }
      }, fallback);
    } catch {
      fallback();
    }
  }

  function showGameOver(state: RunState, recorded?: RunRecordOutcome): void {
    resetShareLinkUi();
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
    const outcome: RunRecordOutcome =
      recorded ?? (isRealGameOver ? recordFinishedRun(state) : NO_RUN_OUTCOME);
    const dailyKey = runSession.mode === 'daily' ? runSession.dailyDate : null;
    setText(gameoverMode, gameOverModeLabel(runSession));
    setText(gameoverSeed, `Seed · ${formatSeed(state.seed)}`);
    if (dailyKey !== null) {
      const daily = profile.dailyBest;
      setText(gameoverDailyDate, dailyKey);
      setText(
        gameoverDailyBest,
        daily !== null && daily.date === dailyKey ? String(daily.score).padStart(6, '0') : '—',
      );
      gameoverDaily.hidden = false;
    } else {
      setText(gameoverDailyDate, '');
      setText(gameoverDailyBest, '—');
      gameoverDaily.hidden = true;
    }
    gameoverNewBest.hidden = !outcome.newBest;
    gameoverNewDailyBest.hidden = !outcome.newDailyBest;
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
    recordsScreen.hidden = true;
    seedScreen.hidden = true;
    intermissionScreen.hidden = true;
    gameoverScreen.hidden = true;
    stageIntro.hidden = true;
    hud.hidden = true;
    titleScreen.hidden = false;
    input.setGameplayEnabled(false);
    accumulator = 0;
    renderTitleProfile();
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
      if (screen === 'title') {
        titleCheckTicks += 1;
        if (titleCheckTicks >= 60) {
          titleCheckTicks = 0;
          if (dailyDateKey(new Date()) !== titleDateKey) {
            renderTitleProfile();
          }
        }
      }
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
    ).filter(
      (element) => !element.hasAttribute('disabled') && element.closest('[hidden]') === null,
    );
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
    if (event.key === 'Escape' && screen === 'records') {
      event.preventDefault();
      closeRecords();
      return;
    }
    if (event.key === 'Escape' && screen === 'seed') {
      event.preventDefault();
      closeSeedRun();
      return;
    }
    onIntermissionKeyDown(event);
  }

  playButton.addEventListener('click', startRun);
  dailyRunButton.addEventListener('click', startDailyRun);
  seedRunButton.addEventListener('click', () => openSeedRun());
  resumeButton.addEventListener('click', resumeGame);
  quitButton.addEventListener('click', onQuitClick);
  retryButton.addEventListener('click', retryRun);
  titleButton.addEventListener('click', quitToTitle);
  howToButton.addEventListener('click', openHowTo);
  howToBackButton.addEventListener('click', closeHowTo);
  settingsButton.addEventListener('click', () => openSettings('title'));
  pauseSettingsButton.addEventListener('click', () => openSettings('paused'));
  settingsBackButton.addEventListener('click', closeSettings);
  recordsButton.addEventListener('click', () => openRecords('title'));
  gameoverCopyLinkButton.addEventListener('click', copySeedLink);
  gameoverRecordsButton.addEventListener('click', () => openRecords('gameover'));
  recordsBackButton.addEventListener('click', closeRecords);
  seedForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitSeedRun();
  });
  seedBackButton.addEventListener('click', closeSeedRun);
  seedInput.addEventListener('input', clearSeedError);
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
  recordsScreen.addEventListener('keydown', (event) => trapDialogFocus(event, recordsScreen));
  seedScreen.addEventListener('keydown', (event) => trapDialogFocus(event, seedScreen));
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
        startDailyRunOn(dateKey?: string): void;
        openSeedRun(code?: string): void;
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
        let recorded: RunRecordOutcome | undefined;
        if (run.getState().status !== 'gameover') {
          run.quit();
          recorded = recordFinishedRun(run.getState());
        }
        showGameOver(run.getState(), recorded);
      },
      startTechniqueRun(technique: TechniqueId = 'remote'): void {
        beginRun(
          createRun(TITLE_SEED, {
            initialTechniques: { ...INITIAL_TECHNIQUES, [technique]: 1 },
          }),
          { mode: 'endless' },
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
          { mode: 'endless' },
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
          { mode: 'endless' },
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
          { mode: 'endless' },
        );
      },
      startDailyRunOn(dateKey?: string): void {
        const key = dateKey ?? dailyDateKey(new Date());
        const date = dailyDateFromKey(key);
        if (date === null) {
          return;
        }
        const seed = dailySeed(date);
        beginRun(createRun(seed), { mode: 'daily', dailyDate: key, dailySeed: seed });
      },
      openSeedRun(code = ''): void {
        if (screen !== 'title') {
          quitToTitle();
        }
        openSeedRun(code);
      },
      state(): unknown {
        const state = run.getState();
        return {
          status: state.status,
          seed: state.seed,
          mode: runSession.mode,
          dailyDate: runSession.mode === 'daily' ? runSession.dailyDate : null,
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
      consumeShareLink();
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
