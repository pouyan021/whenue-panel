import { useQuery } from '@apollo/client/react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

import { ME, TESTIMONIAL_COUNTS, VENUES, type Me, type VenueSummary } from '../graphql/operations';
import { langOf, useI18n } from '../i18n/i18n';
import { useAuth } from '../lib/auth';
import { useFormat } from '../lib/format';
import { readAdminVenue, saveAdminVenue, useCurrentVenue, VenueProvider } from '../lib/venue';
import { Button, Empty, ErrorBanner, Loading } from './ui';

/** Loads who is signed in and which branch to show, then renders the page inside the panel frame. */
export function Shell() {
  const { t } = useI18n();
  const { data, loading, error } = useQuery(ME);

  if (loading) return <Centered><Loading /></Centered>;
  if (error || !data?.me) return <Centered><ErrorBanner error={error ?? new Error(t('error.notSignedIn'))} /></Centered>;
  if (data.me.role !== 'VENUE_STAFF') return <PickerShell me={data.me} />;
  if (!data.me.venue) return <Centered><Empty>{t('shell.noVenue')}</Empty></Centered>;
  return <Frame me={data.me} venue={data.me.venue} />;
}

/** Admins and organization admins look at one branch at a time and can switch. */
function PickerShell({ me }: { me: Me }) {
  const { t } = useI18n();
  const { data, loading, error } = useQuery(VENUES, { variables: { size: 200 } });
  const [venueId, setVenueId] = useState(readAdminVenue);

  if (loading) return <Centered><Loading /></Centered>;
  if (error) return <Centered><ErrorBanner error={error} /></Centered>;
  const venues = data?.venues ?? [];
  if (venues.length === 0) return <Centered><Empty>{t('shell.noVenues')}</Empty></Centered>;

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
  const { t, adoptDefault } = useI18n();
  const locale = venue.organization.locale;
  useEffect(() => adoptDefault(langOf(locale)), [adoptDefault, locale]);

  return (
    <VenueProvider value={{ me, venue }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            {venue.organization.name}
            <span className="brand-sub">{t('shell.brand')}</span>
          </div>
          {venues && onPickVenue && venues.length > 1 ? (
            <label className="venue-picker">
              <span className="field-label">{t('shell.branch')}</span>
              <VenuePicker venues={venues} value={venue.id} onChange={onPickVenue} />
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

/** Branches grouped by organization, which only platform admins see more than one of. */
function VenuePicker({ venues, value, onChange }: { venues: VenueSummary[]; value: string; onChange: (id: string) => void }) {
  const groups = new Map<string, VenueSummary[]>();
  for (const v of venues) groups.set(v.organization.name, [...(groups.get(v.organization.name) ?? []), v]);
  const options = (list: VenueSummary[]) =>
    list.map((v) => (
      <option key={v.id} value={v.id}>
        {v.name}
      </option>
    ));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.size === 1
        ? options(venues)
        : [...groups].map(([name, list]) => (
            <optgroup key={name} label={name}>
              {options(list)}
            </optgroup>
          ))}
    </select>
  );
}

function Nav() {
  const { t } = useI18n();
  const { venue, canManage, hasModule } = useCurrentVenue();
  const testimonials = hasModule('TESTIMONIALS');

  return (
    <nav className="nav">
      <NavSection label={t('nav.section.desk')}>
        <NavLink to="/check-in">{t('nav.checkIn')}</NavLink>
        <NavLink to="/members">{t('nav.members')}</NavLink>
        <NavLink to="/visits">{t('nav.visits')}</NavLink>
      </NavSection>
      <NavSection label={t('nav.section.club')}>
        <NavLink to="/rewards">{t('nav.rewards')}</NavLink>
        {testimonials && <TestimonialsLink venueId={venue.id} />}
        {testimonials && <NavLink to="/campaigns">{t('nav.campaigns')}</NavLink>}
        {testimonials && <NavLink to="/templates">{t('nav.templates')}</NavLink>}
      </NavSection>
      <NavSection label={t('nav.section.settings')}>
        <NavLink to="/branch">{t('nav.branch')}</NavLink>
        {canManage && <NavLink to="/club">{t('nav.club')}</NavLink>}
        {canManage && <NavLink to="/integrations">{t('nav.integrations')}</NavLink>}
      </NavSection>
    </nav>
  );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="nav-section">
      <span className="nav-section-label">{label}</span>
      {children}
    </div>
  );
}

function TestimonialsLink({ venueId }: { venueId: string }) {
  const { t } = useI18n();
  const format = useFormat();
  const { data } = useQuery(TESTIMONIAL_COUNTS, { variables: { venueId } });
  const pending = data?.testimonialCounts.pending ?? 0;
  return (
    <NavLink to="/testimonials">
      {t('nav.testimonials')}
      {pending > 0 && (
        <span className="nav-count" aria-label={t('nav.pending', { count: pending })}>
          {format.number(pending)}
        </span>
      )}
    </NavLink>
  );
}

function Account({ email }: { email: string }) {
  const { signOut } = useAuth();
  const { t } = useI18n();
  return (
    <div className="account">
      <LanguageSwitch />
      <span className="muted" title={email} dir="ltr">
        {email}
      </span>
      <Button variant="ghost" onClick={signOut}>
        {t('shell.signOut')}
      </Button>
    </div>
  );
}

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  // Each name in its own language, so either reader finds theirs.
  return (
    <div className="lang-switch" role="group" aria-label="Language / زبان">
      <button type="button" aria-pressed={lang === 'fa'} lang="fa" onClick={() => setLang('fa')}>
        فارسی
      </button>
      <button type="button" aria-pressed={lang === 'en'} lang="en" onClick={() => setLang('en')}>
        English
      </button>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="centered">{children}</main>;
}
