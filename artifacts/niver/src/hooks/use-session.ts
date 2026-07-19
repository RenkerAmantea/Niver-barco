import { useState, useEffect, useCallback } from 'react';

export interface GuestSession {
  id: number;
  name: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  adminToken?: string;
}

const SESSION_KEY = 'niver_session';
const LAST_SESSION_KEY = 'niver_last_session';
const DEVICE_SESSIONS_KEY = 'niver_device_sessions';
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

function readDeviceSessions(): GuestSession[] {
  try {
    const saved = localStorage.getItem(DEVICE_SESSIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((item): item is GuestSession => Boolean(item && Number.isFinite(item.id) && item.name));
    }
    // One-time migration for browsers that already have the previous single-profile shortcut.
    const previous = readLastSession();
    return previous ? [previous] : [];
  } catch {
    return [];
  }
}

function writeDeviceSessions(sessions: GuestSession[]) {
  localStorage.setItem(DEVICE_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 12)));
}

export function useSession() {
  const [session, setSessionState] = useState<GuestSession | null>(readSession);
  const [lastSession, setLastSession] = useState<GuestSession | null>(readLastSession);
  const [deviceSessions, setDeviceSessions] = useState<GuestSession[]>(readDeviceSessions);

  useEffect(() => {
    const syncSession = () => {
      setSessionState(readSession());
      setLastSession(readLastSession());
      setDeviceSessions(readDeviceSessions());
    };
    window.addEventListener('storage', syncSession);
    window.addEventListener(SESSION_EVENT, syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(SESSION_EVENT, syncSession);
    };
  }, []);

  const saveSession = useCallback((newSession: GuestSession) => {
    const current = readDeviceSessions();
    const nextDeviceSessions = [newSession, ...current.filter((saved) => saved.id !== newSession.id)].slice(0, 12);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(newSession));
    writeDeviceSessions(nextDeviceSessions);
    setSessionState(newSession);
    setLastSession(newSession);
    setDeviceSessions(nextDeviceSessions);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionState(null);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);

  const resumeLastSession = useCallback(() => { const previous = readLastSession(); if (previous) saveSession(previous); }, [saveSession]);

  const forgetDeviceSession = useCallback((guestId: number) => {
    const nextDeviceSessions = readDeviceSessions().filter((saved) => saved.id !== guestId);
    writeDeviceSessions(nextDeviceSessions);
    if (readLastSession()?.id === guestId) {
      localStorage.removeItem(LAST_SESSION_KEY);
      setLastSession(null);
    }
    setDeviceSessions(nextDeviceSessions);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }, []);

  return { session, lastSession, deviceSessions, saveSession, clearSession, resumeLastSession, forgetDeviceSession };
}
