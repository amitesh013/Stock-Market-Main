import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { useSession } from './session';

export interface LeaderboardEntry {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  portfolioValue: number;
  startingBalance: number;
  pnl: number;
  returnPct: number;
  [key: string]: any;
}

export function toLeaderboardRow(id: string, val: any): LeaderboardEntry {
  const start = Number(val.startingBalance || 100000);
  const portVal = Number(val.portfolioValue ?? val.currentCash ?? 100000);
  const pnl = portVal - start;
  const returnPct = start > 0 ? (pnl / start) * 100 : 0;
  return {
    id,
    ...val,
    portfolioValue: portVal,
    startingBalance: start,
    pnl,
    returnPct
  };
}

/** Participants of the current session, sorted by portfolio value. */
export function useLeaderboardUsers(): LeaderboardEntry[] {
  const { sessionId } = useSession();
  const [realUsers, setRealUsers] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setRealUsers([]);
    if (!sessionId) return;
    const unsub = onSnapshot(collection(db, 'sessions', sessionId, 'participants'), (snap) => {
      setRealUsers(snap.docs.map(d => toLeaderboardRow(d.id, d.data())));
    }, (err) => {
      console.error('Leaderboard fetch error:', err);
    });
    return unsub;
  }, [sessionId]);

  return useMemo(
    () => [...realUsers].sort((a, b) => b.portfolioValue - a.portfolioValue),
    [realUsers],
  );
}

/** The signed-in participant's live rank among non-admin participants. */
export function useMyStanding(): { rank: number | null; total: number; entry: LeaderboardEntry | null } {
  const { user } = useAuth();
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const idx = ranked.findIndex((u) => u.id === user?.uid);
  return { rank: idx >= 0 ? idx + 1 : null, total: ranked.length, entry: idx >= 0 ? ranked[idx] : null };
}

// Race progress: lowest portfolio near the start, leader near the finish.
export const PROGRESS_MIN = 0.18;
export const PROGRESS_MAX = 0.93;

export function makeProgressScale(values: number[]) {
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  return (value: number) =>
    maxVal > minVal
      ? PROGRESS_MIN + (PROGRESS_MAX - PROGRESS_MIN) * ((value - minVal) / (maxVal - minVal))
      : (PROGRESS_MIN + PROGRESS_MAX) / 2;
}
