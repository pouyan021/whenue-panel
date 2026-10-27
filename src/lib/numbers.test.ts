import { describe, expect, it } from 'vitest';

import { memberIdFromCode, parseWholeNumber, rialToToman, tomanToRial, toLatinDigits } from './numbers';
import { fromWallTime, wallTime } from './zoned';

describe('numbers', () => {
  it('reads Persian and Arabic digits and separators', () => {
    expect(toLatinDigits('۰۹۱۲ ٣٤٥')).toBe('0912 345');
    expect(parseWholeNumber('۱٬۲۰۰٬۰۰۰')).toBe(1200000);
    expect(parseWholeNumber('1,500')).toBe(1500);
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('12a')).toBeNull();
    expect(parseWholeNumber('-5')).toBeNull();
  });

  it('converts Toman and Rial', () => {
    expect(tomanToRial(150000)).toBe(1500000);
    expect(rialToToman(1500000)).toBe(150000);
  });

  it('reads a scanned member card', () => {
    expect(memberIdFromCode('whenue://member/42')).toBe('42');
    expect(memberIdFromCode(' WHENUE://member/۴۲ ')).toBe('42');
    expect(memberIdFromCode('0912')).toBeNull();
  });
});

describe('zoned', () => {
  it('turns Tehran wall-clock time into an instant and back', () => {
    const instant = fromWallTime({ year: 2026, month: 10, day: 27, hour: 15, minute: 30 }, 'Asia/Tehran');
    expect(instant.toISOString()).toBe('2026-10-27T12:00:00.000Z');
    expect(wallTime(instant, 'Asia/Tehran')).toMatchObject({ year: 2026, month: 10, day: 27, hour: 15, minute: 30 });
  });

  it('handles zones with daylight saving time', () => {
    const summer = fromWallTime({ year: 2026, month: 7, day: 1, hour: 9, minute: 0 }, 'Europe/Berlin');
    expect(summer.toISOString()).toBe('2026-07-01T07:00:00.000Z');
    const winter = fromWallTime({ year: 2026, month: 1, day: 1, hour: 9, minute: 0 }, 'Europe/Berlin');
    expect(winter.toISOString()).toBe('2026-01-01T08:00:00.000Z');
  });
});
