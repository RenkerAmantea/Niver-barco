import { useState, useEffect, useCallback } from 'react';

export interface GuestSession {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

export function useSession() {
  const [session, setSessionState] = useState<GuestSession | null>(() => {
    try {
      const saved = localStorage.getItem('niver_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveSession = useCallback((newSession: GuestSession) => {
    localStorage.setItem('niver_session', JSON.stringify(newSession));
    setSessionState(newSession);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('niver_session');
    setSessionState(null);
  }, []);

  return { session, saveSession, clearSession };
}
