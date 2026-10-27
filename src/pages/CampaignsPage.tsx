import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { DateTimeInput } from '../components/DateTimeInput';
import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CAMPAIGNS,
  CREATE_CAMPAIGN,
  DELETE_CAMPAIGN,
  TEMPLATES,
  UPDATE_CAMPAIGN,
  type Campaign,
} from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

export function CampaignsPage() {
  const { t } = useI18n();
  const format = useFormat();
  const { venue } = useCurrentVenue();
  const { data, loading, error } = useQuery(CAMPAIGNS, { variables: { venueId: venue.id, size: 100 } });
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const campaigns = data?.campaigns ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('campaigns.title')}</h1>
        <Button variant="primary" onClick={() => setEditing('new')}>
          {t('campaigns.new')}
        </Button>
      </header>

      <ErrorBanner error={error} />
      {loading && campaigns.length === 0 ? (
        <Loading />
      ) : campaigns.length === 0 ? (
        <Empty>{t('campaigns.empty')}</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('campaigns.name')}</th>
              <th>{t('campaigns.dates')}</th>
              <th>{t('campaigns.template')}</th>
              <th>{t('campaigns.state')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  {c.description && <div className="muted small">{c.description}</div>}
                </td>
                <td>
                  {format.date(c.startDate)} – {c.endDate ? format.date(c.endDate) : t('campaigns.open')}
                </td>
                <td>{c.notificationTemplate.title}</td>
                <td>
                  <span className={`badge ${c.active ? 'badge-approved' : 'badge-muted'}`}>
                    {c.active ? t('campaigns.active') : t('campaigns.inactive')}
                  </span>
                </td>
                <td className="row-actions">
                  <Button onClick={() => setEditing(c)}>{t('common.edit')}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && <CampaignDialog campaign={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function CampaignDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const { t } = useI18n();
  const { venue } = useCurrentVenue();
  const templates = useQuery(TEMPLATES, { variables: { venueId: venue.id, size: 100 } });
  const [create, creation] = useMutation(CREATE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [update, updating] = useMutation(UPDATE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [remove, removal] = useMutation(DELETE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    notificationTemplateId: campaign?.notificationTemplate.id ?? '',
    startDate: (campaign?.startDate ?? new Date().toISOString()) as string | null,
    endDate: campaign?.endDate ?? null,
    active: campaign?.active ?? true,
  });
  const busy = creation.loading || updating.loading || removal.loading;
  const options = templates.data?.notificationTemplates ?? [];
  const templateId = form.notificationTemplateId || options[0]?.id || '';

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      notificationTemplateId: templateId,
      startDate: form.startDate ?? new Date().toISOString(),
      endDate: form.endDate,
      active: form.active,
    };
    const ok = campaign
      ? await update({ variables: { id: campaign.id, input } }).catch(() => null)
      : await create({ variables: { input: { ...input, venueId: venue.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  async function onDelete() {
    if (!campaign || !window.confirm(t('campaigns.deleteConfirm', { name: campaign.name }))) return;
    const result = await remove({ variables: { id: campaign.id } }).catch(() => null);
    if (result?.data?.deleteCampaign) onClose();
  }

  if (!templates.loading && options.length === 0) {
    return (
      <Dialog title={t('campaigns.new')} onClose={onClose}>
        <p>
          {t('campaigns.needsTemplate')} <Link to="/templates">{t('campaigns.createTemplate')}</Link>
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog title={campaign ? t('campaigns.edit') : t('campaigns.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('campaigns.name')}>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('campaigns.description')}>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label={t('campaigns.template')}>
          <select required value={templateId} onChange={(e) => set('notificationTemplateId', e.target.value)}>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label={t('campaigns.starts')}>
            <DateTimeInput
              label={t('campaigns.starts')}
              required
              value={form.startDate}
              onChange={(iso) => set('startDate', iso)}
            />
          </Field>
          <Field label={t('campaigns.ends')} hint={t('common.optional')}>
            <DateTimeInput label={t('campaigns.ends')} value={form.endDate} onChange={(iso) => set('endDate', iso)} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          {t('campaigns.activeHint')}
        </label>
        <ErrorBanner error={creation.error ?? updating.error ?? removal.error} />
        <div className="form-actions">
          {campaign && (
            <Button variant="ghost" className="delete" disabled={busy} onClick={onDelete}>
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
