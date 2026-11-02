import { useState } from 'react';

import { useI18n } from '../i18n/i18n';
import { JALALI_MONTHS_FA, jalaliMonthLength, toGregorian, toJalali } from '../lib/jalali';

type Props = {
  /** YYYY-MM-DD in the Gregorian calendar, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  label: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** A calendar date with no time or time zone: Solar Hijri pickers for Persian, the browser's picker for English. */
export function BirthDateInput({ value, onChange, label }: Props) {
  const { lang } = useI18n();
  if (lang !== 'fa') {
    return (
      <input
        type="date"
        aria-label={label}
        value={value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <JalaliDateInput value={value} onChange={onChange} label={label} />;
}

type Parts = { jy: string; jm: string; jd: string };

function partsOf(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { jy: '', jm: '', jd: '' };
  const j = toJalali(Number(match[1]), Number(match[2]), Number(match[3]));
  return { jy: String(j.jy), jm: String(j.jm), jd: String(j.jd) };
}

function JalaliDateInput({ value, onChange, label }: Props) {
  const { t } = useI18n();
  const [parts, setParts] = useState(() => partsOf(value));
  const now = new Date();
  const thisYear = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);
  const days = parts.jy && parts.jm ? jalaliMonthLength(Number(parts.jy), Number(parts.jm)) : 31;
  const digits = new Intl.NumberFormat('fa-IR', { useGrouping: false });

  function update(change: Partial<Parts>) {
    const next = { ...parts, ...change };
    if (next.jy && next.jm && next.jd && Number(next.jd) > jalaliMonthLength(Number(next.jy), Number(next.jm))) {
      next.jd = String(jalaliMonthLength(Number(next.jy), Number(next.jm)));
    }
    setParts(next);
    if (!next.jy || !next.jm || !next.jd) return onChange('');
    const g = toGregorian(Number(next.jy), Number(next.jm), Number(next.jd));
    onChange(`${g.gy}-${pad(g.gm)}-${pad(g.gd)}`);
  }

  return (
    <span className="jalali-input" role="group" aria-label={label}>
      <select aria-label={t('date.day')} value={parts.jd} onChange={(e) => update({ jd: e.target.value })}>
        <option value="">{t('date.day')}</option>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {digits.format(d)}
          </option>
        ))}
      </select>
      <select aria-label={t('date.month')} value={parts.jm} onChange={(e) => update({ jm: e.target.value })}>
        <option value="">{t('date.month')}</option>
        {JALALI_MONTHS_FA.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={t('date.year')} value={parts.jy} onChange={(e) => update({ jy: e.target.value })}>
        <option value="">{t('date.year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {digits.format(y)}
          </option>
        ))}
      </select>
      {(parts.jy || parts.jm || parts.jd) && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setParts({ jy: '', jm: '', jd: '' });
            onChange('');
          }}
        >
          {t('date.clear')}
        </button>
      )}
    </span>
  );
}
