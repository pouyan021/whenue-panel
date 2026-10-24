import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading, StatusBadge } from '../components/ui';
import { CAMPAIGNS, CREATE_VISIT, DELETE_VISIT, ISSUE_VISIT_TOKEN, VISITS, type Visit } from '../graphql/operations';
import { config, visitLink } from '../lib/config';
import { formatDateTime, fromLocalInput, toLocalInput } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

export function VisitsPage() {
  const { venue } = useCurrentVenue();
  const [size, setSize] = useState(config.pageSize);
  const [creating, setCreating] = useState(false);
  const [linkFor, setLinkFor] = useState<Visit | null>(null);
  const { data, loading, error } = useQuery(VISITS, { variables: { venueId: venue.id, page: 0, size } });
  const visits = data?.visits ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>Visits</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New visit
        </Button>
      </header>
      <p className="muted">Add a visit, then send the visitor their link to record a testimonial.</p>

      <ErrorBanner error={error} />
      {loading && visits.length === 0 ? (
        <Loading />
      ) : visits.length === 0 ? (
        <Empty>No visits yet.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Visit</th>
              <th>Campaign</th>
              <th>Testimonial</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} onLink={() => setLinkFor(visit)} />
            ))}
          </tbody>
        </table>
      )}

      {visits.length === size && (
        <div className="more">
          <Button onClick={() => setSize(size + config.pageSize)} disabled={loading}>
            Show more
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

function VisitRow({ visit, onLink }: { visit: Visit; onLink: () => void }) {
  const [remove, { loading, error }] = useMutation(DELETE_VISIT, { refetchQueries: ['Visits'] });

  function onDelete() {
    if (!window.confirm(`Delete ${visit.user.name}'s visit?`)) return;
    void remove({ variables: { id: visit.id } }).catch(() => undefined);
  }

  return (
    <tr>
      <td>
        <strong>{visit.user.name}</strong>
        <div className="muted small">{visit.user.email}</div>
        <ErrorBanner error={error} />
      </td>
      <td>{formatDateTime(visit.visitDate)}</td>
      <td>{visit.campaign?.name ?? <span className="muted">None</span>}</td>
      <td>
        {visit.testimonial ? (
          <Link to={`/testimonials?status=ALL&open=${visit.testimonial.id}`}>
            <StatusBadge status={visit.testimonial.status} />
          </Link>
        ) : (
          <span className="muted">Not yet</span>
        )}
      </td>
      <td className="row-actions">
        {!visit.testimonial && <Button onClick={onLink}>Get link</Button>}
        {!visit.testimonial && (
          <Button variant="ghost" disabled={loading} onClick={onDelete} aria-label={`Delete visit of ${visit.user.name}`}>
            Delete
          </Button>
        )}
      </td>
    </tr>
  );
}

function NewVisitDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (visit: Visit) => void }) {
  const { venue } = useCurrentVenue();
  const campaigns = useQuery(CAMPAIGNS, { variables: { venueId: venue.id, active: true, size: 100 } }).data?.campaigns;
  const [create, { loading, error }] = useMutation(CREATE_VISIT, { refetchQueries: ['Visits'] });
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    visitDate: toLocalInput(new Date().toISOString()),
    campaignId: '',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await create({
      variables: {
        input: {
          venueId: venue.id,
          visitDate: fromLocalInput(form.visitDate) ?? new Date().toISOString(),
          campaignId: form.campaignId || null,
          visitor: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null },
        },
      },
    }).catch(() => null);
    if (result?.data) onCreated(result.data.createVisit);
  }

  return (
    <Dialog title="New visit" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Visitor name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email" hint="A returning visitor with this email is reused.">
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Visit time">
          <input
            type="datetime-local"
            required
            value={form.visitDate}
            onChange={(e) => set('visitDate', e.target.value)}
          />
        </Field>
        <Field label="Campaign" hint="Its message template sets the link's text and lifetime.">
          <select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}>
            <option value="">None</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={loading}>
            Add visit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function VisitLinkDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
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
    <Dialog title={`Link for ${visit.user.name}`} onClose={onClose}>
      <ErrorBanner error={error} />
      {loading || !token ? (
        !error && <Loading />
      ) : (
        <div className="form">
          <p>Send this link to the visitor. It opens the Whenue app, where they record their testimonial.</p>
          <Field label="Visitor link" hint={`Works until ${formatDateTime(token.expiresAt)}.`}>
            <input readOnly value={link ?? ''} onFocus={(e) => e.target.select()} />
          </Field>
          <div className="form-actions">
            {visit.user.email && link && (
              <a className="btn btn-secondary" href={mailtoLink(visit, link)}>
                Email it
              </a>
            )}
            <Button variant="primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function mailtoLink(visit: Visit, link: string) {
  const subject = 'Tell us about your visit';
  const body = `Hi ${visit.user.name},\n\nThanks for visiting! Record a short video about your visit here:\n${link}\n`;
  return `mailto:${visit.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
