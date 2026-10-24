// The staff token from whenue-api's login mutation, kept in localStorage so a reload
// stays signed in. It is a bearer token, so it is dropped as soon as it expires.

const KEY = 'whenue.session';

export type Session = { token: string; expiresAt: string };

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

export function readSession(now: Date = new Date()): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || new Date(session.expiresAt) <= now) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the session lasts until the tab closes.
  }
  listeners.forEach((listener) => listener(session));
}

export function onSessionChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
