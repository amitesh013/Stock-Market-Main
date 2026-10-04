import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { useSession, useParticipantBalance } from './session';

export interface LiveStock {
  id: string;
  ticker: string;
  name: string;
  sector?: string;
  currentPrice: number;
  dayOpen: number;
  changePercent: number;
  history: number[];
  [key: string]: any;
}

const HISTORY_LENGTH = 24;

/** Active stocks with a short in-memory price history built from realtime updates. */
export function useStocks(): LiveStock[] {
  const [stocks, setStocks] = useState<LiveStock[]>([]);
  const historyRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'stocks'), where('isActive', '==', true));
    return onSnapshot(q, (snap) => {
      const byTicker = new Map<string, any>();
      snap.docs.forEach((d) => {
        const s = { id: d.id, ...d.data() } as any;
        if ((s.sector || '').toLowerCase().includes('crypto')) return;
        const ticker = (s.ticker || '').trim().toUpperCase();
        if (!ticker) return;
        const existing = byTicker.get(ticker);
        const t = s.lastUpdated?.seconds || s.createdAt?.seconds || 0;
        const te = existing?.lastUpdated?.seconds || existing?.createdAt?.seconds || 0;
        if (!existing || t >= te) byTicker.set(ticker, { ...s, ticker });
      });

      const list: LiveStock[] = Array.from(byTicker.values()).map((s) => {
        const price = Number(s.currentPrice) || 0;
        const dayOpen = Number(s.dayOpenPrice || s.basePrice || s.startingPrice || price);
        const changePercent =
          s.changePercent !== undefined
            ? Number(s.changePercent)
            : dayOpen > 0 ? ((price - dayOpen) / dayOpen) * 100 : 0;

        const prev = historyRef.current[s.id] || [dayOpen];
        const next = prev[prev.length - 1] === price ? prev : [...prev, price].slice(-HISTORY_LENGTH);
        historyRef.current[s.id] = next;

        return { ...s, currentPrice: price, dayOpen, changePercent, history: next };
      });

      setStocks(list);
    }, (err) => console.error('Stocks listener error:', err));
  }, []);

  return stocks;
}

/** Current user's holdings in the current session. */
export function useMyHoldings(): any[] {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const [holdings, setHoldings] = useState<any[]>([]);

  useEffect(() => {
    setHoldings([]);
    if (!user || !sessionId) return;
    const q = query(collection(db, 'holdings'), where('sessionId', '==', sessionId), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setHoldings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Holdings listener error:', err));
  }, [user, sessionId]);

  return holdings;
}

/** Current user's transactions in the current session, newest first. Sorted client-side to avoid a composite index. */
export function useMyTransactions(): any[] {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    setTransactions([]);
    if (!user || !sessionId) return;
    const q = query(collection(db, 'transactions'), where('sessionId', '==', sessionId), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setTransactions(list);
    }, (err) => console.error('Transactions listener error:', err));
  }, [user, sessionId]);

  return transactions;
}

/** Cash + holdings valued at the common market price. */
export function usePositionSummary() {
  const balance = useParticipantBalance();
  const stocks = useStocks();
  const holdings = useMyHoldings();

  const priceById: Record<string, number> = {};
  stocks.forEach((s) => { priceById[s.id] = s.currentPrice; });

  const cash = balance.currentCash;
  let invested = 0;
  let costBasis = 0;
  holdings.forEach((h) => {
    const qty = Number(h.quantity) || 0;
    if (qty <= 0) return;
    invested += qty * (priceById[h.stockId] ?? Number(h.averageBuyPrice) ?? 0);
    costBasis += qty * (Number(h.averageBuyPrice) || 0);
  });

  const netWorth = cash + invested;
  const startingBalance = balance.startingBalance;
  const pnl = netWorth - startingBalance;
  const returnPct = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;

  return { cash, invested, costBasis, netWorth, startingBalance, pnl, returnPct, holdings, stocks };
}
