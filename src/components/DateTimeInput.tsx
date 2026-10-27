import { useContext, useState } from 'react';

import { useI18n } from '../i18n/i18n';
import { JALALI_MONTHS_FA, jalaliMonthLength, toGregorian, toJalali } from '../lib/jalali';
import { VenueContext } from '../lib/venue';
import { fromWallTime, wallTime } from '../lib/zoned';

type Props = {
  /** An ISO instant, or null for none. */
  value: string | null;
  onChange: (iso: string | null) => void;
  required?: boolean;
  /** Labels the controls, since a Field wraps them in one label. */
  label: string;
};

/**
 * A date and time in the organization's time zone: day, month and year pickers in the Solar Hijri
 * calendar for Persian, and the browser's own picker for English.
 */
export function DateTimeInput(props: Props) {
  const { lang } = useI18n();
  const timeZone =
    useContext(VenueContext)?.venue.organization.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return lang === 'fa' ? <JalaliInput {...props} timeZone={timeZone} /> : <NativeInput {...props} timeZone={timeZone} />;
}

const pad = (n: number) => String(n).padStart(2, '0');

function NativeInput({ value, onChange, required, label, timeZone }: Props & { timeZone: string }) {
  let text = '';
  if (value) {
    const w = wallTime(new Date(value), timeZone);
    text = `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
  }
  return (
    <input
      type="datetime-local"
      aria-label={label}
      required={required}
      value={text}
      onChange={(e) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e.target.value);
        if (!match) return onChange(null);
        const [year, month, day, hour, minute] = match.slice(1).map(Number);
        onChange(fromWallTime({ year, month, day, hour, minute }, timeZone).toISOString());
      }}
    />
  );
}

type JalaliParts = { jy: string; jm: string; jd: string; time: string };

function partsOf(value: string | null, timeZone: string): JalaliParts {
  if (!value) return { jy: '', jm: '', jd: '', time: '' };
  const w = wallTime(new Date(value), timeZone);
  const j = toJalali(w.year, w.month, w.day);
  return { jy: String(j.jy), jm: String(j.jm), jd: String(j.jd), time: `${pad(w.hour)}:${pad(w.minute)}` };
}

function JalaliInput({ value, onChange, required, label, timeZone }: Props & { timeZone: string }) {
  const { t } = useI18n();
  // Kept here as well, so a half-picked date stays on screen until it is complete.
  const [parts, setParts] = useState(() => partsOf(value, timeZone));
  const thisYear = toJalali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).jy;
  const years = Array.from({ length: 8 }, (_, i) => thisYear - 3 + i);
  if (parts.jy && !years.includes(Number(parts.jy))) years.unshift(Number(parts.jy));
  const days = parts.jy && parts.jm ? jalaliMonthLength(Number(parts.jy), Number(parts.jm)) : 31;
  const digits = new Intl.NumberFormat('fa-IR', { useGrouping: false });

  function update(change: Partial<JalaliParts>) {
    const next = { ...parts, ...change };
    if (next.jy && next.jm && next.jd && Number(next.jd) > jalaliMonthLength(Number(next.jy), Number(next.jm))) {
      next.jd = String(jalaliMonthLength(Number(next.jy), Number(next.jm)));
    }
    setParts(next);
    if (!next.jy || !next.jm || !next.jd) return onChange(null);
    const g = toGregorian(Number(next.jy), Number(next.jm), Number(next.jd));
    const [hour, minute] = (next.time || '00:00').split(':').map(Number);
    onChange(fromWallTime({ year: g.gy, month: g.gm, day: g.gd, hour, minute }, timeZone).toISOString());
  }

  return (
    <span className="jalali-input" role="group" aria-label={label}>
      <select aria-label={t('date.day')} required={required} value={parts.jd} onChange={(e) => update({ jd: e.target.value })}>
        <option value="">{t('date.day')}</option>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {digits.format(d)}
          </option>
        ))}
      </select>
      <select aria-label={t('date.month')} required={required} value={parts.jm} onChange={(e) => update({ jm: e.target.value })}>
        <option value="">{t('date.month')}</option>
        {JALALI_MONTHS_FA.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={t('date.year')} required={required} value={parts.jy} onChange={(e) => update({ jy: e.target.value })}>
        <option value="">{t('date.year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {digits.format(y)}
          </option>
        ))}
      </select>
      <input
        type="time"
        aria-label={t('date.time')}
        value={parts.time}
        onChange={(e) => update({ time: e.target.value })}
      />
      {!required && (parts.jy || parts.jm || parts.jd) && (
        <button type="button" className="btn btn-ghost" onClick={() => {
          setParts({ jy: '', jm: '', jd: '', time: '' });
          onChange(null);
        }}>
          {t('date.clear')}
        </button>
      )}
    </span>
  );
}
