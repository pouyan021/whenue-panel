import { createContext, useContext, type ReactNode } from 'react';

import type { ClubModule, Me, OrganizationSummary, VenueSummary } from '../graphql/operations';

export type CurrentVenue = {
  me: Me;
  venue: VenueSummary;
};

export const VenueContext = createContext<CurrentVenue | null>(null);

export function VenueProvider({ value, children }: { value: CurrentVenue; children: ReactNode }) {
  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

/** The branch the panel is showing: a venue staff member's own, or the one an admin picked. */
export function useCurrentVenue() {
  const current = useContext(VenueContext);
  if (!current) throw new Error('useCurrentVenue needs a VenueProvider');
  const organization = current.venue.organization;
  return {
    ...current,
    organization,
    /** Organization admins and platform admins run the club; venue staff work the desk. */
    canManage: current.me.role !== 'VENUE_STAFF',
    hasModule: (module: ClubModule) => hasModule(organization, module),
  };
}

export function hasModule(organization: OrganizationSummary, module: ClubModule) {
  return organization.modules.some((m) => m.module === module && m.enabled);
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
