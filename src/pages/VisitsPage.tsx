import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { DateTimeInput } from '../components/DateTimeInput';
import { Mobile } from '../components/members';
import { Button, Dialog, Empty, ErrorBanner, Field, Loading, StatusBadge } from '../components/ui';
import { CAMPAIGNS, CREATE_VISIT, DELETE_VISIT, ISSUE_VISIT_TOKEN, VISITS, type Visit } from '../graphql/operations';
import { useI18n, type Translate } from '../i18n/i18n';
import { config, visitLink } from '../lib/config';
import { useFormat } from '../lib/format';
import { toLatinDigits } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';

/** Every visit at the branch: check-ins at reception, visits from the clinic's system, and testimonial requests. */
export function VisitsPage() {
  const { t } = useI18n();
  const { venue, hasModule } = useCurrentVenue();
  const testimonials = hasModule('TESTIMONIALS');
  const [size, setSize] = useState(config.pageSize);
  const [creating, setCreating] = useState(false);
  const [linkFor, setLinkFor] = useState<Visit | null>(null);
  const { data, loading, error } = useQuery(VISITS, { variables: { venueId: venue.id, page: 0, size } });
  const visits = data?.visits ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('visits.title')}</h1>
        {testimonials && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('visits.new')}
          </Button>
        )}
      </header>
      <p className="muted">{testimonials ? t('visits.introTestimonials') : t('visits.intro')}</p>

      <ErrorBanner error={error} />
      {loading && visits.length === 0 ? (
        <Loading />
      ) : visits.length === 0 ? (
        <Empty>{t('visits.empty')}</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('visits.visitor')}</th>
              <th>{t('visits.when')}</th>
              <th>{t('visits.amount')}</th>
              {testimonials && <th>{t('visits.campaign')}</th>}
              {testimonials && <th>{t('visits.testimonial')}</th>}
              {testimonials && <th aria-label={t('common.actions')} />}
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} testimonials={testimonials} onLink={() => setLinkFor(visit)} />
            ))}
          </tbody>
        </table>
      )}

      {visits.length === size && (
        <div className="more">
          <Button onClick={() => setSize(size + config.pageSize)} disabled={loading}>
            {t('common.showMore')}
          </Button>
        </div>
      )}

      {creating && (
        <NewVisitDialog
          onClose={() => setCreating(false)}
          onCreated={(visit) => {
            setCreating(false);
            setLinkFor(visit);
          }}
        />
      )}
      {linkFor && <VisitLinkDialog visit={linkFor} onClose={() => setLinkFor(null)} />}
    </section>
  );
}

function VisitRow({ visit, testimonials, onLink }: { visit: Visit; testimonials: boolean; onLink: () => void }) {
  const { t } = useI18n();
  const format = useFormat();
  const [remove, { loading, error }] = useMutation(DELETE_VISIT, { refetchQueries: ['Visits'] });

  function onDelete() {
    if (!window.confirm(t('visits.deleteConfirm', { name: visit.user.name }))) return;
    void remove({ variables: { id: visit.id } }).catch(() => undefined);
  }

  return (
    <tr>
      <td>
        <strong>{visit.user.name}</strong>
        <div className="muted small">
          {visit.user.phone ? <Mobile value={visit.user.phone} /> : <span dir="ltr">{visit.user.email}</span>}
        </div>
        <ErrorBanner error={error} />
      </td>
      <td>{format.dateTime(visit.visitDate)}</td>
      <td>{visit.amountRial != null ? format.toman(visit.amountRial) : <span className="muted">–</span>}</td>
      {testimonials && <td>{visit.campaign?.name ?? <span className="muted">{t('common.none')}</span>}</td>}
      {testimonials && (
        <td>
          {visit.testimonial ? (
            <Link to={`/testimonials?status=ALL&open=${visit.testimonial.id}`}>
              <StatusBadge status={visit.testimonial.status} />
            </Link>
          ) : (
            <span className="muted">{t('visits.notYet')}</span>
          )}
        </td>
      )}
      {testimonials && (
        <td className="row-actions">
          {!visit.testimonial && <Button onClick={onLink}>{t('visits.getLink')}</Button>}
          {!visit.testimonial && (
            <Button
              variant="ghost"
              disabled={loading}
              onClick={onDelete}
              aria-label={t('visits.deleteLabel', { name: visit.user.name })}
            >
              {t('common.delete')}
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}

function NewVisitDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (visit: Visit) => void }) {
  const { t } = useI18n();
  const { venue } = useCurrentVenue();
  const campaigns = useQuery(CAMPAIGNS, { variables: { venueId: venue.id, active: true, size: 100 } }).data?.campaigns;
  const [create, { loading, error }] = useMutation(CREATE_VISIT, { refetchQueries: ['Visits'] });
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    visitDate: new Date().toISOString() as string | null,
    campaignId: '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await create({
      variables: {
        input: {
          venueId: venue.id,
          visitDate: form.visitDate ?? new Date().toISOString(),
          campaignId: form.campaignId || null,
          visitor: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: toLatinDigits(form.phone.trim()) || null,
          },
        },
      },
    }).catch(() => null);
    if (result?.data) onCreated(result.data.createVisit);
  }

  return (
    <Dialog title={t('visits.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('visits.visitorName')}>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('visits.email')} hint={t('visits.emailHint')}>
          <input type="email" dir="ltr" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label={t('visits.phone')}>
          <input type="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('visits.time')}>
          <DateTimeInput
            label={t('visits.time')}
            required
            value={form.visitDate}
            onChange={(iso) => set('visitDate', iso)}
          />
        </Field>
        <Field label={t('visits.campaign')} hint={t('visits.campaignHint')}>
          <select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}>
            <option value="">{t('common.none')}</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {t('visits.add')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function VisitLinkDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const { t } = useI18n();
  const format = useFormat();
  const [issue, { data, loading, error }] = useMutation(ISSUE_VISIT_TOKEN);
  const [copied, setCopied] = useState(false);

  // A fresh token each time the dialog opens; older links keep working until they expire.
  useEffect(() => {
    void issue({ variables: { visitId: visit.id } }).catch(() => undefined);
  }, [issue, visit.id]);
  const token = data?.issueVisitToken;
  const link = token ? visitLink(token.token) : null;

  async function copy() {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  }

  return (
    <Dialog title={t('visits.linkFor', { name: visit.user.name })} onClose={onClose}>
      <ErrorBanner error={error} />
      {loading || !token ? (
        !error && <Loading />
      ) : (
        <div className="form">
          <p>{t('visits.linkIntro')}</p>
          <Field label={t('visits.link')} hint={t('visits.linkUntil', { date: format.dateTime(token.expiresAt) })}>
            <input readOnly dir="ltr" value={link ?? ''} onFocus={(e) => e.target.select()} />
          </Field>
          <div className="form-actions">
            {visit.user.email && link && (
              <a className="btn btn-secondary" href={mailtoLink(visit, link, t)}>
                {t('visits.emailIt')}
              </a>
            )}
            <Button variant="primary" onClick={copy}>
              {copied ? t('common.copied') : t('visits.copyLink')}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function mailtoLink(visit: Visit, link: string, t: Translate) {
  const subject = t('visits.mailSubject');
  const body = t('visits.mailBody', { name: visit.user.name, link });
  return `mailto:${visit.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
