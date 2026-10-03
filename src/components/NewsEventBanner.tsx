import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, SIMULATION_DOCS } from '../lib/shared-types';
import { Zap, Timer, TrendingUp, TrendingDown } from 'lucide-react';

export default function NewsEventBanner() {
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.ACTIVE_EVENT),
      (snap) => setActiveEvent(snap.exists() ? snap.data() : null)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeEvent || activeEvent.isExpired) { setCountdown(0); return; }
    const tick = () => {
      const exp = activeEvent.expiresAt?.toMillis?.();
      if (!exp) return;
      setCountdown(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEvent]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (!activeEvent || activeEvent.isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-xl border border-zinc-200 text-[11px] text-zinc-500 font-semibold">
        <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block" />
        Normal Market Mode
      </div>
    );
  }

  const isPos = activeEvent.type === 'POSITIVE';
  const isMixed = activeEvent.type === 'MIXED';

  return (
    <div className={`rounded-2xl border px-4 py-3 space-y-2 ${
      isPos ? 'bg-emerald-50 border-emerald-200' :
      isMixed ? 'bg-amber-50 border-amber-200' :
      'bg-rose-50 border-rose-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPos ? (
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-600" />
          )}
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
            isPos ? 'text-emerald-700' : isMixed ? 'text-amber-700' : 'text-rose-700'
          }`}>
            {isPos ? 'Positive' : isMixed ? 'Mixed' : 'Negative'} News Event Active
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono font-extrabold text-sm">
          <Timer className="w-4 h-4 opacity-50" />
          {fmt(countdown)}
        </div>
      </div>

      <p className="text-xs font-semibold text-zinc-800 leading-snug">
        {activeEvent.headline}
      </p>
      <p className="text-[11px] text-zinc-600 leading-snug">
        {activeEvent.description}
      </p>

      <div className="flex flex-wrap gap-1 pt-0.5">
        {(activeEvent.affectedStocks || []).map((s: any) => (
          <span
            key={s.ticker}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              s.strength.includes('UP')
                ? 'bg-green-100 text-green-700 border-green-200'
                : s.strength === 'NO_IMPACT'
                ? 'bg-zinc-100 text-zinc-500 border-zinc-200'
                : 'bg-red-100 text-red-700 border-red-200'
            }`}
          >
            {s.ticker} {s.strength.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}
