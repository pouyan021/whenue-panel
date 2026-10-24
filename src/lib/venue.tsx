import { createContext, useContext, type ReactNode } from 'react';

import type { Me, VenueSummary } from '../graphql/operations';

export type CurrentVenue = {
  me: Me;
  venue: VenueSummary;
};

const VenueContext = createContext<CurrentVenue | null>(null);

export function VenueProvider({ value, children }: { value: CurrentVenue; children: ReactNode }) {
  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

/** The venue the panel is showing: a venue staff member's own, or the one an admin picked. */
export function useCurrentVenue() {
  const current = useContext(VenueContext);
  if (!current) throw new Error('useCurrentVenue needs a VenueProvider');
  return current;
}

const ADMIN_VENUE_KEY = 'whenue.adminVenue';

export function readAdminVenue(): string | null {
  try {
    return localStorage.getItem(ADMIN_VENUE_KEY);
  } catch {
    return null;
  }
}

export function saveAdminVenue(id: string) {
  try {
    localStorage.setItem(ADMIN_VENUE_KEY, id);
  } catch {
    // Not remembered across reloads; the admin picks again.
  }
}
