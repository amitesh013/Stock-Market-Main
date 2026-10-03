import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { executeTrade } from '../lib/trade';
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
  Newspaper,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';

interface StockChartModalProps {
  stock: any;
  simulationStatus: string;
  onClose: () => void;
}

export default function StockChartModal({ stock, simulationStatus, onClose }: StockChartModalProps) {
  const { user, userData } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [realCandles, setRealCandles] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1M' | '5M' | '15M' | 'ALL'>('5M');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [holding, setHolding] = useState<{ quantity: number; averageBuyPrice: number } | null>(null);
  const [relatedNews, setRelatedNews] = useState<any[]>([]);

  // Listen to user holding for this stock
  useEffect(() => {
    if (!user || !stock) return;
    const holdingRef = doc(db, 'holdings', `${user.uid}_${stock.id}`);
    const unsub = onSnapshot(holdingRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setHolding({
          quantity: Number(d.quantity) || 0,
          averageBuyPrice: Number(d.averageBuyPrice) || 0
        });
      } else {
        setHolding(null);
      }
    });
    return unsub;
  }, [user, stock]);

  // Listen to price history for this stock
  useEffect(() => {
    if (!stock) return;
    const q = query(
      collection(db, 'price_history'),
      where('stockId', '==', stock.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        let timeMillis = Date.now();
        if (data.timestamp?.toMillis) {
          timeMillis = data.timestamp.toMillis();
        } else if (data.timestamp?.seconds) {
          timeMillis = data.timestamp.seconds * 1000;
        }
        return {
          price: Number(data.price),
          timestamp: timeMillis,
          timeLabel: format(new Date(timeMillis), 'HH:mm:ss')
        };
      });

      items.sort((a, b) => a.timestamp - b.timestamp);
      setHistory(items);
    }, (err) => {
      console.error('History fetch error:', err);
    });

    return unsub;
  }, [stock]);

  // Listen to related news
  useEffect(() => {
    if (!stock) return;
    const unsub = onSnapshot(collection(db, 'news'), (snap) => {
      const allNews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allNews.filter((n: any) => n.ticker === stock.ticker || n.ticker === 'ALL');
      filtered.sort((a: any, b: any) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tB - tA;
      });
      setRelatedNews(filtered.slice(0, 3));
    });
    return unsub;
  }, [stock]);

  // Fetch real market historical candles directly from exchange proxy
  useEffect(() => {
    if (!stock?.ticker) return;
    fetch(`/api/stocks/chart/${encodeURIComponent(stock.ticker)}?range=1d&interval=5m`)
      .then(r => r.json())
      .then(d => {
        if (d.chart && Array.isArray(d.chart) && d.chart.length > 0) {
          const points = d.chart.map((c: any) => ({
            price: Number(c.close || c.open),
            timestamp: c.timestamp,
            timeLabel: format(new Date(c.timestamp), 'HH:mm'),
          }));
          setRealCandles(points);
        }
      })
      .catch(err => console.warn('Exchange chart candles notice:', err));
  }, [stock?.ticker]);

  // Filter history based on timeframe
  const filteredData = useMemo(() => {
    const combined = [...realCandles, ...history];
    if (combined.length === 0) {
      const p = Number(stock.currentPrice) || 100;
      return [
        { price: p * 0.995, timeLabel: 'Open' },
        { price: p, timeLabel: 'Now' }
      ];
    }

    // Deduplicate by timestamp if overlapping
    const map = new Map<number, any>();
    combined.forEach(pt => map.set(pt.timestamp, pt));
    const sorted = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);

    const now = Date.now();
    let cutoff = 0;
    if (timeframe === '1M') cutoff = now - 5 * 60 * 1000;
    else if (timeframe === '5M') cutoff = now - 15 * 60 * 1000;
    else if (timeframe === '15M') cutoff = now - 60 * 60 * 1000;

    const slice = timeframe === 'ALL' ? sorted : sorted.filter(h => h.timestamp >= cutoff);
    return slice.length > 0 ? slice : sorted.slice(-20);
  }, [history, realCandles, timeframe, stock.currentPrice]);

  const currentPrice = Number(stock.currentPrice) || 0;
  const firstPrice = filteredData.length > 0 ? filteredData[0].price : currentPrice;
  const priceDiff = currentPrice - firstPrice;
  const priceDiffPercent = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
  const isUp = priceDiff >= 0;

  // High & Low in period
  const pricesInPeriod = filteredData.map(d => d.price);
  const highPrice = pricesInPeriod.length > 0 ? Math.max(...pricesInPeriod) : currentPrice;
  const lowPrice = pricesInPeriod.length > 0 ? Math.min(...pricesInPeriod) : currentPrice;

  // Trading calculation variables
  const numQty = Number(quantity) || 0;
  const estimatedTotal = Math.round(numQty * currentPrice * 100) / 100;
  const currentCash = Number(userData?.currentCash) || 0;
  const sharesOwned = holding?.quantity || 0;
  const avgCost = holding?.averageBuyPrice || 0;
  const maxAffordable = currentPrice > 0 ? Math.floor(currentCash / currentPrice) : 0;

  const isBuy = tradeType === 'BUY';
  const isMarketOpen = simulationStatus === 'RUNNING';

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMarketOpen) {
      setError('Market is currently closed. Orders cannot be executed.');
      return;
    }
    if (numQty <= 0) {
      setError('Please enter a valid quantity of shares.');
      return;
    }

    if (isBuy && estimatedTotal > currentCash) {
      setError(`Insufficient cash balance ($${currentCash.toFixed(2)} available)`);
      return;
    }

    if (!isBuy && numQty > sharesOwned) {
      setError(`You only own ${sharesOwned} shares of ${stock.ticker}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await executeTrade(stock.id, tradeType, numQty);
      setSuccessMsg(`Executed ${tradeType} for ${numQty} shares of ${stock.ticker}!`);
      setQuantity('');
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
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
  };

  const sellPnL = !isBuy && avgCost > 0 && numQty > 0 
    ? (currentPrice - avgCost) * numQty 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-zinc-200 overflow-hidden my-6">
        {/* Header Bar */}
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/80 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              {stock.ticker.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{stock.ticker}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-zinc-200 text-zinc-700">
                  {stock.sector || 'Stock'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                  stock.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stock.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {stock.isActive ? 'Active Trading' : 'Halted'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{stock.name}</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
          {/* Chart Section (2 Columns) */}
          <div className="lg:col-span-2 p-5 space-y-4">
            {/* Price & Metrics Banner */}
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

              {/* High / Low / Beta / Market Cap / Volatility */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">High</span>
                  <span className="font-bold text-zinc-800">${highPrice.toFixed(2)}</span>
                </div>
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Low</span>
                  <span className="font-bold text-zinc-800">${lowPrice.toFixed(2)}</span>
                </div>
                {stock.beta !== undefined && (
                  <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                    <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Beta</span>
                    <span className="font-bold text-zinc-800">{stock.beta.toFixed(2)}</span>
                  </div>
                )}
                {stock.marketCap && (
                  <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                    <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Mkt Cap</span>
                    <span className="font-bold text-zinc-800">{stock.marketCap}</span>
                  </div>
                )}
                <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                  <span className="text-zinc-400 block text-[9px] uppercase font-semibold">Ann. Vol</span>
                  <span className="font-bold text-blue-600">{((stock.volatility || 0.20) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Live Price Action
              </span>

              <div className="flex bg-zinc-100 p-0.5 rounded-lg text-xs">
                {(['1M', '5M', '15M', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      timeframe === tf
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Recharts Chart */}
            <div className="h-64 w-full bg-zinc-50/50 rounded-xl p-2 border border-zinc-100">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? '#16a34a' : '#dc2626'} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={isUp ? '#16a34a' : '#dc2626'} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis 
                    dataKey="timeLabel" 
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e4e4e7' }}
                  />
                  <YAxis 
                    domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${Number(val).toFixed(1)}`}
                  />
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
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isUp ? '#16a34a' : '#dc2626'}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#chartGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Related Financial News for this stock */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-zinc-500" />
                Catalysts & Market News for {stock.ticker}
              </h4>
              <div className="space-y-2">
                {relatedNews.map(item => (
                  <div key={item.id} className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-zinc-900 leading-snug">{item.headline}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
                        item.sentiment === 'BULLISH' ? 'bg-green-100 text-green-700' :
                        item.sentiment === 'BEARISH' ? 'bg-red-100 text-red-700' :
                        'bg-zinc-200 text-zinc-700'
                      }`}>
                        {item.sentiment}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-1">{item.summary}</p>
                  </div>
                ))}
                {relatedNews.length === 0 && (
                  <p className="text-xs text-zinc-400 italic">No specific news catalysts currently active for {stock.ticker}.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Trade Panel (Right Column) */}
          <div className="p-5 flex flex-col justify-between bg-zinc-50/40">
            <form onSubmit={handleTrade} className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Order Execution
                </h3>
                <p className="text-[11px] text-zinc-500">Direct market order at live quote</p>
              </div>

              {/* Status Alert if closed */}
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

              {/* Buy / Sell Tabs */}
              <div className="flex bg-zinc-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setTradeType('BUY'); setError(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    isBuy ? 'bg-white text-blue-600 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => { setTradeType('SELL'); setError(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !isBuy ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Balance & Holding Snapshot */}
              <div className="p-3 bg-white rounded-xl border border-zinc-200 text-xs space-y-1.5">
                <div className="flex justify-between text-zinc-600">
                  <span>Cash Balance:</span>
                  <span className="font-bold text-zinc-900">${currentCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Shares Owned:</span>
                  <span className="font-bold text-zinc-900">
                    {sharesOwned} {avgCost > 0 && `(@ $${avgCost.toFixed(2)})`}
                  </span>
                </div>
                {!isBuy && sharesOwned === 0 && (
                  <p className="text-[11px] text-amber-600 pt-1 font-medium">
                    You do not currently own shares of {stock.ticker}.
                  </p>
                )}
              </div>

              {/* Quantity Input with Presets */}
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

                {/* Percentage Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '25%', val: 0.25 },
                    { label: '50%', val: 0.50 },
                    { label: '75%', val: 0.75 },
                    { label: 'Max', val: 1.0 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handlePercentageClick(p.val)}
                      className="py-1 text-[11px] font-semibold bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-zinc-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isMarketOpen || loading || (!isBuy && sharesOwned === 0)}
                className={`w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-xs transition-all ${
                  isBuy
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-zinc-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 active:bg-black disabled:bg-zinc-300'
                } disabled:cursor-not-allowed`}
              >
                {loading
                  ? 'Submitting...'
                  : !isMarketOpen
                  ? 'Market Closed'
                  : isBuy
                  ? `Buy ${numQty > 0 ? `${numQty} ` : ''}${stock.ticker}`
                  : `Sell ${numQty > 0 ? `${numQty} ` : ''}${stock.ticker}`}
              </button>
            </form>

            <div className="text-center pt-3 text-[11px] text-zinc-400">
              Orders fill immediately at real-time market quote
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
