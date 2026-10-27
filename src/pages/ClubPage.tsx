import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, ErrorBanner, Field, Loading } from '../components/ui';
import {
  ORGANIZATION,
  SET_ORGANIZATION_MODULE,
  UPDATE_ORGANIZATION,
  type ClubModule,
  type OrganizationSettings,
} from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { useCurrentVenue } from '../lib/venue';

const MODULES: { module: ClubModule; name: MessageKey; description: MessageKey }[] = [
  { module: 'TESTIMONIALS', name: 'module.testimonials', description: 'module.testimonials.description' },
  { module: 'REFERRALS', name: 'module.referrals', description: 'module.referrals.description' },
];

/** The club's own settings, for organization admins: name, language, time zone and modules. */
export function ClubPage() {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const { data, loading, error } = useQuery(ORGANIZATION, { variables: { id: organization.id } });

  return (
    <section>
      <header className="page-header">
        <h1>{t('club.title')}</h1>
      </header>
      <ErrorBanner error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        data?.organization && (
          <div className="stack">
            <ClubForm organization={data.organization} />
            <Modules organization={data.organization} />
          </div>
        )
      )}
    </section>
  );
}

function ClubForm({ organization }: { organization: OrganizationSettings }) {
  const { t } = useI18n();
  const [update, { loading, error, data }] = useMutation(UPDATE_ORGANIZATION);
  const [form, setForm] = useState({
    name: organization.name,
    locale: organization.locale,
    timeZone: organization.timeZone,
  });
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    void update({
      variables: { id: organization.id, input: { name: form.name.trim(), locale: form.locale, timeZone: form.timeZone.trim() } },
    }).catch(() => undefined);
  }

  return (
    <form className="form card narrow" onSubmit={submit}>
      <Field label={t('club.name')}>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label={t('club.link')} hint={t('club.linkHint')}>
        <input readOnly dir="ltr" value={organization.slug} />
      </Field>
      <div className="form-row">
        <Field label={t('club.language')} hint={t('club.languageHint')}>
          <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            <option value="fa-IR">فارسی</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t('club.timeZone')}>
          <input
            required
            dir="ltr"
            list="time-zones"
            value={form.timeZone}
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
          />
          <datalist id="time-zones">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </Field>
      </div>
      <ErrorBanner error={error} />
      <div className="form-actions">
        {data && !loading && <span className="muted">{t('common.saved')}</span>}
        <Button variant="primary" type="submit" disabled={loading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function Modules({ organization }: { organization: OrganizationSettings }) {
  const { t } = useI18n();
  const { me } = useCurrentVenue();
  const [setModule, { loading, error }] = useMutation(SET_ORGANIZATION_MODULE);
  const isAdmin = me.role === 'ADMIN';

  return (
    <div className="card narrow">
      <h2>{t('club.modules')}</h2>
      <p className="muted">{isAdmin ? t('club.modulesAdmin') : t('club.modulesHint')}</p>
      <ErrorBanner error={error} />
      <ul className="module-list">
        {MODULES.map(({ module, name, description }) => {
          const enabled = organization.modules.some((m) => m.module === module && m.enabled);
          return (
            <li key={module}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!isAdmin || loading}
                  onChange={(e) =>
                    void setModule({
                      variables: { organizationId: organization.id, module, enabled: e.target.checked },
                    }).catch(() => undefined)
                  }
                />
                <strong>{t(name)}</strong>
              </label>
              <p className="muted small">{t(description)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
