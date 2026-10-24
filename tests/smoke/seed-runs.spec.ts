import { expect, test } from '@playwright/test';

const devUrl = 'http://localhost:5174';

const settings = {
  sound: true,
  music: true,
  screenShake: true,
  reducedMotion: false,
  highContrast: false,
};

type DebugWindow = Window & {
  __bombBlitzDebug?: { showGameOver(): void };
  __copied?: string | null;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('starts a Seed Run and rejects an invalid Seed Code', async ({ page }) => {
  await page.locator('#seed-run-button').click();
  await expect(page.locator('#seed-screen')).toBeVisible();
  await expect(page.locator('#seed-input')).toBeFocused();

  await page.locator('#seed-start-button').click();
  await expect(page.locator('#seed-error')).toBeVisible();
  await expect(page.locator('#seed-input')).toBeFocused();
  await expect(page.locator('#seed-input')).toHaveAttribute('aria-invalid', 'true');

  await page.locator('#seed-input').fill(' 1z141z3 ');
  await page.locator('#seed-start-button').click();

  await expect(page.locator('#seed-screen')).toBeHidden();
  await expect(page.locator('#stage-intro-mode')).toHaveText('Seed Run · 1Z141Z3');
  await expect(page.locator('#hud')).toBeVisible();
});

test('opens a shared Seed Link without auto-starting and cleans the parameter', async ({
  page,
}) => {
  await page.goto('/?foo=bar&seed=1z141z3&x=1#frag');

  await expect(page.locator('#seed-screen')).toBeVisible();
  await expect(page.locator('#seed-input')).toHaveValue('1Z141Z3');
  await expect(page.locator('#seed-start-button')).toBeFocused();
  await expect(page.locator('#stage-intro')).toBeHidden();
  await expect(page).toHaveURL(/\/\?foo=bar&x=1#frag$/);
});

test('ignores an invalid shared Seed Link', async ({ page }) => {
  await page.goto('/?foo=bar&seed=ZZZZZZZ&x=1#frag');

  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#seed-screen')).toBeHidden();
  await expect(page).toHaveURL(/\/\?foo=bar&x=1#frag$/);
});

test('replays a Run Record as a Seed Run', async ({ page }) => {
  await page.evaluate(
    ({ settings }) => {
      const record = {
        finishedAt: '2026-10-23T12:00:00.000Z',
        mode: 'seed',
        dailyDate: null,
        seed: 42,
        score: 1000,
        stage: 2,
        bricksDestroyed: 10,
        rivalsDefeated: 3,
        powerUpsCollected: 2,
        elapsedTicks: 600,
        techniques: [],
      };
      const profile = {
        version: 3,
        highScore: 5000,
        bestStage: 7,
        runsPlayed: 3,
        settings,
        history: [record],
        dailyBest: null,
      };
      localStorage.setItem('bomb-blitz.profile.v3', JSON.stringify(profile));
    },
    { settings },
  );
  await page.reload();

  await page.locator('#records-button').click();
  await expect(page.locator('.record-row')).toHaveCount(1);
  await expect(page.locator('.record-badge')).toHaveText('Seed');
  await expect(page.locator('.record-seed')).toHaveText('Seed · 16');

  await page.locator('.record-replay').click();
  await expect(page.locator('#records-screen')).toBeHidden();
  await expect(page.locator('#stage-intro-mode')).toHaveText('Seed Run · 16');
});

test('migrates a v2 profile without seed lines or replay actions', async ({ page }) => {
  await page.evaluate(
    ({ settings }) => {
      const base = {
        finishedAt: '2026-10-22T12:00:00.000Z',
        score: 2222,
        stage: 4,
        bricksDestroyed: 20,
        rivalsDefeated: 7,
        powerUpsCollected: 5,
        elapsedTicks: 3600,
        techniques: [],
      };
      const profile = {
        version: 2,
        highScore: 4321,
        bestStage: 6,
        runsPlayed: 9,
        settings,
        history: [
          { ...base, mode: 'daily', dailyDate: '2026-10-22' },
          { ...base, mode: 'endless', dailyDate: null },
        ],
        dailyBest: { date: '2026-10-22', score: 2222 },
      };
      localStorage.setItem('bomb-blitz.profile.v2', JSON.stringify(profile));
    },
    { settings },
  );
  await page.reload();

  await expect(page.locator('#title-best')).toHaveText('BEST 004321 · STAGE 6');
  await page.locator('#records-button').click();
  await expect(page.locator('.record-row')).toHaveCount(2);
  await expect(page.locator('.record-seed')).toHaveCount(0);
  await expect(page.locator('.record-replay')).toHaveCount(0);
});

test.describe('dev harness copy fallback', () => {
  test.use({ baseURL: devUrl });

  test('reveals a selectable Share Link when the clipboard rejects', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      });
    });
    await page.reload();

    await page.evaluate(() => {
      (window as DebugWindow).__bombBlitzDebug?.showGameOver();
    });
    await expect(page.locator('#gameover-screen')).toBeVisible();

    await page.locator('#copy-seed-link-button').click();
    const field = page.locator('#gameover-share-link');
    await expect(field).toBeVisible();
    await expect(field).toHaveValue(/\?seed=7$/);
    await expect(field).toBeFocused();
    await expect(page.locator('#gameover-copy-status')).toHaveText(
      'Clipboard unavailable. Select the Share Link and copy it manually.',
    );
  });

  test('announces a copied Share Link when the clipboard resolves', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            (window as DebugWindow).__copied = value;
            return Promise.resolve();
          },
        },
      });
    });
    await page.reload();

    await page.evaluate(() => {
      (window as DebugWindow).__bombBlitzDebug?.showGameOver();
    });
    await page.locator('#copy-seed-link-button').click();

    await expect(page.locator('#gameover-copy-status')).toHaveText(
      'Share Link copied to the clipboard.',
    );
    const copied = await page.evaluate(() => (window as DebugWindow).__copied);
    expect(copied).toMatch(/\?seed=7$/);
  });
});
