import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveStock } from './liveData';
import { useSession } from './session';
import { toMillis } from './marketState';

export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const RANGE_MS: Record<ChartRange, number> = {
  '1D': 24 * 3600e3,
  '1W': 7 * 24 * 3600e3,
  '1M': 30 * 24 * 3600e3,
  '3M': 91 * 24 * 3600e3,
  '1Y': 365 * 24 * 3600e3,
};

const EXCHANGE_RANGE: Record<ChartRange, string> = { '1D': '1d', '1W': '5d', '1M': '1mo', '3M': '3mo', '1Y': '1y' };
const TARGET_CANDLES = 48;

const exchangeCache = new Map<string, Candle[]>();

/** Exchange OHLCV candles (only for stocks backed by the real-market feed). */
function useExchangeCandles(ticker: string | undefined, range: ChartRange, enabled: boolean) {
  const key = `${ticker}|${range}`;
  const [candles, setCandles] = useState<Candle[] | null>(() => exchangeCache.get(key) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !ticker) { setCandles(null); return; }
    const cached = exchangeCache.get(key);
    if (cached) { setCandles(cached); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stocks/chart/${encodeURIComponent(ticker)}?range=${EXCHANGE_RANGE[range]}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const pts: Candle[] = Array.isArray(d?.points)
          ? d.points.map((p: any) => ({
              t: Number(p.timestamp),
              open: Number(p.open ?? p.price),
              high: Number(p.high ?? p.price),
              low: Number(p.low ?? p.price),
              close: Number(p.price),
              volume: Number(p.volume) || 0,
            })).filter((c: Candle) => c.close > 0)
          : [];
        exchangeCache.set(key, pts);
        setCandles(pts);
      })
      .catch(() => { if (!cancelled) setCandles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, enabled, ticker, range]);

  return { candles, loading };
}

/** Raw price ticks for one stock from the shared price_history feed, clipped to the current session's window. */
function usePriceTicks(stockId: string | undefined) {
  const [ticks, setTicks] = useState<{ t: number; price: number }[]>([]);
  const { sessionId, config } = useSession();
  const windowStart = toMillis(config?.startedAt) || toMillis(config?.createdAt);
  const windowEnd = toMillis(config?.completedAt) || Number.MAX_SAFE_INTEGER;

  useEffect(() => {
    setTicks([]);
    if (!stockId || !sessionId) return;
    const q = query(collection(db, 'price_history'), where('stockId', '==', stockId));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data();
          const ts = data.timestamp;
          const t = ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0;
          return { t, price: Number(data.price) };
        })
        .filter((p) => p.t > 0 && p.price > 0 && p.t >= windowStart && p.t <= windowEnd)
        .sort((a, b) => a.t - b.t);
      setTicks(list);
    }, (err) => console.error('Price history listener error:', err));
  }, [stockId, sessionId, windowStart, windowEnd]);

  return ticks;
}

function bucketTicks(ticks: { t: number; price: number }[], range: ChartRange): Candle[] {
  if (ticks.length === 0) return [];
  const cutoff = Date.now() - RANGE_MS[range];
  const inRange = ticks.filter((p) => p.t >= cutoff);
  const src = inRange.length >= 2 ? inRange : ticks;
  const span = Math.max(1, src[src.length - 1].t - src[0].t);
  const size = Math.max(10_000, Math.ceil(span / TARGET_CANDLES));

  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (const p of src) {
    const bucket = Math.floor(p.t / size) * size;
    if (!cur || cur.t !== bucket) {
      if (cur) out.push(cur);
      const open = cur ? cur.close : p.price;
      cur = { t: bucket, open, high: Math.max(open, p.price), low: Math.min(open, p.price), close: p.price };
    } else {
      cur.high = Math.max(cur.high, p.price);
      cur.low = Math.min(cur.low, p.price);
      cur.close = p.price;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function useChartSeries(stock: LiveStock | null, range: ChartRange) {
  const useExchange = !!stock?.isRealFeed;
  const exchange = useExchangeCandles(stock?.ticker, range, useExchange);
  const ticks = usePriceTicks(stock?.id);
  const livePrice = stock?.currentPrice;

  return useMemo(() => {
    let candles: Candle[] = [];
    let source: 'exchange' | 'simulation' = 'simulation';
    if (useExchange && exchange.candles && exchange.candles.length >= 2) {
      candles = exchange.candles;
      source = 'exchange';
      if (range === '1D' && livePrice && candles.length) {
        const last = candles[candles.length - 1];
        candles = [...candles.slice(0, -1), { ...last, close: livePrice, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice) }];
      }
    } else {
      candles = bucketTicks(ticks, range);
    }
    const hasVolume = candles.some((c) => (c.volume ?? 0) > 0);
    return { candles, source, hasVolume, loading: exchange.loading && candles.length === 0 };
  }, [useExchange, exchange.candles, exchange.loading, ticks, range, livePrice]);
}
