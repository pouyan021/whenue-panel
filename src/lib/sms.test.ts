import { describe, expect, it } from 'vitest';

import { smsSize } from './sms';

describe('smsSize', () => {
  it('fits 160 Latin characters in one part', () => {
    expect(smsSize('a'.repeat(160))).toEqual({ characters: 160, parts: 1, unicode: false });
    expect(smsSize('a'.repeat(161)).parts).toBe(2);
  });

  it('counts Persian text as unicode, 70 a part', () => {
    expect(smsSize('س'.repeat(70)).parts).toBe(1);
    expect(smsSize('س'.repeat(71)).parts).toBe(2);
    expect(smsSize('س'.repeat(135)).parts).toBe(3);
  });

  it('leaves room for a Persian first name', () => {
    const size = smsSize('Hi {name}');
    expect(size).toEqual({ characters: 11, parts: 1, unicode: true });
  });

  it('is zero parts when empty', () => {
    expect(smsSize('').parts).toBe(0);
  });
});
