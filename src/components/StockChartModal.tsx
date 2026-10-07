import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { useSession } from '../lib/SessionContext';
import { executeTrade } from '../lib/trade';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS } from '../lib/shared-types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  X,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';

interface StockChartModalProps {
  stock: any;
  simulationStatus: string;
  onClose: () => void;
}

type DetailedInterval = '1M' | '5M' | '15M' | '30M' | '1H';

interface Candle {
  timestamp: number;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePercent: number;
  ma20?: number;
  ma50?: number;
}

function buildCandles(history: any[], interval: DetailedInterval): Candle[] {
  const intervalMs: Record<DetailedInterval, number> = {
    '1M': 60_000,
    '5M': 300_000,
    '15M': 900_000,
    '30M': 1_800_000,
    '1H': 3_600_000,
  };
  const buckets = new Map<number, any[]>();
  const size = intervalMs[interval];

  (Array.isArray(history) ? history : []).forEach((point) => {
    const timestamp = Number(point.timestamp);
    const price = Number(point.price);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) return;
    const bucket = Math.floor(timestamp / size) * size;
    const entries = buckets.get(bucket) || [];
    entries.push({ timestamp, price });
    buckets.set(bucket, entries);
  });

  const candles = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, entries]) => {
      const prices = entries.map((entry) => entry.price);
      const open = prices[0];
      const close = prices[prices.length - 1];
      return {
        timestamp,
        timeLabel: format(new Date(timestamp), 'HH:mm'),
        open,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close,
        changePercent: open > 0 ? ((close - open) / open) * 100 : 0,
      };
    });

  const candlesWithAverages = candles.map((candle, index) => {
    const closes = candles.slice(0, index + 1).map((item) => item.close);
    const average = (period: number) => closes.length >= period
      ? closes.slice(-period).reduce((sum, value) => sum + value, 0) / period
      : undefined;
    return { ...candle, ma20: average(20), ma50: average(50) };
  });

  const visibleCandleCount: Record<DetailedInterval, number> = {
    '1M': 35,
    '5M': 35,
    '15M': 35,
    '30M': 35,
    '1H': 35,
  };
  return candlesWithAverages.slice(-visibleCandleCount[interval]);
}

function DetailedCandleChart({ candles }: { candles: Candle[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 1400;
  const height = 560;
  const plot = { left: 104, right: 30, top: 32, bottom: 68 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const visibleHigh = Math.max(...candles.map((candle) => candle.high));
  const visibleLow = Math.min(...candles.map((candle) => candle.low));
  const visibleRange = visibleHigh - visibleLow;
  const padding = visibleRange > 0
    ? visibleRange * 0.05
    : Math.max(Math.abs(visibleHigh) * 0.01, 0.01);
  const max = visibleHigh + padding;
  const min = Math.max(0, visibleLow - padding);
  const x = (index: number) => plot.left + (index / Math.max(candles.length - 1, 1)) * plotWidth;
  const y = (value: number) => plot.top + ((max - value) / Math.max(max - min, 1)) * plotHeight;
  const candleSlot = plotWidth / Math.max(candles.length, 1);
  const candleWidth = Math.max(5, Math.min(22, candleSlot * 0.62));
  const hovered = hoveredIndex === null ? null : candles[hoveredIndex];
  const maSegments = (key: 'ma20' | 'ma50') => {
    const segments: string[][] = [];
    let previousVisibleIndex: number | null = null;
    candles.forEach((candle, index) => {
      const value = candle[key];
      if (value === undefined || value < min || value > max) {
        previousVisibleIndex = null;
        return;
      }
      const current = segments[segments.length - 1];
      if (current && current.length > 0 && previousVisibleIndex === index - 1) {
        current.push(`${x(index)},${y(value)}`);
      } else {
        segments.push([`${x(index)},${y(value)}`]);
      }
      previousVisibleIndex = index;
    });
    return segments.filter((segment) => segment.length > 1);
  };

  return (
    <div className="detailed-candle-chart relative h-[min(68vh,540px)] min-h-[340px] w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:min-h-[450px]">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Detailed OHLC candlestick chart">
        {[0, 1, 2, 3, 4, 5].map((step) => {
          const value = max - ((max - min) * step) / 5;
          return (
            <g key={step}>
              <line x1={plot.left} x2={width - plot.right} y1={y(value)} y2={y(value)} stroke="#e4e4e7" strokeDasharray="5 5" />
              <text x={plot.left - 14} y={y(value) + 5} textAnchor="end" fontSize="14" fontWeight="500" fill="#52525b">${value.toFixed(2)}</text>
            </g>
          );
        })}
        {candles.filter((_, index) => index % Math.max(1, Math.floor(candles.length / 8)) === 0).map((candle) => {
          const index = candles.indexOf(candle);
          return <line key={`vertical-${candle.timestamp}`} x1={x(index)} x2={x(index)} y1={plot.top} y2={height - plot.bottom} stroke="#f0f0f2" strokeDasharray="3 7" />;
        })}
        {maSegments('ma50').map((segment, index) => (
          <polyline key={`ma50-${index}`} points={segment.join(' ')} fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
        ))}
        {maSegments('ma20').map((segment, index) => (
          <polyline key={`ma20-${index}`} points={segment.join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" />
        ))}
        {candles.map((candle, index) => {
          const center = x(index);
          const up = candle.close >= candle.open;
          const color = up ? '#16a34a' : '#dc2626';
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));
          return (
            <g
              key={candle.timestamp}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-crosshair"
            >
              <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="2" />
              <rect x={center - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx="1" />
            </g>
          );
        })}
        {candles.filter((_, index) => index === 0 || index === candles.length - 1 || index % Math.max(1, Math.floor(candles.length / 6)) === 0).map((candle) => {
          const index = candles.indexOf(candle);
          return <text key={candle.timestamp} x={x(index)} y={height - 24} textAnchor="middle" fontSize="13" fontWeight="500" fill="#71717a">{candle.timeLabel}</text>;
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] text-white shadow-lg">
          <div className="mb-1 text-zinc-400">{hovered.timeLabel}</div>
          <div>O ${hovered.open.toFixed(2)} · H ${hovered.high.toFixed(2)}</div>
          <div>L ${hovered.low.toFixed(2)} · C ${hovered.close.toFixed(2)}</div>
          <div className={hovered.changePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
            Change {hovered.changePercent >= 0 ? '+' : ''}{hovered.changePercent.toFixed(2)}%
          </div>
        </div>
      )}
      <div className="absolute right-4 top-3 flex items-center gap-3 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-zinc-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />MA 20</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />MA 50</span>
      </div>
    </div>
  );
}

export default function StockChartModal({ stock, simulationStatus, onClose }: StockChartModalProps) {
  const { user, userData } = useAuth();
  const { sessionId } = useSession();
  const [history, setHistory] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1M' | '5M' | '15M' | 'ALL'>('5M');
  const [chartMode, setChartMode] = useState<'NORMAL' | 'DETAILED'>('NORMAL');
  const [detailedInterval, setDetailedInterval] = useState<DetailedInterval>('5M');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [holding, setHolding] = useState<{ quantity: number; averageBuyPrice: number } | null>(null);
  const stockId = typeof stock?.id === 'string' ? stock.id : '';
  const stockTicker = typeof stock?.ticker === 'string' ? stock.ticker : 'Stock';
  const stockName = typeof stock?.name === 'string' ? stock.name : 'Selected stock';
  const parsedStockPrice = Number(stock?.currentPrice);
  const currentStockPrice = Number.isFinite(parsedStockPrice) && parsedStockPrice > 0 ? parsedStockPrice : 0;

  // Listen to user holding — session subcollection
  useEffect(() => {
    if (!user || !stockId || !sessionId) return;
    const holdingRef = doc(
      db,
      COLLECTIONS.SESSIONS, sessionId,
      SESSION_SUBCOLLECTIONS.HOLDINGS,
      `${user.uid}_${stockId}`
    );
    const unsub = onSnapshot(holdingRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setHolding({
          quantity: Number(d.quantity) || 0,
          averageBuyPrice: Number(d.averageBuyPrice) || 0,
        });
      } else {
        setHolding(null);
      }
    });
    return unsub;
  }, [user, sessionId, stockId]);

  // Listen to price history — session subcollection
  useEffect(() => {
    if (!stockId || !sessionId) return;
    const q = query(
      collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY),
      where('stockId', '==', stockId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        let timeMillis = Date.now();
        if (data.timestamp?.toMillis) timeMillis = data.timestamp.toMillis();
        else if (data.timestamp?.seconds) timeMillis = data.timestamp.seconds * 1000;
        return {
          price: Number(data.price),
          timestamp: timeMillis,
          timeLabel: Number.isFinite(timeMillis) ? format(new Date(timeMillis), 'HH:mm:ss') : '',
        };
      }).filter((item) => Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.timestamp));
      items.sort((a, b) => a.timestamp - b.timestamp);
      setHistoryError('');
      setHistory(items);
    }, (err) => {
      console.error('History fetch error:', err);
      setHistoryError('Price history is not available yet.');
      setHistory([]);
    });
    return unsub;
  }, [sessionId, stockId]);

  // Filter history based on timeframe
  const filteredData = useMemo(() => {
    if (history.length === 0) {
      const p = currentStockPrice || 100;
      return [
        { price: p * 0.995, timeLabel: 'Open' },
        { price: p, timeLabel: 'Now' },
      ];
    }

    const now = Date.now();
    let cutoff = 0;
    if (timeframe === '1M') cutoff = now - 5 * 60 * 1000;
    else if (timeframe === '5M') cutoff = now - 15 * 60 * 1000;
    else if (timeframe === '15M') cutoff = now - 60 * 60 * 1000;

    const slice = timeframe === 'ALL' ? history : history.filter(h => h.timestamp >= cutoff);
    return slice.length > 0 ? slice : history.slice(-20);
  }, [history, timeframe, currentStockPrice]);

  const currentPrice = currentStockPrice;
  const firstPrice = filteredData.length > 0 ? filteredData[0].price : currentPrice;
  const priceDiff = currentPrice - firstPrice;
  const priceDiffPercent = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
  const isUp = priceDiff >= 0;

  const pricesInPeriod = filteredData.map(d => d.price);
  const highPrice = pricesInPeriod.length > 0 ? Math.max(...pricesInPeriod) : currentPrice;
  const lowPrice = pricesInPeriod.length > 0 ? Math.min(...pricesInPeriod) : currentPrice;
  const detailedCandles = useMemo(
    () => buildCandles(history, detailedInterval),
    [history, detailedInterval]
  );

  // Trading variables — pull cash from session portfolio (via userData for now; ideally from SessionPortfolio)
  const numQty = Number(quantity) || 0;
  const estimatedTotal = Math.round(numQty * currentPrice * 100) / 100;
  const currentCash = Number(userData?.currentCash) || 0;
  const sharesOwned = holding?.quantity || 0;
  const avgCost = holding?.averageBuyPrice || 0;

  const isBuy = tradeType === 'BUY';
  const isMarketOpen = simulationStatus === 'RUNNING';

  const sellPnL = !isBuy && avgCost > 0 && numQty > 0
    ? (currentPrice - avgCost) * numQty
    : 0;

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) { setError('No active session.'); return; }
    if (!isMarketOpen) { setError('Market is currently closed. Orders cannot be executed.'); return; }
    if (numQty <= 0) { setError('Please enter a valid quantity of shares.'); return; }
    if (isBuy && estimatedTotal > currentCash) {
      setError(`Insufficient cash balance ($${currentCash.toFixed(2)} available)`);
      return;
    }
    if (!isBuy && numQty > sharesOwned) {
      setError(`You only own ${sharesOwned} shares of ${stockTicker}`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Pass sessionId explicitly — trade.ts now requires it
      await executeTrade(sessionId, stockId, tradeType, numQty);
      setSuccessMsg(`Executed ${tradeType} for ${numQty} shares of ${stockTicker}!`);
      setQuantity('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Trade failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePercentageClick = (pct: number) => {
    setError('');
    if (isBuy) {
      const affordable = Math.floor((currentCash * pct) / currentPrice);
      setQuantity(affordable > 0 ? affordable : '');
    } else {
      const toSell = Math.floor(sharesOwned * pct);
      setQuantity(toSell > 0 ? toSell : '');
    }

    if (!stockId) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-sm font-semibold text-zinc-800">Stock data is unavailable.</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
              Close
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-2 backdrop-blur-xs sm:p-6">
      <div className="my-0 w-full min-w-0 max-w-6xl overflow-visible rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:my-2">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 p-3 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              {stockTicker.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{stockTicker}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-zinc-200 text-zinc-700">
                  {stock?.sector || 'Stock'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                  stock?.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stock?.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {stock?.isActive ? 'Active Trading' : 'Halted'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{stockName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 items-start divide-y divide-zinc-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {/* Chart Section */}
          <div className="min-w-0 space-y-4 p-3 sm:p-5 lg:col-span-2">
            {/* Price Banner */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-zinc-100">
              <div>
                <div className="text-3xl font-extrabold text-zinc-900 tracking-tight">
                  ${currentPrice.toFixed(2)}
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold mt-0.5 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{isUp ? '+' : ''}${priceDiff.toFixed(2)}</span>
                  <span>({isUp ? '+' : ''}{priceDiffPercent.toFixed(2)}%)</span>
                  <span className="text-xs text-zinc-400 font-normal ml-1">in selected window</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">High</span>
                  <span className="font-bold text-zinc-800">${highPrice.toFixed(2)}</span>
                </div>
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Low</span>
                  <span className="font-bold text-zinc-800">${lowPrice.toFixed(2)}</span>
                </div>
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Ann. Vol</span>
                  <span className="font-bold text-blue-600">{((Number(stock?.volatility) || 0.015) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Chart mode and timeframe controls */}
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  Price Action
                </span>
                <div className="flex shrink-0 rounded-lg bg-zinc-100 p-0.5 text-xs">
                  {(['NORMAL', 'DETAILED'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        chartMode === mode ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {mode === 'NORMAL' ? 'Normal' : 'Detailed'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex max-w-full shrink-0 overflow-x-auto rounded-lg bg-zinc-100 p-0.5 text-xs">
                {(chartMode === 'NORMAL' ? (['1M', '5M', '15M', 'ALL'] as const) : (['1M', '5M', '15M', '30M', '1H'] as const)).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => chartMode === 'NORMAL' ? setTimeframe(tf as '1M' | '5M' | '15M' | 'ALL') : setDetailedInterval(tf as DetailedInterval)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      (chartMode === 'NORMAL' ? timeframe === tf : detailedInterval === tf) ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            {chartMode === 'DETAILED' ? (
              detailedCandles.length > 0
                ? <DetailedCandleChart candles={detailedCandles} />
                : <div className="flex h-80 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-xs text-zinc-500">{historyError || 'Price history is not available yet.'}</div>
            ) : (
              <div className="h-72 min-h-[280px] w-full rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredData} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#16a34a' : '#dc2626'} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={isUp ? '#16a34a' : '#dc2626'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={{ stroke: '#d4d4d8' }} />
                    <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${Number(val).toFixed(1)}`} width={52} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-0.5">
                              <div className="text-zinc-400 font-mono text-[10px]">{d.timeLabel}</div>
                              <div className="font-bold text-sm text-white">${Number(d.price).toFixed(2)}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="price" stroke={isUp ? '#16a34a' : '#dc2626'} strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

          </div>

          {/* Trade Panel */}
          <div className="self-start bg-zinc-50/40 p-5">
            <form onSubmit={handleTrade} className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Order Execution
                </h3>
                <p className="text-[11px] text-zinc-500">Direct market order at live quote</p>
              </div>

              {!isMarketOpen && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Market is closed. Orders are locked.</span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex bg-zinc-200/80 p-1 rounded-xl">
                <button type="button" onClick={() => { setTradeType('BUY'); setError(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${isBuy ? 'bg-white text-blue-600 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  Buy
                </button>
                <button type="button" onClick={() => { setTradeType('SELL'); setError(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${!isBuy ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  Sell
                </button>
              </div>

              <div className="p-3 bg-white rounded-xl border border-zinc-200 text-xs space-y-1.5">
                <div className="flex justify-between text-zinc-600">
                  <span>Cash Balance:</span>
                  <span className="font-bold text-zinc-900">${currentCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Shares Owned:</span>
                  <span className="font-bold text-zinc-900">
                    {sharesOwned}{avgCost > 0 ? ` (@ $${avgCost.toFixed(2)})` : ''}
                  </span>
                </div>
                {!isBuy && sharesOwned === 0 && (
                  <p className="text-[11px] text-amber-600 pt-1 font-medium">
                    You do not currently own shares of {stockTicker}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Shares Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                    setQuantity(val);
                    setError('');
                  }}
                  className="w-full px-3.5 py-2 text-base font-bold border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ label: '25%', val: 0.25 }, { label: '50%', val: 0.50 }, { label: '75%', val: 0.75 }, { label: 'Max', val: 1.0 }].map(p => (
                    <button key={p.label} type="button" onClick={() => handlePercentageClick(p.val)}
                      className="py-1 text-[11px] font-semibold bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-zinc-700">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-zinc-100/60 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Execution Price</span>
                  <span className="font-semibold text-zinc-800">${currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-900 font-bold text-sm pt-1 border-t border-zinc-200">
                  <span>{isBuy ? 'Total Cost' : 'Total Proceeds'}</span>
                  <span className={isBuy && estimatedTotal > currentCash ? 'text-red-600' : 'text-zinc-900'}>
                    ${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {!isBuy && numQty > 0 && avgCost > 0 && (
                  <div className="flex justify-between text-xs font-semibold pt-1">
                    <span className="text-zinc-500">Realized P&L:</span>
                    <span className={sellPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {sellPnL >= 0 ? '+' : ''}${sellPnL.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!isMarketOpen || loading || (!isBuy && sharesOwned === 0)}
                className={`w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-xs transition-all ${
                  isBuy
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-zinc-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 active:bg-black disabled:bg-zinc-300'
                } disabled:cursor-not-allowed`}
              >
                {loading ? 'Submitting...'
                  : !isMarketOpen ? 'Market Closed'
                  : isBuy ? `Buy ${numQty > 0 ? `${numQty} ` : ''}${stockTicker}`
                  : `Sell ${numQty > 0 ? `${numQty} ` : ''}${stockTicker}`}
              </button>
            </form>

            <div className="text-center pt-3 text-[11px] text-zinc-400">
              Orders fill immediately at live session price
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
