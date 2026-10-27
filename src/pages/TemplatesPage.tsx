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
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { toLatinDigits } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';

export function TemplatesPage() {
  const { t } = useI18n();
  const format = useFormat();
  const { venue } = useCurrentVenue();
  const { data, loading, error } = useQuery(TEMPLATES, { variables: { venueId: venue.id, size: 100 } });
  const [editing, setEditing] = useState<NotificationTemplate | 'new' | null>(null);
  const templates = data?.notificationTemplates ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('templates.title')}</h1>
        <Button variant="primary" onClick={() => setEditing('new')}>
          {t('templates.new')}
        </Button>
      </header>
      <p className="muted">{t('templates.intro')}</p>

      <ErrorBanner error={error} />
      {loading && templates.length === 0 ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Empty>{t('templates.empty')}</Empty>
      ) : (
        <ul className="card-list">
          {templates.map((template) => (
            <li key={template.id} className="card">
              <div className="row">
                <h2>{template.title}</h2>
                <Button onClick={() => setEditing(template)}>{t('common.edit')}</Button>
              </div>
              <p>{template.message}</p>
              <p className="muted small">
                {t('templates.button', { text: template.callToAction })}
                {template.incentive && <> · {t('templates.incentiveIs', { text: template.incentive })}</>} ·{' '}
                {t('templates.linksLast', { hours: format.number(template.linkExpiration ?? 72) })}
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
  const { t } = useI18n();
  const { venue } = useCurrentVenue();
  const [create, creation] = useMutation(CREATE_TEMPLATE, { refetchQueries: ['NotificationTemplates'] });
  const [update, updating] = useMutation(UPDATE_TEMPLATE);
  const [remove, removal] = useMutation(DELETE_TEMPLATE, { refetchQueries: ['NotificationTemplates'] });
  const [form, setForm] = useState({
    title: template?.title ?? '',
    message: template?.message ?? '',
    incentive: template?.incentive ?? '',
    callToAction: template?.callToAction ?? t('templates.defaultButton'),
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
      linkExpiration: form.linkExpiration ? Number(toLatinDigits(form.linkExpiration)) : null,
    };
    const ok = template
      ? await update({ variables: { id: template.id, input } }).catch(() => null)
      : await create({ variables: { input: { ...input, venueId: venue.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  async function onDelete() {
    if (!template || !window.confirm(t('templates.deleteConfirm', { name: template.title }))) return;
    const result = await remove({ variables: { id: template.id } }).catch(() => null);
    if (result?.data?.deleteNotificationTemplate) onClose();
  }

  return (
    <Dialog title={template ? t('templates.edit') : t('templates.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('templates.name')}>
          <input required value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label={t('templates.message')}>
          <textarea required rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} />
        </Field>
        <Field label={t('templates.incentive')} hint={t('templates.incentiveHint')}>
          <input value={form.incentive} onChange={(e) => set('incentive', e.target.value)} />
        </Field>
        <Field label={t('templates.buttonText')}>
          <input required value={form.callToAction} onChange={(e) => set('callToAction', e.target.value)} />
        </Field>
        <Field label={t('templates.linkHours')} hint={t('templates.linkHoursHint')}>
          <input
            inputMode="numeric"
            value={form.linkExpiration}
            onChange={(e) => set('linkExpiration', e.target.value)}
          />
        </Field>
        <ErrorBanner error={creation.error ?? updating.error ?? removal.error} />
        <div className="form-actions">
          {template && (
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
