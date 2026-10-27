import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { Me, OrganizationSummary } from '../graphql/operations';
import { I18nProvider, type Lang } from '../i18n/i18n';
import { VenueProvider } from '../lib/venue';

export const organization: OrganizationSummary = {
  id: '5',
  name: 'Luna Clinic',
  slug: 'luna',
  locale: 'fa-IR',
  timeZone: 'Asia/Tehran',
  modules: [
    { module: 'TESTIMONIALS', enabled: true },
    { module: 'REFERRALS', enabled: true },
  ],
};

export const staff: Me = {
  id: '1',
  email: 'staff@luna.test',
  role: 'VENUE_STAFF',
  organization,
  venue: { id: '3', name: 'Luna Vanak', organization },
};

export const orgAdmin: Me = { ...staff, id: '2', email: 'owner@luna.test', role: 'ORG_ADMIN', venue: null };

type Options = { path?: string; lang?: Lang; me?: Me };

/** Renders a page as signed-in staff of Luna Clinic's Vanak branch, in English unless asked otherwise. */
export function renderPage(page: ReactNode, mocks: MockLink.MockedResponse[], options: Options | string = {}) {
  const { path = '/', lang = 'en', me = staff } = typeof options === 'string' ? { path: options } : options;
  return render(
    <MockedProvider mocks={mocks}>
      <I18nProvider lang={lang}>
        <MemoryRouter initialEntries={[path]}>
          <VenueProvider value={{ me, venue: staff.venue! }}>{page}</VenueProvider>
        </MemoryRouter>
      </I18nProvider>
    </MockedProvider>,
  );
}
