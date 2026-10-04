import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
// Firestore contract (M5):
//   sessions/{sessionId}: { code, name, status: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED',
//     acceptingParticipants, startingBalance, startedAt, endTime, completedAt,
//     activeNewsEvent, nextNewsEvent, createdAt }
//   sessions/{sessionId}/participants/{uid}: { userId, name, email, currentCash, portfolioValue,
//     startingBalance, joinedAt }
//   holdings/{sessionId}_{uid}_{stockId}, transactions/*, news/*: carry `sessionId`.
// Prices (`stocks`, `price_history`) are one shared market feed; charts clip it to the session window.

export type SessionPhase = 'loading' | 'none' | 'ready';
export type JoinErrorCode = 'NOT_FOUND' | 'CLOSED' | 'INVALID' | 'UNAVAILABLE';

export class JoinError extends Error {
  constructor(public code: JoinErrorCode) {
    super(code);
  }
}

export interface ParticipantSession {
  phase: SessionPhase;
  sessionId: string | null;
  sessionCode: string | null;
  sessionName: string | null;
  /** Effective status: a RUNNING session whose end time has passed reads as COMPLETED. */
  sessionStatus: string;
  participantId: string | null;
  /** Session document (status, timing, active event); empty when there is no session. */
  config: any;
  /** This participant's per-session balance document. */
  participant: any | null;
  join: (code: string) => Promise<void>;
  leave: () => void;
}

const storageKey = (uid: string) => `stotra-session:${uid}`;
const readStored = (uid: string) => {
  try { return window.localStorage.getItem(storageKey(uid)); } catch { return null; }
};
const writeStored = (uid: string, sessionId: string | null) => {
  try {
    if (sessionId) window.localStorage.setItem(storageKey(uid), sessionId);
    else window.localStorage.removeItem(storageKey(uid));
  } catch {}
};

export const normalizeSessionCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, '');
export const isValidSessionCode = (code: string) => /^[A-Z0-9-]{3,24}$/.test(code);

const toMs = (v: any): number =>
  v?.toMillis ? v.toMillis() : typeof v?.seconds === 'number' ? v.seconds * 1000 : typeof v === 'number' ? v : 0;

export function effectiveStatus(config: any, now = Date.now()): string {
  const status = config?.status || 'NOT_STARTED';
  const end = toMs(config?.endTime);
  return status === 'RUNNING' && end > 0 && now >= end ? 'COMPLETED' : status;
}

export const isSessionClosed = (data: any) => data?.status === 'COMPLETED' || data?.acceptingParticipants === false;

/** The current session id outside React (trade execution); set by the provider. */
let currentSessionId: string | null = null;
export const getCurrentSessionId = () => currentSessionId;

const SessionContext = createContext<ParticipantSession | null>(null);

export function ParticipantSessionProvider({ children }: { children: React.ReactNode }) {
  const { user, userData, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [config, setConfig] = useState<any>({});
  const [participant, setParticipant] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());

  // Restore: a stored id is only a hint; the session and membership are re-validated server-side.
  useEffect(() => {
    setSessionId(null);
    setConfig({});
    setParticipant(null);
    if (authLoading) { setPhase('loading'); return; }
    if (!uid) { setPhase('none'); return; }
    const stored = readStored(uid);
    if (!stored) { setPhase('none'); return; }

    let cancelled = false;
    setPhase('loading');
    Promise.all([getDoc(doc(db, 'sessions', stored)), getDoc(doc(db, 'sessions', stored, 'participants', uid))])
      .then(([s, p]) => {
        if (cancelled) return;
        if (s.exists() && p.exists()) {
          setSessionId(stored);
        } else {
          writeStored(uid, null);
          setPhase('none');
        }
      })
      .catch(() => {
        if (cancelled) return;
        writeStored(uid, null);
        setPhase('none');
      });
    return () => { cancelled = true; };
  }, [uid, authLoading]);

  // Live session + membership. Losing either (deleted session, removed participant) drops back to /join.
  useEffect(() => {
    if (!sessionId || !uid) return;
    let haveSession = false;
    let haveParticipant = false;
    const drop = () => {
      writeStored(uid, null);
      setSessionId(null);
      setConfig({});
      setParticipant(null);
      setPhase('none');
    };
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return drop();
      setConfig(snap.data());
      haveSession = true;
      if (haveParticipant) setPhase('ready');
    }, drop);
    const unsubParticipant = onSnapshot(doc(db, 'sessions', sessionId, 'participants', uid), (snap) => {
      if (!snap.exists()) return drop();
      setParticipant(snap.data());
      haveParticipant = true;
      if (haveSession) setPhase('ready');
    }, drop);
    return () => {
      unsubSession();
      unsubParticipant();
    };
  }, [sessionId, uid]);

  const endMs = toMs(config?.endTime);
  useEffect(() => {
    if (!endMs || config?.status !== 'RUNNING') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endMs, config?.status]);

  const join = useCallback(async (raw: string) => {
    if (!uid) throw new JoinError('UNAVAILABLE');
    const code = normalizeSessionCode(raw);
    if (!isValidSessionCode(code)) throw new JoinError('INVALID');

    let found;
    try {
      found = await getDocs(query(collection(db, 'sessions'), where('code', '==', code), limit(1)));
    } catch {
      throw new JoinError('UNAVAILABLE');
    }
    if (found.empty) throw new JoinError('NOT_FOUND');
    const sessionDoc = found.docs[0];
    const data = sessionDoc.data();

    const participantRef = doc(db, 'sessions', sessionDoc.id, 'participants', uid);
    let isMember = false;
    try {
      isMember = (await getDoc(participantRef)).exists();
    } catch {
      isMember = false;
    }

    if (!isMember) {
      if (isSessionClosed(data)) throw new JoinError('CLOSED');
      const start = Number(data.startingBalance) || 100000;
      try {
        await setDoc(participantRef, {
          userId: uid,
          name: userData?.name || user?.displayName || 'Trader',
          email: userData?.email || user?.email || '',
          currentCash: start,
          portfolioValue: start,
          startingBalance: start,
          joinedAt: serverTimestamp(),
        });
      } catch {
        throw new JoinError('UNAVAILABLE');
      }
    }

    // Switching: clear the previous session before the new one loads so nothing from it renders.
    setConfig({});
    setParticipant(null);
    setPhase('loading');
    writeStored(uid, sessionDoc.id);
    setSessionId(sessionDoc.id);
  }, [uid, userData?.name, userData?.email, user?.displayName, user?.email]);

  const leave = useCallback(() => {
    if (uid) writeStored(uid, null);
    setSessionId(null);
    setConfig({});
    setParticipant(null);
    setPhase('none');
  }, [uid]);

  const value = useMemo<ParticipantSession>(() => {
    const active = phase === 'ready' ? sessionId : null;
    return {
      phase,
      sessionId: active,
      sessionCode: active ? config?.code ?? null : null,
      sessionName: active ? config?.name ?? null : null,
      sessionStatus: active ? effectiveStatus(config, now) : 'NOT_STARTED',
      participantId: active ? uid : null,
      config: active ? config : {},
      participant: active ? participant : null,
      join,
      leave,
    };
  }, [phase, sessionId, config, participant, uid, now, join, leave]);

  currentSessionId = value.sessionId;

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): ParticipantSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside ParticipantSessionProvider');
  return ctx;
}

/** This participant's balances for the current session (zeros until loaded). */
export function useParticipantBalance() {
  const { participant } = useSession();
  const startingBalance = Number(participant?.startingBalance) || 100000;
  const currentCash = participant ? Number(participant.currentCash ?? startingBalance) : 0;
  const portfolioValue = participant ? Number(participant.portfolioValue ?? currentCash) : 0;
  return { loaded: !!participant, currentCash, portfolioValue, startingBalance };
}
