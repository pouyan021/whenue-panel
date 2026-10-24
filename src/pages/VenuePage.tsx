import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, ErrorBanner, Field, Loading } from '../components/ui';
import { UPDATE_VENUE, VENUE, type Venue } from '../graphql/operations';
import { useCurrentVenue } from '../lib/venue';

export function VenuePage() {
  const { venue } = useCurrentVenue();
  const { data, loading, error } = useQuery(VENUE, { variables: { id: venue.id } });

  return (
    <section>
      <header className="page-header">
        <h1>Venue details</h1>
      </header>
      <ErrorBanner error={error} />
      {loading ? <Loading /> : data?.venue && <VenueForm venue={data.venue} />}
    </section>
  );
}

function VenueForm({ venue }: { venue: Venue }) {
  const [update, { loading, error, data }] = useMutation(UPDATE_VENUE);
  const [form, setForm] = useState({
    name: venue.name,
    description: venue.description ?? '',
    address: venue.address,
    contactEmail: venue.contactEmail,
    contactPhone: venue.contactPhone ?? '',
    logo: venue.logo ?? '',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void update({
      variables: {
        id: venue.id,
        input: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          address: form.address.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim() || null,
          logo: form.logo.trim() || null,
        },
      },
    }).catch(() => undefined);
  }

  return (
    <form className="form card narrow" onSubmit={submit}>
      <Field label="Name">
        <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Description" hint="Visitors see this in the app.">
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Address">
        <input required value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Contact email">
          <input type="email" required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        </Field>
        <Field label="Contact phone">
          <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
        </Field>
      </div>
      <Field label="Logo URL">
        <input type="url" value={form.logo} onChange={(e) => set('logo', e.target.value)} />
      </Field>
      <ErrorBanner error={error} />
      <div className="form-actions">
        {data && !loading && <span className="muted">Saved</span>}
        <Button variant="primary" type="submit" disabled={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}
