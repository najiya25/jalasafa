/**
 * Prototype authentication state for the client (login/sign-up feature).
 *
 * Design rules (kept deliberately small and replaceable):
 *  • NEVER gates the finder — every route works for guests, and reports stay
 *    anonymous regardless of session state (a report never sends this session).
 *  • The session is stored in localStorage (`jalsafa.session`) as
 *    { status, token?, user? }. Only name + id are kept client-side.
 *  • On boot a stored token is validated with GET /api/auth/me: 401 → guest;
 *    network failure → keep the cached session (offline-tolerant).
 *  • Replaceable: swap signIn/signUp for an OIDC provider later — pages only
 *    interact with this hook, never with the transport.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, NetworkError } from './api';

const SESSION_KEY = 'jalsafa.session';

export interface SessionUser {
  id: string;
  name: string;
}

/** 'unknown' = first visit, no choice yet · 'guest' = explicitly browsing · 'user' = signed in. */
export type SessionStatus = 'unknown' | 'guest' | 'user';

interface StoredSession {
  status: SessionStatus;
  token?: string;
  user?: SessionUser;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.status !== 'user' && parsed.status !== 'guest') return null;
    if (parsed.status === 'user' && (!parsed.token || !parsed.user)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked — state still applies for this session */
  }
}

interface AuthValue {
  status: SessionStatus;
  user: SessionUser | null;
  token: string | null;
  /** POST /api/auth/login — throws Error with a friendly message on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /** POST /api/auth/signup — throws Error with a friendly message on failure. */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Explicit guest choice — hides the welcome bar; never blocks anything. */
  continueAsGuest: () => void;
  /** Client-side logout: drop the token (stateless sessions need no endpoint). */
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readSession());

  // Persist every change; null removes the key (sign-out / invalid token).
  useEffect(() => {
    writeSession(session);
  }, [session]);

  // Validate a stored token on boot. Fail-open: network errors keep the
  // cached session so the UI works offline; only an explicit 401 clears it.
  useEffect(() => {
    if (session?.status !== 'user' || !session.token) return;
    let cancelled = false;
    api
      .authMe(session.token)
      .then((user) => {
        if (cancelled) return;
        setSession((prev) =>
          prev?.status === 'user'
            ? { status: 'user', token: prev.token, user: { id: user.id, name: user.name } }
            : prev,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setSession({ status: 'guest' }); // expired/invalid token
        }
        // NetworkError (offline) → keep session as-is.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await api.authLogin({ email, password });
    setSession({ status: 'user', token: res.token, user: { id: res.user.id, name: res.user.name } });
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    const res = await api.authSignup({ name, email, password });
    setSession({ status: 'user', token: res.token, user: { id: res.user.id, name: res.user.name } });
  }, []);

  const continueAsGuest = useCallback((): void => {
    setSession((prev) => (prev?.status === 'user' ? prev : { status: 'guest' }));
  }, []);

  const signOut = useCallback((): void => {
    setSession({ status: 'guest' });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status: session?.status ?? 'unknown',
      user: session?.status === 'user' ? (session.user ?? null) : null,
      token: session?.status === 'user' ? (session.token ?? null) : null,
      signIn,
      signUp,
      continueAsGuest,
      signOut,
    }),
    [session, signIn, signUp, continueAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  // Fallback: behave as an undecided guest if no provider is mounted.
  return {
    status: 'unknown',
    user: null,
    token: null,
    signIn: async () => {
      throw new NetworkError();
    },
    signUp: async () => {
      throw new NetworkError();
    },
    continueAsGuest: () => undefined,
    signOut: () => undefined,
  };
}
