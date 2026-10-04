import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, SESSION_META_DOCS } from '../lib/shared-types';
import { Zap, Timer, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  sessionId?: string;
}

export default function NewsEventBanner({ sessionId }: Props) {
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('LOBBY');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!sessionId) { setActiveEvent(null); return; }
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.SESSIONS, sessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT),
      (snap) => setActiveEvent(snap.exists() ? snap.data() : null)
    );
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    return onSnapshot(
      doc(db, COLLECTIONS.SESSIONS, sessionId),
      (snap) => setSessionStatus(snap.data()?.status || 'LOBBY')
    );
  }, [sessionId]);

  useEffect(() => {
    if (!activeEvent || activeEvent.isExpired) { setCountdown(0); return; }
    const tick = () => {
      if (sessionStatus === 'PAUSED' || activeEvent.isPaused) {
        setCountdown(Number(activeEvent.pausedRemainingSeconds) || 0);
        return;
      }
      const exp = activeEvent.expiresAt?.toMillis?.();
      if (!exp) return;
      setCountdown(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEvent, sessionStatus]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (!activeEvent || activeEvent.isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-xl border border-zinc-200 text-[11px] text-zinc-500 font-semibold">
        <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block" />
        Normal Market — no active news event
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-zinc-600" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
            Market News Event Active
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono font-extrabold text-sm">
          <Timer className="w-4 h-4 opacity-50" />
          {fmt(countdown)}
        </div>
      </div>

      <p className="text-xs font-bold text-zinc-900 leading-snug">{activeEvent.headline}</p>
      <p className="text-[11px] text-zinc-600 leading-snug">{activeEvent.description}</p>

    </div>
  );
}
