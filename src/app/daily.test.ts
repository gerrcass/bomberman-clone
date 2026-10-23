import { describe, expect, it } from 'vitest';

import { dailyDateKey } from './daily';

describe('dailyDateKey', () => {
  it('formats a local January date with a padded month and day', () => {
    expect(dailyDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats a local December date with a padded day', () => {
    expect(dailyDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses the local calendar date, not the UTC date', () => {
    // 00:30 local on the first of the month is still the previous UTC day in
    // most western timezones; the key must stay local.
    const date = new Date(2026, 2, 1, 0, 30);

    expect(dailyDateKey(date)).toBe('2026-03-01');
  });
});
