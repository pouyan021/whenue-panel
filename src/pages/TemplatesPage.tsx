import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CREATE_TEMPLATE,
  DELETE_TEMPLATE,
  TEMPLATES,
  UPDATE_TEMPLATE,
  type NotificationTemplate,
} from '../graphql/operations';
import { useCurrentVenue } from '../lib/venue';

export function TemplatesPage() {
  const { venue } = useCurrentVenue();
  const { data, loading, error } = useQuery(TEMPLATES, { variables: { venueId: venue.id, size: 100 } });
  const [editing, setEditing] = useState<NotificationTemplate | 'new' | null>(null);
  const templates = data?.notificationTemplates ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>Message templates</h1>
        <Button variant="primary" onClick={() => setEditing('new')}>
          New template
        </Button>
      </header>
      <p className="muted">
        The message a visitor gets with their link. Campaigns use a template; it also sets how long links last.
      </p>

      <ErrorBanner error={error} />
      {loading && templates.length === 0 ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Empty>No templates yet. Create one before your first campaign.</Empty>
      ) : (
        <ul className="card-list">
          {templates.map((t) => (
            <li key={t.id} className="card">
              <div className="row">
                <h2>{t.title}</h2>
                <Button onClick={() => setEditing(t)}>Edit</Button>
              </div>
              <p>{t.message}</p>
              <p className="muted small">
                Button: “{t.callToAction}”{t.incentive && <> · Incentive: {t.incentive}</>} · Links last{' '}
                {t.linkExpiration ?? 72} hours
              </p>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TemplateDialog template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function TemplateDialog({ template, onClose }: { template: NotificationTemplate | null; onClose: () => void }) {
  const { venue } = useCurrentVenue();
  const [create, creation] = useMutation(CREATE_TEMPLATE, { refetchQueries: ['NotificationTemplates'] });
  const [update, updating] = useMutation(UPDATE_TEMPLATE);
  const [remove, removal] = useMutation(DELETE_TEMPLATE, { refetchQueries: ['NotificationTemplates'] });
  const [form, setForm] = useState({
    title: template?.title ?? '',
    message: template?.message ?? '',
    incentive: template?.incentive ?? '',
    callToAction: template?.callToAction ?? 'Record your video',
    linkExpiration: template?.linkExpiration?.toString() ?? '',
  });
  const busy = creation.loading || updating.loading || removal.loading;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: form.title.trim(),
      message: form.message.trim(),
      incentive: form.incentive.trim() || null,
      callToAction: form.callToAction.trim(),
      linkExpiration: form.linkExpiration ? Number(form.linkExpiration) : null,
    };
    const ok = template
      ? await update({ variables: { id: template.id, input } }).catch(() => null)
      : await create({ variables: { input: { ...input, venueId: venue.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  async function onDelete() {
    if (!template || !window.confirm(`Delete the template “${template.title}”?`)) return;
    const result = await remove({ variables: { id: template.id } }).catch(() => null);
    if (result?.data?.deleteNotificationTemplate) onClose();
  }

  return (
    <Dialog title={template ? 'Edit template' : 'New template'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Title">
          <input required value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea required rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} />
        </Field>
        <Field label="Incentive" hint="Optional, for example “10% off your next visit”.">
          <input value={form.incentive} onChange={(e) => set('incentive', e.target.value)} />
        </Field>
        <Field label="Button text">
          <input required value={form.callToAction} onChange={(e) => set('callToAction', e.target.value)} />
        </Field>
        <Field label="Links last (hours)" hint="Leave empty for the default of 72 hours.">
          <input
            type="number"
            min={1}
            value={form.linkExpiration}
            onChange={(e) => set('linkExpiration', e.target.value)}
          />
        </Field>
        <ErrorBanner error={creation.error ?? updating.error ?? removal.error} />
        <div className="form-actions">
          {template && (
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
