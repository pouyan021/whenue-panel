import { useApolloClient } from '@apollo/client/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { onSessionChange, readSession, saveSession, type Session } from './session';

type AuthState = {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [session, setSession] = useState<Session | null>(() => readSession());

  useEffect(() => onSessionChange(setSession), []);

  // Sign out when the token runs out, even if the page sits idle.
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    // setTimeout fires at once for delays past ~24.8 days; staff tokens last hours anyway.
    if (ms > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => saveSession(null), Math.max(ms, 0));
    return () => clearTimeout(timer);
  }, [session]);

  // Nothing cached for one account may show for the next.
  useEffect(() => {
    if (!session) void client.clearStore();
  }, [session, client]);

  const signIn = useCallback((next: Session) => saveSession(next), []);
  const signOut = useCallback(() => saveSession(null), []);
  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth needs an AuthProvider');
  return auth;
}
