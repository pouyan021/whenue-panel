import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { I18nProvider, type Lang } from '../i18n/i18n';
import { VenueProvider } from '../lib/venue';
import { staff } from '../test/render';
import { DateTimeInput } from './DateTimeInput';

let latest: string | null = null;

function Harness({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeInput
      label="When"
      value={value}
      onChange={(iso) => {
        latest = iso;
        setValue(iso);
      }}
    />
  );
}

function renderInput(lang: Lang, initial: string | null) {
  latest = initial;
  render(
    <I18nProvider lang={lang}>
      <VenueProvider value={{ me: staff, venue: staff.venue! }}>
        <Harness initial={initial} />
      </VenueProvider>
    </I18nProvider>,
  );
}

describe('DateTimeInput', () => {
  it('shows an instant as a Solar Hijri date in Tehran time', () => {
    renderInput('fa', '2026-10-27T12:00:00.000Z');

    expect(screen.getByRole('combobox', { name: 'روز' })).toHaveValue('5');
    expect(screen.getByRole('combobox', { name: 'ماه' })).toHaveValue('8');
    expect(screen.getByRole('combobox', { name: 'سال' })).toHaveValue('1405');
    expect(screen.getByLabelText('ساعت')).toHaveValue('15:30');
  });

  it('turns a picked Solar Hijri date into the instant in Tehran time', async () => {
    const user = userEvent.setup();
    renderInput('fa', '2026-10-27T12:00:00.000Z');

    // 1 Farvardin 1405 at 15:30 in Tehran is 21 March 2026, 12:00 UTC.
    await user.selectOptions(screen.getByRole('combobox', { name: 'ماه' }), '1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'روز' }), '1');
    expect(latest).toBe('2026-03-21T12:00:00.000Z');
  });

  it('keeps the day inside a shorter month', async () => {
    const user = userEvent.setup();
    renderInput('fa', null);

    await user.selectOptions(screen.getByRole('combobox', { name: 'روز' }), '31');
    await user.selectOptions(screen.getByRole('combobox', { name: 'سال' }), '1404');
    await user.selectOptions(screen.getByRole('combobox', { name: 'ماه' }), '12');
    // Esfand 1404 has 29 days; midnight in Tehran is 20:30 UTC the day before.
    expect(latest).toBe('2026-03-19T20:30:00.000Z');
  });

  it('uses the Gregorian picker in English, still in Tehran time', () => {
    renderInput('en', '2026-10-27T12:00:00.000Z');

    expect(screen.getByLabelText('When')).toHaveValue('2026-10-27T15:30');
  });
});
