import { describe, expect, it } from 'vitest';

import { cleanMobile, guessColumns, hasHeader, parseCsv, toCsv } from './spreadsheet';

describe('parseCsv', () => {
  it('reads quoted fields, a byte order mark and any separator', () => {
    expect(parseCsv('﻿نام,موبایل\r\n"احمدی, سارا",09121234567\n\n')).toEqual([
      ['نام', 'موبایل'],
      ['احمدی, سارا', '09121234567'],
    ]);
    expect(parseCsv('a;b\n"say ""hi""";2')).toEqual([
      ['a', 'b'],
      ['say "hi"', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('guessColumns', () => {
  it('finds Persian and English titles', () => {
    expect(guessColumns(['شماره پرونده', 'نام بیمار', 'تلفن همراه'])).toEqual({ name: 1, mobile: 2, externalRef: 0 });
    expect(guessColumns(['Name', 'Mobile'])).toEqual({ name: 0, mobile: 1, externalRef: -1 });
    expect(hasHeader([['Name', 'Mobile']])).toBe(true);
    expect(hasHeader([['سارا', '0912']])).toBe(false);
  });
});

describe('cleanMobile', () => {
  it('accepts the ways Iranian mobiles are written and Excel stores them', () => {
    expect(cleanMobile('0912 123 4567')).toBe('09121234567');
    expect(cleanMobile('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
    expect(cleanMobile('+98 912-123-4567')).toBe('09121234567');
    expect(cleanMobile('9121234567')).toBe('09121234567');
    expect(cleanMobile('021 2222 3333')).toBeNull();
    expect(cleanMobile('')).toBeNull();
  });
});

describe('toCsv', () => {
  it('quotes what needs it and starts with a byte order mark for Excel', () => {
    expect(toCsv([['نام', 'note'], ['سارا', 'a, "b"']])).toBe('﻿نام,note\r\nسارا,"a, ""b"""\r\n');
  });
});
