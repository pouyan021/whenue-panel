import { useQuery } from '@apollo/client/react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

import { ME, TESTIMONIAL_COUNTS, VENUES, type Me, type VenueSummary } from '../graphql/operations';
import { useAuth } from '../lib/auth';
import { readAdminVenue, saveAdminVenue, useCurrentVenue, VenueProvider } from '../lib/venue';
import { Button, Empty, ErrorBanner, Loading } from './ui';

/** Loads who is signed in and which venue to show, then renders the page inside the panel frame. */
export function Shell() {
  const { data, loading, error } = useQuery(ME);

  if (loading) return <Centered><Loading /></Centered>;
  if (error || !data?.me) return <Centered><ErrorBanner error={error ?? new Error('Not signed in')} /></Centered>;
  if (data.me.role === 'ADMIN') return <AdminShell me={data.me} />;
  if (!data.me.venue) return <Centered><Empty>This account is not linked to a venue.</Empty></Centered>;
  return <Frame me={data.me} venue={data.me.venue} />;
}

function AdminShell({ me }: { me: Me }) {
  const { data, loading, error } = useQuery(VENUES, { variables: { size: 200 } });
  const [venueId, setVenueId] = useState(readAdminVenue);

  if (loading) return <Centered><Loading /></Centered>;
  if (error) return <Centered><ErrorBanner error={error} /></Centered>;
  const venues = data?.venues ?? [];
  if (venues.length === 0) return <Centered><Empty>There are no venues yet.</Empty></Centered>;

  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  function pick(id: string) {
    saveAdminVenue(id);
    setVenueId(id);
  }
  return <Frame me={me} venue={venue} venues={venues} onPickVenue={pick} />;
}

function Frame({
  me,
  venue,
  venues,
  onPickVenue,
}: {
  me: Me;
  venue: VenueSummary;
  venues?: VenueSummary[];
  onPickVenue?: (id: string) => void;
}) {
  return (
    <VenueProvider value={{ me, venue }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">Whenue</div>
          {venues && onPickVenue ? (
            <label className="venue-picker">
              <span className="field-label">Venue</span>
              <select value={venue.id} onChange={(e) => onPickVenue(e.target.value)}>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="venue-name">{venue.name}</div>
          )}
          <Nav />
          <Account email={me.email} />
        </aside>
        <main className="content" key={venue.id}>
          <Outlet />
        </main>
      </div>
    </VenueProvider>
  );
}

function Nav() {
  const { venue } = useCurrentVenue();
  const { data } = useQuery(TESTIMONIAL_COUNTS, { variables: { venueId: venue.id } });
  const pending = data?.testimonialCounts.pending ?? 0;

  return (
    <nav className="nav">
      <NavLink to="/testimonials">
        Testimonials
        {pending > 0 && (
          <span className="nav-count" aria-label={`${pending} pending`}>
            {pending}
          </span>
        )}
      </NavLink>
      <NavLink to="/visits">Visits</NavLink>
      <NavLink to="/campaigns">Campaigns</NavLink>
      <NavLink to="/templates">Message templates</NavLink>
      <NavLink to="/venue">Venue details</NavLink>
    </nav>
  );
}

function Account({ email }: { email: string }) {
  const { signOut } = useAuth();
  return (
    <div className="account">
      <span className="muted" title={email}>
        {email}
      </span>
      <Button variant="ghost" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="centered">{children}</main>;
}
