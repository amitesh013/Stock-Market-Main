import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { useMyHoldings } from './liveData';
import { useSession, useParticipantBalance } from './session';

export interface PortfolioHolding {
  id: string;
  stockId: string;
  stock: any;
  quantity: number;
  averageBuyPrice: number;
  stockPrice: number;
  currentValue: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  history: number[];
}

const HISTORY_LENGTH = 24;

/**
 * Portfolio valuation. Mirrors the original Portfolio component: holdings are valued at the
 * current price of their stock document, and the stored portfolioValue is re-synced on drift.
 */
export function usePortfolio() {
  const { user } = useAuth();
  const holdings = useMyHoldings();
  const [stocks, setStocks] = useState<Record<string, any>>({});
  const historyRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'stocks'), (snap) => {
      const map: Record<string, any> = {};
      snap.forEach((d) => {
        const s = { id: d.id, ...d.data() } as any;
        const price = Number(s.currentPrice) || 0;
        const prev = historyRef.current[d.id] || [Number(s.dayOpenPrice) || price];
        historyRef.current[d.id] = prev[prev.length - 1] === price ? prev : [...prev, price].slice(-HISTORY_LENGTH);
        map[d.id] = s;
      });
      setStocks(map);
    }, (err) => console.error('Stocks listener error:', err));
  }, [user]);

  const balance = useParticipantBalance();
  const { sessionId, participant } = useSession();
  const cash = balance.currentCash;
  const startingBalance = balance.startingBalance;

  const summary = useMemo(() => {
    let invested = 0;
    const list: PortfolioHolding[] = [];
    holdings.forEach((h) => {
      const stock = stocks[h.stockId];
      if (!stock) return;
      const quantity = Number(h.quantity) || 0;
      const stockPrice = Number(stock.currentPrice) || 0;
      const currentValue = quantity * stockPrice;
      const averageBuyPrice = Number(h.averageBuyPrice) || 0;
      const costBasis = quantity * averageBuyPrice;
      const pnl = currentValue - costBasis;
      invested += currentValue;
      list.push({
        id: h.id,
        stockId: h.stockId,
        stock,
        quantity,
        averageBuyPrice,
        stockPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
        history: historyRef.current[h.stockId] || [stockPrice],
      });
    });
    const totalValue = Math.round((cash + invested) * 100) / 100;
    const totalPnl = totalValue - startingBalance;
    return {
      holdings: list.sort((a, b) => b.currentValue - a.currentValue),
      invested,
      cash,
      totalValue,
      startingBalance,
      totalPnl,
      totalPnlPercent: startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0,
      stocks,
    };
  }, [holdings, stocks, cash, startingBalance]);

  // Keep the stored portfolioValue (used for ranking) in sync, as the original page did.
  useEffect(() => {
    if (!user || !sessionId || !participant || Object.keys(stocks).length === 0) return;
    const stored = Number(participant.portfolioValue) || 0;
    if (Math.abs(stored - summary.totalValue) > 0.05) {
      updateDoc(doc(db, 'sessions', sessionId, 'participants', user.uid), { portfolioValue: summary.totalValue })
        .catch((err) => console.error('Portfolio value sync error:', err));
    }
  }, [user, sessionId, participant?.portfolioValue, summary.totalValue, stocks]);

  return summary;
}

export interface PerformancePoint {
  t: number;
  value: number;
}

const tsMillis = (v: any): number =>
  v?.toMillis ? v.toMillis() : typeof v?.seconds === 'number' ? v.seconds * 1000 : typeof v === 'number' ? v : 0;

/**
 * Portfolio value over time, reconstructed from the user's transactions (cash and share counts
 * after each trade) and the recorded price_history of the stocks they traded.
 */
export function usePerformanceHistory(transactions: any[], startingBalance: number, liveValue: number, startedAt?: number) {
  const stockIds = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.stockId).filter(Boolean))) as string[],
    [transactions],
  );
  const [prices, setPrices] = useState<Record<string, { t: number; price: number }[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      stockIds.map(async (id) => {
        const snap = await getDocs(query(collection(db, 'price_history'), where('stockId', '==', id)));
        const list = snap.docs
          .map((d) => ({ t: tsMillis(d.data().timestamp), price: Number(d.data().price) }))
          .filter((p) => p.t > 0 && p.price > 0)
          .sort((a, b) => a.t - b.t);
        return [id, list] as const;
      }),
    )
      .then((entries) => { if (!cancelled) setPrices(Object.fromEntries(entries)); })
      .catch((err) => console.warn('Performance history notice:', err));
    return () => { cancelled = true; };
    // Refetch when a new trade lands; live movement is covered by the session trail below.
  }, [stockIds.join('|'), transactions.length]);

  // Live trail for this session so the line extends as prices move.
  const trailRef = useRef<PerformancePoint[]>([]);
  const [trail, setTrail] = useState<PerformancePoint[]>([]);
  useEffect(() => {
    if (!liveValue) return;
    const last = trailRef.current[trailRef.current.length - 1];
    if (last && Math.abs(last.value - liveValue) < 0.005) return;
    trailRef.current = [...trailRef.current, { t: Date.now(), value: liveValue }].slice(-500);
    setTrail(trailRef.current);
  }, [liveValue]);

  return useMemo(() => {
    const txs = [...transactions]
      .map((t) => ({ ...t, ms: tsMillis(t.timestamp) }))
      .filter((t) => t.ms > 0)
      .sort((a, b) => a.ms - b.ms);

    const points: PerformancePoint[] = [];
    if (txs.length) {
      const times = new Set<number>(txs.map((t) => t.ms));
      Object.values(prices).forEach((list) => list.forEach((p) => { if (p.t >= txs[0].ms) times.add(p.t); }));
      const timeline = Array.from(times).sort((a, b) => a - b);

      const qty: Record<string, number> = {};
      const lastPrice: Record<string, number> = {};
      const cursor: Record<string, number> = {};
      let cash = startingBalance;
      let ti = 0;

      points.push({ t: txs[0].ms - 1, value: startingBalance });
      for (const t of timeline) {
        while (ti < txs.length && txs[ti].ms <= t) {
          const tx = txs[ti++];
          const q = Number(tx.quantity) || 0;
          qty[tx.stockId] = (qty[tx.stockId] || 0) + (tx.type === 'BUY' ? q : -q);
          if (tx.resultingCashBalance !== undefined) cash = Number(tx.resultingCashBalance);
          lastPrice[tx.stockId] = Number(tx.priceAtExecution) || lastPrice[tx.stockId] || 0;
        }
        for (const id of Object.keys(qty)) {
          const list = prices[id] || [];
          let c = cursor[id] || 0;
          while (c < list.length && list[c].t <= t) { lastPrice[id] = list[c].price; c++; }
          cursor[id] = c;
        }
        const holdingsVal = Object.entries(qty).reduce((sum, [id, q]) => sum + (q > 0 ? q * (lastPrice[id] || 0) : 0), 0);
        points.push({ t, value: Math.round((cash + holdingsVal) * 100) / 100 });
      }
    } else if (startedAt && startedAt < Date.now()) {
      points.push({ t: startedAt, value: startingBalance });
    }

    const lastT = points.length ? points[points.length - 1].t : 0;
    trail.forEach((p) => { if (p.t > lastT) points.push(p); });
    if (liveValue && (!points.length || points[points.length - 1].t < Date.now() - 1000)) {
      points.push({ t: Date.now(), value: liveValue });
    }

    const markers = txs.map((t) => ({ t: t.ms, type: t.type as 'BUY' | 'SELL', ticker: t.ticker as string, quantity: Number(t.quantity) || 0 }));
    return { points, markers };
  }, [transactions, prices, startingBalance, trail, liveValue, startedAt]);
}

/** Smoothly animates numeric changes (respects prefers-reduced-motion). */
export function useAnimatedNumber(target: number, duration = 450): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || Math.abs(target - valueRef.current) < 0.005) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    fromRef.current = valueRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromRef.current + (target - fromRef.current) * eased;
      valueRef.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
