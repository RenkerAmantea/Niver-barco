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
const CANONICAL_ORIGIN = 'https://renker-niver-barco.vercel.app';
const LEGACY_ORIGIN = 'https://niver-barco.vercel.app';
const MIGRATION_HASH = '#niver-profile-migration=';

function isGuestSession(value: unknown): value is GuestSession {
  return Boolean(value && typeof value === 'object' && Number.isFinite((value as GuestSession).id) && (value as GuestSession).name);
}

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

function encodeMigration(payload: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeMigration(payload: string): unknown {
  return JSON.parse(decodeURIComponent(escape(atob(payload))));
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

  // The renamed app has a different browser origin. Modern Chrome isolates old
  // origin storage, so an old installed app transfers its own local profile to
  // the new URL once. The fragment never reaches the server and is erased as
  // soon as the new app has imported it.
  useEffect(() => {
    if (window.location.origin === CANONICAL_ORIGIN && window.location.hash.startsWith(MIGRATION_HASH)) {
      try {
        const payload = decodeMigration(window.location.hash.slice(MIGRATION_HASH.length)) as { session?: unknown; lastSession?: unknown; deviceSessions?: unknown };
        const imported = [payload.session, payload.lastSession, ...(Array.isArray(payload.deviceSessions) ? payload.deviceSessions : [])]
          .filter(isGuestSession)
          .filter((candidate, index, list) => list.findIndex((item) => item.id === candidate.id) === index);
        const transferredSession = isGuestSession(payload.session) ? payload.session : null;
        if (!imported.length) return;
        const existing = readDeviceSessions();
        const merged = [...imported, ...existing.filter((saved) => !imported.some((legacy) => legacy.id === saved.id))].slice(0, 12);
        writeDeviceSessions(merged);
        if (!readSession() && transferredSession) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(transferredSession));
          localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(transferredSession));
        }
        setSessionState(readSession());
        setLastSession(readLastSession());
        setDeviceSessions(readDeviceSessions());
        window.dispatchEvent(new Event(SESSION_EVENT));
      } catch {
        // A malformed handoff should never block normal login.
      } finally {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      return;
    }

    if (window.location.origin === LEGACY_ORIGIN) {
      const current = readSession();
      const last = readLastSession();
      const profiles = readDeviceSessions();
      if (!current && !last && !profiles.length) return;
      try {
        const handoff = encodeMigration({ session: current, lastSession: last, deviceSessions: profiles });
        window.location.replace(`${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${MIGRATION_HASH}${handoff}`);
      } catch {
        // Leave the old app usable if the browser cannot encode local data.
      }
    }
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
