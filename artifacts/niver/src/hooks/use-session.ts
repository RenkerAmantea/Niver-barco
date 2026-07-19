import { useState, useEffect, useCallback } from 'react';

export interface GuestSession {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

const SESSION_KEY = 'niver_session';
const LAST_SESSION_KEY = 'niver_last_session';
const SESSION_EVENT = 'niver-session-changed';

function readSession(): GuestSession | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function readLastSession(): GuestSession | null {
  try { const saved = localStorage.getItem(LAST_SESSION_KEY); return saved ? JSON.parse(saved) : null; } catch { return null; }
}

export function useSession() {
  const [session, setSessionState] = useState<GuestSession | null>(readSession);
  const [lastSession, setLastSession] = useState<GuestSession | null>(readLastSession);

  useEffect(() => {
    const syncSession = () => setSessionState(readSession());
    window.addEventListener('storage', syncSession);
    window.addEventListener(SESSION_EVENT, syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(SESSION_EVENT, syncSession);
    };
  }, []);

  const saveSession = useCallback((newSession: GuestSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(newSession));
    setSessionState(newSession);
    setLastSession(newSession);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionState(null);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);

  const resumeLastSession = useCallback(() => { const previous = readLastSession(); if (previous) saveSession(previous); }, [saveSession]);

  return { session, lastSession, saveSession, clearSession, resumeLastSession };
}
