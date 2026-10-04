import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

// Starred stocks are a per-user UI preference, kept in this browser (no shared state is affected).
const keyFor = (uid: string) => `stotra-watchlist:${uid}`;

function read(uid: string): string[] {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const { user } = useAuth();
  const uid = user?.uid || 'anonymous';
  const [tickers, setTickers] = useState<string[]>(() => read(uid));

  useEffect(() => { setTickers(read(uid)); }, [uid]);

  const toggle = useCallback((ticker: string) => {
    setTickers((cur) => {
      const t = ticker.toUpperCase();
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch {}
      return next;
    });
  }, [uid]);

  const has = useCallback((ticker: string) => tickers.includes(ticker.toUpperCase()), [tickers]);

  return { tickers, toggle, has };
}
