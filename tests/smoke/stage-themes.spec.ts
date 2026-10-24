import { expect, test } from '@playwright/test';

const devUrl = 'http://localhost:5174';

type StageThemeId = 'pillar-hall' | 'brickworks' | 'crossroads' | 'twin-courts';

type DebugWindow = Window & {
  __bombBlitzDebug?: {
    startThemeRun(theme?: StageThemeId): void;
    forceRunOver(): void;
  };
};

const THEMES = [
  { id: 'pillar-hall', name: 'Pillar Hall' },
  { id: 'brickworks', name: 'Brickworks' },
  { id: 'crossroads', name: 'Crossroads' },
  { id: 'twin-courts', name: 'Twin Courts' },
] as const satisfies ReadonlyArray<{ id: StageThemeId; name: string }>;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('names Pillar Hall on the Stage 1 intro and marks the shell', async ({ page }) => {
  await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'pillar-hall');

  await page.locator('#play-button').click();

  await expect(page.locator('#stage-intro')).toBeVisible();
  await expect(page.locator('#stage-intro-stage')).toHaveText('1');
  await expect(page.locator('#stage-intro-theme')).toHaveText('Pillar Hall');
  await expect(page.locator('#stage-intro-rivals')).toContainText('rival');
  await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'pillar-hall');
});

test.describe('dev harness theme runs', () => {
  test.use({ baseURL: devUrl });

  for (const theme of THEMES) {
    test(`starts Stage 1 in ${theme.name}`, async ({ page }) => {
      await page.evaluate((id) => {
        (window as DebugWindow).__bombBlitzDebug?.startThemeRun(id);
      }, theme.id);

      await expect(page.locator('#hud')).toBeVisible();
      await expect(page.locator('#stage-intro-stage')).toHaveText('1');
      await expect(page.locator('#stage-intro-theme')).toHaveText(theme.name);
      await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', theme.id);
    });
  }

  test('keeps the run accent on Game Over and restores Pillar Hall on the title path', async ({
    page,
  }) => {
    await page.evaluate(() => {
      (window as DebugWindow).__bombBlitzDebug?.startThemeRun('crossroads');
    });
    await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'crossroads');

    await page.evaluate(() => {
      (window as DebugWindow).__bombBlitzDebug?.forceRunOver();
    });
    await expect(page.locator('#gameover-screen')).toBeVisible();
    await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'crossroads');

    await page.locator('#gameover-records-button').click();
    await expect(page.locator('#records-screen')).toBeVisible();
    await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'crossroads');

    await page.locator('#records-back-button').click();
    await page.locator('#title-button').click();
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.locator('#game-shell')).toHaveAttribute('data-theme', 'pillar-hall');
  });
});
