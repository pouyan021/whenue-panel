import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { Me } from '../graphql/operations';
import { VenueProvider } from '../lib/venue';

export const staff: Me = {
  id: '1',
  email: 'staff@cafe.test',
  role: 'VENUE_STAFF',
  venue: { id: '3', name: 'Cafe Luna' },
};

/** Renders a page as signed-in venue staff of Cafe Luna, with the given GraphQL mocks. */
export function renderPage(page: ReactNode, mocks: MockLink.MockedResponse[], path = '/') {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[path]}>
        <VenueProvider value={{ me: staff, venue: staff.venue! }}>{page}</VenueProvider>
      </MemoryRouter>
    </MockedProvider>,
  );
}
