import { describe, expect, it } from 'vitest';

import { jalaliMonthLength, toGregorian, toJalali } from './jalali';

// The browser's own Persian calendar, to check against.
const persian = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function intlJalali(date: Date) {
  const parts = Object.fromEntries(persian.formatToParts(date).map((p) => [p.type, p.value]));
  return { jy: Number(parts.year), jm: Number(parts.month), jd: Number(parts.day) };
}

describe('jalali', () => {
  it('knows Nowruz and today', () => {
    expect(toJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(toJalali(2026, 10, 27)).toEqual({ jy: 1405, jm: 8, jd: 5 });
    expect(toGregorian(1405, 8, 5)).toEqual({ gy: 2026, gm: 10, gd: 27 });
  });

  it('agrees with Intl and round-trips every day from 1990 to 2060', () => {
    const day = 24 * 60 * 60 * 1000;
    for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(2060, 0, 1); t += day) {
      const date = new Date(t);
      const g = { gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() };
      const j = toJalali(g.gy, g.gm, g.gd);
      expect(j).toEqual(intlJalali(date));
      expect(toGregorian(j.jy, j.jm, j.jd)).toEqual(g);
    }
  });

  it('gives Esfand 30 days in leap years only', () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
  });
});
