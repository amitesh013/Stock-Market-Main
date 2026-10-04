/**
 * session.tsx — participant UI view of the current session.
 * Built on top of SessionContext (which resolves the sessionId); this adds the session doc,
 * the active news event and the participant's portfolio in the shape the M5 pages use.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { useSession as useSessionContext } from './SessionContext';
import { COLLECTIONS, SESSION_META_DOCS, SESSION_SUBCOLLECTIONS } from './shared-types';

export type SessionPhase = 'loading' | 'none' | 'ready';

export interface ParticipantSession {
  phase: SessionPhase;
  sessionId: string | null;
  sessionCode: string | null;
  sessionName: string | null;
  /** UI status: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED'. */
  sessionStatus: string;
  participantId: string | null;
  /** Session document plus `activeNewsEvent` (meta/activeEvent) and UI aliases. */
  config: any;
  /** This participant's sessions/{id}/portfolios/{uid} document. */
  participant: any | null;
  /** Clears the participant's current session so they can join another. */
  leave: () => Promise<void>;
}

const UI_STATUS: Record<string, string> = { LOBBY: 'NOT_STARTED', ENDED: 'COMPLETED' };
export const toUiStatus = (status: string | undefined) => UI_STATUS[status || 'LOBBY'] ?? status ?? 'NOT_STARTED';

const SessionDataContext = createContext<ParticipantSession | null>(null);

export function SessionDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { sessionId, sessionCode, sessionName, sessionStatus, sessionResolved } = useSessionContext();

  const [sessionDoc, setSessionDoc] = useState<any | null>(null);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [participant, setParticipant] = useState<any | null>(null);

  useEffect(() => {
    setSessionDoc(null);
    setActiveEvent(null);
    setParticipant(null);
    if (!sessionId) return;
    const unsubs = [
      onSnapshot(doc(db, COLLECTIONS.SESSIONS, sessionId), (snap) => setSessionDoc(snap.exists() ? snap.data() : {}),
        (err) => console.error('Session listener error:', err)),
      onSnapshot(doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.META, SESSION_META_DOCS.ACTIVE_EVENT),
        (snap) => setActiveEvent(snap.exists() ? snap.data() : null),
        (err) => console.error('Active event listener error:', err)),
    ];
    if (uid) {
      unsubs.push(onSnapshot(doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PORTFOLIOS, uid),
        (snap) => setParticipant(snap.exists() ? snap.data() : {}),
        (err) => console.error('Portfolio listener error:', err)));
    }
    return () => unsubs.forEach((u) => u());
  }, [sessionId, uid]);

  const leave = useCallback(async () => {
    if (!uid) return;
    await setDoc(doc(db, COLLECTIONS.USERS, uid), { currentSessionId: null }, { merge: true });
  }, [uid]);

  const value = useMemo<ParticipantSession>(() => {
    const loaded = !!sessionDoc && (!uid || !!participant);
    const phase: SessionPhase = !sessionResolved ? 'loading' : !sessionId ? 'none' : loaded ? 'ready' : 'loading';
    const status = toUiStatus(sessionStatus);
    const config = sessionDoc
      ? {
          ...sessionDoc,
          status,
          code: sessionCode,
          startingBalance: Number(sessionDoc.startingCash) || 100000,
          completedAt: sessionDoc.endedAt ?? null,
          activeNewsEvent: activeEvent,
        }
      : {};
    return {
      phase,
      sessionId,
      sessionCode: sessionCode || null,
      sessionName: sessionName || null,
      sessionStatus: status,
      participantId: sessionId ? uid : null,
      config,
      participant,
      leave,
    };
  }, [sessionResolved, sessionId, sessionCode, sessionName, sessionStatus, sessionDoc, activeEvent, participant, uid, leave]);

  return <SessionDataContext.Provider value={value}>{children}</SessionDataContext.Provider>;
}

export function useSession(): ParticipantSession {
  const ctx = useContext(SessionDataContext);
  if (!ctx) throw new Error('useSession must be used inside SessionDataProvider');
  return ctx;
}

/** This participant's balance in the current session. */
export function useParticipantBalance() {
  const { participant, config } = useSession();
  const startingBalance = Number(participant?.startingCash ?? config?.startingBalance) || 100000;
  const currentCash = Number(participant?.currentCash ?? startingBalance) || 0;
  return {
    loaded: !!participant,
    currentCash,
    portfolioValue: Number(participant?.portfolioValue ?? currentCash) || 0,
    startingBalance,
  };
}
