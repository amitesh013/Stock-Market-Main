/**
 * SessionContext.tsx
 * Central context that resolves the active sessionId for every component.
 * All data components import useSession() instead of duplicating session-lookup logic.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './shared-types';
import { useAuth } from '../components/AuthProvider';

interface SessionContextType {
  sessionId: string | null;
  sessionStatus: string;   // 'LOBBY' | 'RUNNING' | 'PAUSED' | 'ENDED'
  sessionCode: string;
  sessionName: string;
  sessionResolved: boolean;
}

const SessionContext = createContext<SessionContextType>({
  sessionId: null,
  sessionStatus: 'LOBBY',
  sessionCode: '',
  sessionName: '',
  sessionResolved: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();
  const { user, userData } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('LOBBY');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionResolved, setSessionResolved] = useState(false);

  // Participants stay bound to the authenticated user's persisted session.
  // The route parameter is only used for admin session-scoped layouts.
  useEffect(() => {
    const resolved = userData?.role === 'participant'
      ? userData.currentSessionId || null
      : routeSessionId || userData?.currentSessionId || null;
    setSessionId(resolved ?? null);
    setSessionResolved(true);
  }, [routeSessionId, userData?.currentSessionId]);

  // Watch the session doc
  useEffect(() => {
    if (!sessionId) {
      setSessionStatus('LOBBY');
      setSessionCode('');
      setSessionName('');
      return;
    }
    const unsub = onSnapshot(doc(db, COLLECTIONS.SESSIONS, sessionId), (snap) => {
      if (!snap.exists()) {
        setSessionStatus('ENDED');
        return;
      }
      const d = snap.data();
      const nextStatus = d.status || 'LOBBY';
      setSessionStatus(nextStatus);
      setSessionCode(d.sessionCode || '');
      setSessionName(d.name || '');

      if (userData?.role === 'participant' && nextStatus === 'ENDED' && user) {
        void setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
          currentSessionId: null,
        }, { merge: true });
        setSessionId(null);
      }
    });
    return () => unsub();
  }, [sessionId, user, userData?.role]);

  return (
    <SessionContext.Provider value={{ sessionId, sessionStatus, sessionCode, sessionName, sessionResolved }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
