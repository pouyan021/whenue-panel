import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, ErrorBanner, Field, Loading, OneTimeSecret } from '../components/ui';
import {
  CREATE_API_KEY,
  CREATE_WEBHOOK_ENDPOINT,
  DELETE_WEBHOOK_ENDPOINT,
  INTEGRATIONS,
  REVOKE_API_KEY,
  UPDATE_WEBHOOK_ENDPOINT,
  type ApiKey,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { apiDocsUrl } from '../lib/config';
import { useFormat } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

export const WEBHOOK_EVENTS = [
  'member.joined',
  'member.left',
  'visit.recorded',
  'reward.redeemed',
  'redemption.cancelled',
  'testimonial.withdrawn',
];

/** Keys and webhooks that connect the clinic's own software, in whatever language it is written. */
export function IntegrationsPage() {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const { data, loading, error } = useQuery(INTEGRATIONS, { variables: { organizationId: organization.id } });

  return (
    <section>
      <header className="page-header">
        <h1>{t('integrations.title')}</h1>
      </header>
      <p className="muted">
        {t('integrations.intro')}{' '}
        <a href={apiDocsUrl()} target="_blank" rel="noreferrer">
          {t('integrations.docs')}
        </a>
      </p>
      <ErrorBanner error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        data?.organization && (
          <div className="stack">
            <ApiKeys keys={data.organization.apiKeys} />
            <Webhooks endpoints={data.organization.webhookEndpoints} />
          </div>
        )
      )}
    </section>
  );
}

function ApiKeys({ keys }: { keys: ApiKey[] }) {
  const { t } = useI18n();
  const format = useFormat();
  const [creating, setCreating] = useState(false);
  const [revoke, revoking] = useMutation(REVOKE_API_KEY);

  function onRevoke(key: ApiKey) {
    if (!window.confirm(t('apiKeys.revokeConfirm', { name: key.name }))) return;
    void revoke({ variables: { id: key.id } }).catch(() => undefined);
  }

  return (
    <div className="card">
      <div className="row">
        <h2>{t('apiKeys.title')}</h2>
        <Button onClick={() => setCreating(true)}>{t('apiKeys.new')}</Button>
      </div>
      <ErrorBanner error={revoking.error} />
      {keys.length === 0 ? (
        <p className="muted">{t('apiKeys.none')}</p>
      ) : (
        <table className="table table-plain">
          <thead>
            <tr>
              <th>{t('apiKeys.name')}</th>
              <th>{t('apiKeys.prefix')}</th>
              <th>{t('apiKeys.lastUsed')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td>
                  {key.name}
                  <div className="muted small">{format.date(key.createdAt)}</div>
                </td>
                <td dir="ltr">
                  <code>wk_{key.prefix}_…</code>
                </td>
                <td>{key.lastUsedAt ? format.dateTime(key.lastUsedAt) : <span className="muted">{t('apiKeys.never')}</span>}</td>
                <td className="row-actions">
                  {key.revokedAt ? (
                    <span className="badge badge-muted">{t('apiKeys.revoked')}</span>
                  ) : (
                    <Button variant="ghost" className="delete" disabled={revoking.loading} onClick={() => onRevoke(key)}>
                      {t('apiKeys.revoke')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && <NewKeyDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewKeyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [create, { data, loading, error }] = useMutation(CREATE_API_KEY, { refetchQueries: ['Integrations'] });
  const [name, setName] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void create({ variables: { organizationId: organization.id, name: name.trim() } }).catch(() => undefined);
  }

  return (
    <Dialog title={t('apiKeys.new')} onClose={onClose}>
      {data ? (
        <OneTimeSecret label={t('apiKeys.key')} value={data.createApiKey.key} />
      ) : (
        <form className="form" onSubmit={submit}>
          <Field label={t('apiKeys.name')} hint={t('apiKeys.nameHint')}>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <ErrorBanner error={error} />
          <div className="form-actions">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {t('apiKeys.create')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function Webhooks({ endpoints }: { endpoints: WebhookEndpoint[] }) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  return (
    <div className="card">
      <div className="row">
        <h2>{t('webhooks.title')}</h2>
        <Button onClick={() => setCreating(true)}>{t('webhooks.new')}</Button>
      </div>
      <p className="muted small">{t('webhooks.intro')}</p>
      {endpoints.length === 0 ? (
        <p className="muted">{t('webhooks.none')}</p>
      ) : (
        <ul className="card-list">
          {endpoints.map((endpoint) => (
            <EndpointItem key={endpoint.id} endpoint={endpoint} />
          ))}
        </ul>
      )}
      {creating && <NewEndpointDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function EndpointItem({ endpoint }: { endpoint: WebhookEndpoint }) {
  const { t } = useI18n();
  const [update, updating] = useMutation(UPDATE_WEBHOOK_ENDPOINT);
  const [remove, removal] = useMutation(DELETE_WEBHOOK_ENDPOINT, { refetchQueries: ['Integrations'] });

  function onDelete() {
    if (!window.confirm(t('webhooks.deleteConfirm', { url: endpoint.url }))) return;
    void remove({ variables: { id: endpoint.id } }).catch(() => undefined);
  }

  return (
    <li className="endpoint">
      <div className="row">
        <code dir="ltr" className="endpoint-url">
          {endpoint.url}
        </code>
        <div className="action-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={endpoint.active}
              disabled={updating.loading}
              onChange={(e) =>
                void update({ variables: { id: endpoint.id, input: { active: e.target.checked } } }).catch(() => undefined)
              }
            />
            {t('webhooks.active')}
          </label>
          <Button variant="ghost" className="delete" disabled={removal.loading} onClick={onDelete}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
      <p className="muted small" dir="ltr">
        {endpoint.events.length === 0 ? t('webhooks.allEvents') : endpoint.events.join(', ')}
      </p>
      <ErrorBanner error={updating.error ?? removal.error} />
      {endpoint.recentDeliveries.length > 0 && (
        <details className="history">
          <summary>{t('webhooks.deliveries')}</summary>
          <table className="table table-plain">
            <tbody>
              {endpoint.recentDeliveries.map((d) => (
                <DeliveryRow key={d.id} delivery={d} />
              ))}
            </tbody>
          </table>
        </details>
      )}
    </li>
  );
}

function DeliveryRow({ delivery: d }: { delivery: WebhookDelivery }) {
  const { t } = useI18n();
  const format = useFormat();
  const state = d.deliveredAt ? 'delivered' : d.failedAt ? 'failed' : 'retrying';
  return (
    <tr>
      <td dir="ltr">
        <code>{d.eventType}</code>
      </td>
      <td>
        <span className={`badge ${state === 'delivered' ? 'badge-approved' : state === 'failed' ? 'badge-rejected' : 'badge-pending'}`}>
          {t(`webhooks.state.${state}`)}
        </span>
        {d.lastStatus != null && <span className="muted small"> HTTP {d.lastStatus}</span>}
        {d.lastError && <div className="muted small">{d.lastError}</div>}
      </td>
      <td className="muted small">
        {t('webhooks.attempts', { count: format.number(d.attempts) })}
        <br />
        {format.dateTime(d.createdAt)}
      </td>
    </tr>
  );
}

function NewEndpointDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [create, { data, loading, error }] = useMutation(CREATE_WEBHOOK_ENDPOINT, { refetchQueries: ['Integrations'] });
  const [url, setUrl] = useState('https://');
  const [events, setEvents] = useState<string[]>([]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void create({ variables: { input: { organizationId: organization.id, url: url.trim(), events } } }).catch(
      () => undefined,
    );
  }

  return (
    <Dialog title={t('webhooks.new')} onClose={onClose}>
      {data ? (
        <OneTimeSecret label={t('webhooks.secret')} value={data.createWebhookEndpoint.secret} />
      ) : (
        <form className="form" onSubmit={submit}>
          <Field label={t('webhooks.url')} hint={t('webhooks.urlHint')}>
            <input required type="url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <fieldset className="consent-choice">
            <legend>{t('webhooks.events')}</legend>
            <p className="muted small">{t('webhooks.eventsHint')}</p>
            {WEBHOOK_EVENTS.map((name) => (
              <label key={name} className="checkbox" dir="ltr">
                <input
                  type="checkbox"
                  checked={events.includes(name)}
                  onChange={(e) =>
                    setEvents((list) => (e.target.checked ? [...list, name] : list.filter((n) => n !== name)))
                  }
                />
                <code>{name}</code>
              </label>
            ))}
          </fieldset>
          <ErrorBanner error={error} />
          <div className="form-actions">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {t('webhooks.create')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
