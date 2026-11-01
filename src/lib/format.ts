import { CombinedGraphQLErrors } from '@apollo/client';
import { useContext, useMemo } from 'react';

import type { MessageKey } from '../i18n/en';
import { useI18n, type Lang, type Translate } from '../i18n/i18n';
import { rialToToman } from './numbers';
import { VenueContext } from './venue';

export type Format = ReturnType<typeof makeFormat>;

/**
 * Dates in the Solar Hijri calendar for Persian and the Gregorian one for English, both in the
 * organization's time zone; numbers in Persian digits for Persian.
 */
export function makeFormat(lang: Lang, t: Translate, timeZone?: string) {
  const locale = lang === 'fa' ? 'fa-IR' : 'en-GB';
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone });
  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return {
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    date: (iso: string) => date.format(new Date(iso)),
    number: (n: number) => number.format(n),
    /** 0.42 as 42% (۴۲٪ in Persian). */
    percent: (ratio: number) => percent.format(ratio),
    /** A Rial amount, shown in Toman. */
    toman: (rial: number) => t('money.toman', { amount: number.format(rialToToman(rial)) }),
    /** A Rial amount in Toman, shortened: 1.8 billion Toman. */
    tomanShort: (rial: number) => t('money.toman', { amount: compact.format(rialToToman(rial)) }),
    points: (n: number) => t('money.points', { points: number.format(n) }),
  };
}

export function useFormat() {
  const { lang, t } = useI18n();
  const timeZone = useContext(VenueContext)?.venue.organization.timeZone;
  return useMemo(() => makeFormat(lang, t, timeZone), [lang, t, timeZone]);
}

// whenue-api answers in English; the ones staff meet at the desk get our own words.
const KNOWN_ERRORS: [RegExp, MessageKey][] = [
  [/^Not enough points/, 'error.notEnoughPoints'],
  [/^Not a valid mobile number/, 'error.invalidMobile'],
  [/^CONSENT_REQUIRED/, 'error.consentRequired'],
  [/Nobody in this segment can get an SMS/, 'error.smsNobody'],
  [/A campaign can go to at most/, 'error.smsTooMany'],
  [/must be between 1 and 3650/, 'error.smsDays'],
  [/Failed to fetch|NetworkError|Load failed/i, 'error.network'],
];

export function errorMessage(error: unknown, t: Translate) {
  const messages = CombinedGraphQLErrors.is(error)
    ? error.errors.map((e) => e.message)
    : error instanceof Error
      ? [error.message]
      : [];
  for (const message of messages) {
    const known = KNOWN_ERRORS.find(([pattern]) => pattern.test(message));
    if (known) return t(known[1]);
  }
  return messages[0] ?? t('error.generic');
}
