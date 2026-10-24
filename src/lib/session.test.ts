import { describe, expect, it, vi } from 'vitest';

import { visitLink } from './config';
import { onSessionChange, readSession, saveSession } from './session';

describe('session', () => {
  it('keeps a token until it expires', () => {
    saveSession({ token: 'tok', expiresAt: '2030-01-01T00:00:00Z' });

    expect(readSession(new Date('2029-12-31T23:59:00Z'))?.token).toBe('tok');
    expect(readSession(new Date('2030-01-01T00:00:01Z'))).toBeNull();
    // An expired token is removed, not just ignored.
    expect(localStorage.getItem('whenue.session')).toBeNull();
  });

  it('tells listeners about sign-in and sign-out', () => {
    const listener = vi.fn();
    const stop = onSessionChange(listener);

    saveSession({ token: 'tok', expiresAt: '2030-01-01T00:00:00Z' });
    saveSession(null);
    stop();
    saveSession(null);

    expect(listener.mock.calls).toEqual([[{ token: 'tok', expiresAt: '2030-01-01T00:00:00Z' }], [null]]);
  });
});

describe('visitLink', () => {
  it('appends the encoded token to the app link', () => {
    expect(visitLink('a.b-c_d', 'whenue://visit/')).toBe('whenue://visit/a.b-c_d');
  });
});
