import { useEffect, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaderboardEntry, useLeaderboardUsers } from './leaderboard';
import { useSession } from './session';

/**
 * Final standings, locked once the competition is complete: values are captured from the first
 * snapshot and only re-captured if the set of participants changes (e.g. data still loading).
 */
export function useFinalStandings(isComplete: boolean): LeaderboardEntry[] {
  const live = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const lockRef = useRef<{ key: string; rows: LeaderboardEntry[] } | null>(null);

  if (!isComplete) {
    lockRef.current = null;
    return [];
  }
  const key = live.map((u) => u.id).sort().join('|');
  if (!lockRef.current || lockRef.current.key !== key) {
    lockRef.current = { key, rows: live.map((u) => ({ ...u })) };
  }
  return lockRef.current.rows;
}

/** Executed-trade count per participant, read once from the transactions collection. */
export function useTradeCounts(enabled: boolean): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const { sessionId } = useSession();

  useEffect(() => {
    setCounts(null);
    if (!enabled || !sessionId) return;
    let cancelled = false;
    getDocs(collection(db, 'sessions', sessionId, 'transactions'))
      .then((snap) => {
        const map: Record<string, number> = {};
        snap.forEach((d) => {
          const uid = d.data().userId;
          if (uid) map[uid] = (map[uid] || 0) + 1;
        });
        if (!cancelled) setCounts(map);
      })
      .catch((err) => console.warn('Trade count notice:', err));
    return () => { cancelled = true; };
  }, [enabled, sessionId]);

  return counts;
}

/** Same CSV format as the end-of-simulation podium export, plus trade counts when available. */
export function exportFinalStandingsCsv(rows: LeaderboardEntry[], trades: Record<string, number> | null) {
  let csv = 'Final Rank,Trader Name,Email,Role,Starting Balance,Final Portfolio Value,Total P&L ($),Return (%)' + (trades ? ',Trades' : '') + '\n';
  rows.forEach((u, i) => {
    csv += `${i + 1},"${u.name || ''}","${u.email || ''}","${u.role || 'participant'}",${u.startingBalance},${u.portfolioValue.toFixed(2)},${u.pnl.toFixed(2)},${u.returnPct.toFixed(2)}%`;
    csv += trades ? `,${trades[u.id] || 0}\n` : '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `final-simulation-standings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Stepped reveal for the results sequence; jumps to the final step under reduced motion. */
export function useRevealSequence(active: boolean, delays: number[]): number {
  const [step, setStep] = useState(() =>
    active && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? delays.length : 0,
  );
  useEffect(() => {
    if (!active) { setStep(0); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setStep(delays.length); return; }
    const timers = delays.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return step;
}
