import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CAMPAIGNS,
  CREATE_CAMPAIGN,
  DELETE_CAMPAIGN,
  TEMPLATES,
  UPDATE_CAMPAIGN,
  type Campaign,
} from '../graphql/operations';
import { formatDate, fromLocalInput, toLocalInput } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

export function CampaignsPage() {
  const { venue } = useCurrentVenue();
  const { data, loading, error } = useQuery(CAMPAIGNS, { variables: { venueId: venue.id, size: 100 } });
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const campaigns = data?.campaigns ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>Campaigns</h1>
        <Button variant="primary" onClick={() => setEditing('new')}>
          New campaign
        </Button>
      </header>

      <ErrorBanner error={error} />
      {loading && campaigns.length === 0 ? (
        <Loading />
      ) : campaigns.length === 0 ? (
        <Empty>No campaigns yet.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Dates</th>
              <th>Template</th>
              <th>Status</th>
              <th aria-label="Actions" />
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
                  {formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : 'open'}
                </td>
                <td>{c.notificationTemplate.title}</td>
                <td>
                  <span className={`badge ${c.active ? 'badge-approved' : 'badge-muted'}`}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="row-actions">
                  <Button onClick={() => setEditing(c)}>Edit</Button>
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
  const { venue } = useCurrentVenue();
  const templates = useQuery(TEMPLATES, { variables: { venueId: venue.id, size: 100 } });
  const [create, creation] = useMutation(CREATE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [update, updating] = useMutation(UPDATE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [remove, removal] = useMutation(DELETE_CAMPAIGN, { refetchQueries: ['Campaigns'] });
  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    notificationTemplateId: campaign?.notificationTemplate.id ?? '',
    startDate: toLocalInput(campaign?.startDate ?? new Date().toISOString()),
    endDate: campaign?.endDate ? toLocalInput(campaign.endDate) : '',
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
      startDate: fromLocalInput(form.startDate) ?? new Date().toISOString(),
      endDate: fromLocalInput(form.endDate),
      active: form.active,
    };
    const ok = campaign
      ? await update({ variables: { id: campaign.id, input } }).catch(() => null)
      : await create({ variables: { input: { ...input, venueId: venue.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  async function onDelete() {
    if (!campaign || !window.confirm(`Delete the campaign “${campaign.name}”?`)) return;
    const result = await remove({ variables: { id: campaign.id } }).catch(() => null);
    if (result?.data?.deleteCampaign) onClose();
  }

  if (!templates.loading && options.length === 0) {
    return (
      <Dialog title="New campaign" onClose={onClose}>
        <p>
          A campaign needs a message template. <Link to="/templates">Create a template</Link> first.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog title={campaign ? 'Edit campaign' : 'New campaign'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Message template">
          <select required value={templateId} onChange={(e) => set('notificationTemplateId', e.target.value)}>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Starts">
            <input
              type="datetime-local"
              required
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Ends" hint="Optional.">
            <input type="datetime-local" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Active, offered when adding visits
        </label>
        <ErrorBanner error={creation.error ?? updating.error ?? removal.error} />
        <div className="form-actions">
          {campaign && (
            <Button variant="ghost" className="delete" disabled={busy} onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
